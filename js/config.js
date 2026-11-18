/**
 * Application configuration.
 *
 * The API key is injected at build time by `scripts/build.js`, which reads the
 * local `.env` file (or the WEATHERAPI_KEY environment variable) and writes
 * `js/env.js`. Nothing secret is committed to the repository.
 */

const runtimeEnv = (typeof window !== "undefined" && window.SKYCRED_ENV) || {};

export const CONFIG = Object.freeze({
  apiBase: "https://api.weatherapi.com/v1/current.json",
  apiKey: (runtimeEnv.WEATHER_API_KEY || "").trim(),
  defaultCity: "Mumbai",
  popularCities: Object.freeze([
    "Mumbai",
    "Delhi",
    "Bengaluru",
    "Hyderabad",
    "Chennai",
    "Kolkata",
    "Pune",
    "Ahmedabad",
    "New York",
    "London",
  ]),
});

/**
 * Interpretation thresholds (FR-05). Priority order is top to bottom, so an
 * overlapping condition is always resolved by the first matching rule.
 */
export const THRESHOLDS = Object.freeze({
  freezeMaxC: 8,
  sunMinC: 35,
  windMinKph: 25,
  /* condition codes that represent rain / drizzle / thunder / storms */
  rainCodes: Object.freeze([
    1063, 1072, 1087, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192,
    1195, 1198, 1201, 1204, 1207, 1240, 1243, 1246, 1249, 1252, 1273, 1276,
    1279, 1282,
  ]),
  /* condition codes that represent snow / ice */
  snowCodes: Object.freeze([
    1066, 1069, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1255,
    1258, 1261, 1264,
  ]),
});
