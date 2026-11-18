# SKY CRED

> Check the sky's credit score before you step out.

SKY CRED is a lightweight, single-page weather app. Search any city, see its live
conditions, and get a plain-language answer to the only question that matters:
*is today a good day to step outside?*

Live data comes from [WeatherAPI.com](https://www.weatherapi.com/). The "credit
score" is an application-generated weather interpretation, not a real credit score.

---

## Stack

Plain HTML, CSS and modern vanilla JavaScript (ES modules). No framework, no
runtime dependencies. A 60-line Node build script injects the WeatherAPI key from
`.env` into `dist/js/env.js`.

```
index.html            Markup and accessible structure
css/styles.css        Design system, layout, responsive rules
js/app.js             Controller: state, requests, race-condition guard
js/api.js             WeatherAPI transport + error normalisation
js/cred.js            Weather interpretation + score engine
js/ui.js              All DOM rendering, formatters, JSON viewer
js/config.js          Static config, popular cities, thresholds
scripts/build.js      Build: .env -> dist/ (+ js/env.js)
scripts/serve.js      Zero-dependency local static server
```

## Run locally

```bash
cp .env.example .env      # then paste your WeatherAPI key into .env
npm run dev               # builds dist/ and serves http://localhost:4173
```

`npm run build` produces a deployable `dist/` folder.

## Deploy

`vercel.json` is already configured (`node scripts/build.js` → `dist/`).

1. Import the repository into Vercel.
2. Add an environment variable `WEATHERAPI_KEY`.
3. Deploy.

The WeatherAPI key is a frontend key and is shipped to the browser by design.
It is kept in `.env` so it never lands in source control — it is **not** a
secret and must not be treated as one.

## Weather interpretation rules

Priority order — the first matching rule wins:

| # | Condition | Personality | Recommendation |
|---|-----------|-------------|----------------|
| 1 | Snow code, or `temp_c ≤ 8` | **Freeze Frame** | Bone-chilling cold. Bundle up tight. |
| 2 | `temp_c ≥ 35` | **Sun Alert** | Stay hydrated and avoid excessive sun exposure. |
| 3 | Rain/thunder code, precipitation > 0.2 mm, or "rain" in the condition text | **Rain Check** | Carry an umbrella before stepping out. |
| 4 | `wind_kph ≥ 25` | **Breezy Mode** | Expect strong winds. Dress accordingly. |
| 5 | Everything else | **Perfect Day** | Great weather to step outside. |

The 0–100 sky credit score starts at 100 and deducts for thermal deviation from
22–27 °C, wind above 20 km/h, UV above 5, precipitation, humidity outside 30–65 %
and heavy overcast. Bands: 90+ Excellent, 75+ Good, 60+ Fair, 40+ Poor, else Risky.
Deductions are shown under the gauge so the number is never a black box.

## Error handling

| Scenario | UI |
|---|---|
| Empty city | Inline validation, no request is sent |
| Unknown city (1006) | "City not found" |
| Invalid / disabled key (2006–2009) | "API configuration error" |
| Rate limit (HTTP 429) | "Too many requests" + retry |
| Offline | "No internet connection" + retry |
| 5xx / malformed payload | "Weather service unavailable" / generic + retry |

Previous weather stays on screen when a new search fails, stale responses are
dropped via an `AbortController` plus a request-id check, and the retry action
always retries the city that just failed.
