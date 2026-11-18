/**
 * WeatherAPI transport layer.
 *
 * Every failure is normalised into a WeatherApiError so the UI can render a
 * meaningful, actionable message instead of a generic blank state (FR-08).
 */

export class WeatherApiError extends Error {
  /**
   * @param {string} code machine-readable code
   * @param {string} message user-facing message
   * @param {{ kind?: string, retryable?: boolean, status?: number }} [meta]
   */
  constructor(code, message, meta = {}) {
    super(message);
    this.name = "WeatherApiError";
    this.code = code;
    this.kind = meta.kind || "unknown";
    this.retryable = Boolean(meta.retryable);
    this.status = meta.status ?? null;
  }
}

const ERROR_CODES = {
  // WeatherAPI application level errors
  1003: { kind: "invalid-query", message: "Enter a city name to check the sky." },
  1006: { kind: "not-found", message: "City not found. Check the spelling and try again." },
  2006: { kind: "auth", message: "Weather API key is invalid. Check the API configuration." },
  2007: { kind: "auth", message: "Weather API key is disabled. Check the API configuration." },
  2008: { kind: "auth", message: "Weather API key is inactive. Check the API configuration." },
  2009: { kind: "auth", message: "Weather API key is suspended. Check the API configuration." },
  9000: { kind: "unknown", message: "Something went wrong while reading the weather data." },
};

function fromPayloadError(payload) {
  const apiError = payload && payload.error;
  if (!apiError) return null;
  const mapped = ERROR_CODES[apiError.code] || {
    kind: "unknown",
    message: "Something went wrong while reading the weather data.",
  };
  return new WeatherApiError(String(apiError.code), mapped.message, {
    kind: mapped.kind,
    retryable: mapped.kind === "not-found" || mapped.kind === "unknown",
    status: 200,
  });
}

/**
 * Fetch the current weather for a city.
 *
 * @param {string} city
 * @param {{ signal?: AbortSignal, apiKey: string, signalTimeout?: number }} options
 * @returns {Promise<{ data: any, raw: string, receivedAt: Date }>}
 */
export async function fetchCurrentWeather(city, { signal, apiKey, apiBase }) {
  if (!apiKey) {
    throw new WeatherApiError("missing-key", "Weather API key is not configured for this build.", {
      kind: "auth",
    });
  }

  const url = `${apiBase}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(city)}&aqi=no`;

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (error) {
    if (error && error.name === "AbortError") throw error;
    throw new WeatherApiError("network", "Can't reach the weather service. Check your internet connection.", {
      kind: "network",
      retryable: true,
    });
  }

  if (response.status === 429) {
    throw new WeatherApiError("rate-limit", "Too many requests right now. Please try again in a minute.", {
      kind: "rate-limit",
      retryable: true,
      status: 429,
    });
  }

  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    if (response.status >= 500) {
      throw new WeatherApiError("server", "The weather service is unavailable. Please try again shortly.", {
        kind: "server",
        retryable: true,
        status: response.status,
      });
    }
    throw new WeatherApiError("invalid-json", "The weather service sent an unexpected response.", {
      kind: "unknown",
      retryable: true,
      status: response.status,
    });
  }

  const payloadError = fromPayloadError(payload);
  if (payloadError && !response.ok) throw payloadError;

  if (response.status === 401 || response.status === 403) {
    throw new WeatherApiError("auth", "Weather API key is invalid. Check the API configuration.", {
      kind: "auth",
      status: response.status,
    });
  }

  if (response.status >= 500) {
    throw new WeatherApiError("server", "The weather service is unavailable. Please try again shortly.", {
      kind: "server",
      retryable: true,
      status: response.status,
    });
  }

  if (payloadError) throw payloadError;

  if (!response.ok || !payload || !payload.current || !payload.location) {
    throw new WeatherApiError("unexpected", "We received an unexpected response from the weather service.", {
      kind: "unknown",
      retryable: true,
      status: response.status,
    });
  }

  return { data: payload, raw, receivedAt: new Date() };
}
