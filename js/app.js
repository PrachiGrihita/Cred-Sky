/**
 * SKY CRED — application controller.
 *
 * Owns the single source of truth for "which city is on screen", sequences the
 * requests, and guarantees that a slow response can never overwrite a newer one.
 */

import { CONFIG } from "./config.js";
import { fetchCurrentWeather, WeatherApiError } from "./api.js";
import { interpretWeather } from "./cred.js";
import {
  announce,
  clearFieldError,
  els,
  hideError,
  jsonViewer,
  renderCityChips,
  renderWeather,
  setActiveCity,
  setFieldError,
  setInputValue,
  setLoading,
  showDashboard,
  showError,
  stopLoading,
} from "./ui.js";

const ERROR_TITLES = {
  "not-found": "City not found",
  auth: "API configuration error",
  network: "No internet connection",
  "rate-limit": "Too many requests",
  server: "Weather service unavailable",
  "invalid-query": "City required",
  unknown: "Couldn't load the weather",
};

const RETRYABLE = new Set(["network", "rate-limit", "server", "unknown"]);

const state = {
  query: CONFIG.defaultCity,
  lastAttempt: CONFIG.defaultCity,
  requestId: 0,
  controller: null,
  hasData: false,
};

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function setQuery(value) {
  state.query = value;
  setInputValue(value);
  setActiveCity(value);
}

async function loadCity(city, { fromChip = false } = {}) {
  const query = normalize(city);

  if (!query) {
    setFieldError("Enter a city name to check the sky.");
    announce("City name is required.");
    return;
  }

  clearFieldError();
  if (fromChip) setInputValue(query);
  state.lastAttempt = query;

  // Cancel anything still in flight and invalidate older handlers.
  if (state.controller) state.controller.abort();
  const controller = new AbortController();
  state.controller = controller;
  const requestId = ++state.requestId;

  setLoading(state.hasData ? "refresh" : "initial");
  hideError();

  try {
    const { data, raw, receivedAt } = await fetchCurrentWeather(query, {
      signal: controller.signal,
      apiKey: CONFIG.apiKey,
      apiBase: CONFIG.apiBase,
    });

    // A newer search started while this one was resolving — drop this result.
    if (requestId !== state.requestId) return;

    const interpretation = interpretWeather(data);
    renderWeather(data, interpretation);
    jsonViewer.set(data, raw, receivedAt);

    state.hasData = true;
    setQuery(data.location?.name || query);
    showDashboard();
    announce(
      `${data.location?.name || query}: ${Math.round(data.current.temp_c)} degrees, ${data.current.condition?.text}. ${interpretation.personality.title}.`,
    );
  } catch (error) {
    if (requestId !== state.requestId) return; // superseded
    if (error && error.name === "AbortError") return; // cancelled deliberately

    const normalized =
      error instanceof WeatherApiError
        ? error
        : new WeatherApiError("unknown", "Something unexpected happened. Please try again.", { retryable: true });

    // Preserve any weather already on screen instead of blanking the card.
    if (state.hasData) showDashboard();
    else stopLoading();

    showError(ERROR_TITLES[normalized.kind] || ERROR_TITLES.unknown, normalized.message, {
      retryable: RETRYABLE.has(normalized.kind),
    });
    announce(`Error. ${normalized.message}`);
  } finally {
    if (requestId === state.requestId) {
      state.controller = null;
      if (state.hasData) stopLoading();
    }
  }
}

function bindEvents() {
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    loadCity(els.input.value);
  });

  els.input.addEventListener("input", () => {
    if (!els.fieldError.hidden) clearFieldError();
  });

  els.retry.addEventListener("click", () => loadCity(state.lastAttempt || state.query));

  renderCityChips(CONFIG.popularCities, (city) => loadCity(city, { fromChip: true }));
}

function init() {
  bindEvents();
  setQuery(CONFIG.defaultCity);
  loadCity(CONFIG.defaultCity);
}

init();
