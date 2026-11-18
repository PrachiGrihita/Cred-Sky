/**
 * DOM rendering layer. All UI mutations live here so the controller in app.js
 * stays focused on state and requests.
 */

import { humidityNote, uvNote, windNote } from "./cred.js";

const ARC_LENGTH = 2 * Math.PI * 58; // r=58 in the score ring
const THEME_COLOR = "#0a0f1e";

const ICONS = {
  snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8"/><path d="M9.6 4.6 12 7l2.4-2.4M9.6 19.4 12 17l2.4 2.4M4.2 10.9 6.8 9.6 5.9 6.9M19.8 13.1l-2.6 1.3.9 2.7M19.8 10.9 17.2 9.6l.9-2.7M4.2 13.1l2.6 1.3-.9 2.7"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2.2M12 19.4v2.2M4.2 12H2M22 12h-2.2M6.3 6.3 4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 14.5a4 4 0 0 1 .3-8 5.4 5.4 0 0 1 10.3 1.2 3.4 3.4 0 0 1-.5 6.8"/><path d="M8.6 17.4 7.4 20M12.6 17.4 11.4 20M16.6 17.4 15.4 20"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.6h11.2a3 3 0 1 0-3-3"/><path d="M3 12.6h15.4"/><path d="M3 16.6h9.2a3 3 0 1 1-3 3"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8l1.9 5.6 5.6 1.9-5.6 1.9L12 17.8l-1.9-5.6L4.5 10.3l5.6-1.9L12 2.8Z"/><path d="M18.6 16.2l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></svg>`,
};

const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("city-input"),
  submit: document.getElementById("search-btn"),
  fieldError: document.getElementById("search-error"),
  chips: document.getElementById("popular-cities"),
  status: document.getElementById("status-region"),

  alert: document.getElementById("error-panel"),
  alertTitle: document.getElementById("error-title"),
  alertText: document.getElementById("error-text"),
  retry: document.getElementById("retry-btn"),

  dashboard: document.getElementById("dashboard"),
  skeleton: document.getElementById("skeleton"),
  content: document.getElementById("content"),

  hero: document.getElementById("hero"),
  insight: document.getElementById("insight"),

  cityName: document.getElementById("city-name"),
  cityRegion: document.getElementById("city-region"),
  localTime: document.getElementById("local-time"),
  localDate: document.getElementById("local-date"),
  icon: document.getElementById("condition-icon"),
  tempC: document.getElementById("temp-c"),
  feelsLike: document.getElementById("feels-like"),
  conditionText: document.getElementById("condition-text"),
  tempF: document.getElementById("temp-f"),

  scoreArc: document.getElementById("score-arc"),
  scoreNumber: document.getElementById("score-number"),
  scoreGrade: document.getElementById("score-grade"),
  scoreCaption: document.getElementById("score-caption"),

  humidityValue: document.getElementById("humidity-value"),
  humidityNote: document.getElementById("humidity-note"),
  windValue: document.getElementById("wind-value"),
  windNote: document.getElementById("wind-note"),
  uvValue: document.getElementById("uv-value"),
  uvNote: document.getElementById("uv-note"),

  personalityIcon: document.getElementById("personality-icon"),
  personalityTitle: document.getElementById("personality-title"),
  personalityDesc: document.getElementById("personality-desc"),
  personalityBasis: document.getElementById("personality-basis"),

  cloud: document.getElementById("cloud-value"),
  visibility: document.getElementById("visibility-value"),
  pressure: document.getElementById("pressure-value"),
  windDetail: document.getElementById("wind-detail"),
  tempFDetail: document.getElementById("temp-f-detail"),
  updated: document.getElementById("updated-value"),

  jsonMeta: document.getElementById("json-meta"),
  jsonOutput: document.getElementById("json-output"),
  copy: document.getElementById("copy-btn"),
  copyLabel: document.getElementById("copy-label"),
  tabs: Array.from(document.querySelectorAll(".tab")),
};

/* -------------------------------------------------------------- formatters */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseApiDate(value) {
  // WeatherAPI returns local-to-the-city strings: "2026-11-18 13:12"
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(value || ""));
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return { year: Number(y), month: Number(m), day: Number(d), hour: Number(hh), minute: Number(mm), date };
}

function to12Hour(hour, minute) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatTime(value) {
  const parsed = parseApiDate(value);
  return parsed ? to12Hour(parsed.hour, parsed.minute) : "—";
}

function formatShortDate(value) {
  const parsed = parseApiDate(value);
  if (!parsed) return "—";
  return `${DAYS[parsed.date.getDay()]}, ${parsed.day} ${MONTHS[parsed.month - 1]}`;
}

function formatUpdated(value) {
  const parsed = parseApiDate(value);
  if (!parsed) return "—";
  return `${parsed.day} ${MONTHS[parsed.month - 1]}, ${to12Hour(parsed.hour, parsed.minute)}`;
}

function round(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function placeName(location) {
  const name = location?.name || "";
  const region = location?.region || "";
  const country = location?.country || "";
  const parts = [region && region !== name ? region : "", country].filter(Boolean);
  return { name: name || "—", region: parts.length ? parts.join(", ") : "—" };
}

/* ----------------------------------------------------------------- chips */

export function renderCityChips(cities, onSelect) {
  els.chips.replaceChildren(
    ...cities.map((city) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.city = city;
      button.textContent = city;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => onSelect(city));
      return button;
    }),
  );
}

export function setActiveCity(city) {
  const target = String(city || "").trim().toLowerCase();
  els.chips.querySelectorAll(".chip").forEach((chip) => {
    const active = chip.dataset.city.toLowerCase() === target;
    chip.setAttribute("aria-pressed", String(active));
  });
}

export function setInputValue(value) {
  els.input.value = value;
}

/* ------------------------------------------------------------ async states */

export function setLoading(mode) {
  const isInitial = mode === "initial";
  els.dashboard.setAttribute("aria-busy", String(Boolean(mode)));
  els.submit.classList.toggle("is-loading", Boolean(mode));
  els.submit.setAttribute("aria-busy", String(Boolean(mode)));
  els.skeleton.hidden = !isInitial;
  els.content.hidden = isInitial;
  els.content.classList.toggle("is-refreshing", mode === "refresh");
}

/** Clears every "busy" affordance without revealing the dashboard. */
export function stopLoading() {
  els.dashboard.setAttribute("aria-busy", "false");
  els.submit.classList.remove("is-loading");
  els.submit.removeAttribute("aria-busy");
  els.skeleton.hidden = true;
  els.content.classList.remove("is-refreshing");
}

export function showDashboard() {
  stopLoading();
  els.content.hidden = false;
}

export function setFieldError(message) {
  if (!message) {
    els.fieldError.hidden = true;
    els.fieldError.textContent = "";
    els.input.removeAttribute("aria-invalid");
    return;
  }
  els.fieldError.hidden = false;
  els.fieldError.textContent = message;
  els.input.setAttribute("aria-invalid", "true");
  els.input.focus();
}

export function clearFieldError() {
  setFieldError("");
}

export function showError(title, message, { retryable = false } = {}) {
  els.alert.hidden = false;
  els.alertTitle.textContent = title;
  els.alertText.textContent = message;
  els.retry.hidden = !retryable;
}

export function hideError() {
  els.alert.hidden = true;
  els.retry.hidden = true;
}

export function announce(message) {
  els.status.textContent = "";
  // Force screen readers to notice repeated messages.
  window.setTimeout(() => {
    els.status.textContent = message;
  }, 60);
}

/* --------------------------------------------------------------- rendering */

export function renderWeather(data, interpretation, { receivedAt } = {}) {
  const location = data.location || {};
  const current = data.current || {};
  const { name, region } = placeName(location);
  const { personality, score } = interpretation;

  // Location + time
  els.cityName.textContent = name;
  els.cityRegion.textContent = region;
  els.localTime.textContent = formatTime(location.localtime);
  els.localDate.textContent = formatShortDate(location.localtime);

  // Reading
  els.tempC.textContent = round(current.temp_c);
  els.tempF.textContent = `${round(current.temp_f)}°F`;
  els.conditionText.textContent = current.condition?.text || "—";
  els.feelsLike.textContent = `Feels like ${round(current.feelslike_c)}°C`;

  if (current.condition?.icon) {
    els.icon.src = `https:${current.condition.icon}`.replace("64x64", "128x128");
    els.icon.alt = current.condition.text || "Current weather icon";
    els.icon.dataset.empty = "false";
  } else {
    els.icon.removeAttribute("src");
    els.icon.alt = "";
    els.icon.dataset.empty = "true";
  }

  // Score gauge
  els.hero.dataset.tone = personality.tone;
  els.insight.dataset.tone = personality.tone;
  els.scoreNumber.textContent = String(score.value);
  els.scoreGrade.textContent = `${score.label} · ${score.grade}`;
  els.scoreCaption.textContent = score.note;
  els.scoreArc.style.setProperty("--tone-color", score.color);
  els.scoreArc.style.strokeDashoffset = String(ARC_LENGTH * (1 - score.value / 100));

  // Primary metrics
  els.humidityValue.textContent = round(current.humidity);
  els.humidityNote.textContent = humidityNote(current.humidity);
  els.windValue.textContent = round(current.wind_kph);
  els.windNote.textContent = windNote(current.wind_kph);
  els.uvValue.textContent = round(current.uv, 1);
  els.uvNote.textContent = uvNote(current.uv);

  // Personality
  els.personalityIcon.innerHTML = ICONS[personality.icon] || ICONS.spark;
  els.personalityTitle.textContent = personality.title;
  els.personalityDesc.textContent = personality.description;
  els.personalityBasis.textContent = personality.rule;

  // Secondary details
  els.cloud.textContent = `${round(current.cloud)}%`;
  els.visibility.textContent = `${round(current.vis_km, 1)} km`;
  els.pressure.textContent = `${round(current.pressure_mb)} mb`;
  els.windDetail.textContent = `${round(current.wind_kph)} km/h ${current.wind_dir || ""}`.trim();
  els.tempFDetail.textContent = `${round(current.temp_f, 1)}°F`;
  els.updated.textContent = formatUpdated(current.last_updated);

  document.title = `${round(current.temp_c)}°C · ${name} — SKY CRED`;
  els.copy.disabled = false;
  if (receivedAt) {
    els.jsonMeta.dataset.receivedAt = receivedAt.toISOString();
  }
}

/* ------------------------------------------------------------ JSON viewer */

export const jsonViewer = (() => {
  let view = "formatted";
  let formatted = "";
  let raw = "";
  let meta = "";

  function paint() {
    const text = view === "formatted" ? formatted : raw;
    els.jsonOutput.textContent = text || "Waiting for the first successful response…";
    els.jsonMeta.textContent = meta;
    els.copy.disabled = !text;
    els.tabs.forEach((tab) => {
      const active = tab.dataset.view === view;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
  }

  function set(payload, rawText, receivedAt) {
    formatted = JSON.stringify(payload, null, 2);
    raw = rawText;
    const size = new Blob([rawText]).size;
    const when = new Date(receivedAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    meta = `${(size / 1024).toFixed(1)} KB · fetched at ${when} · ${rawText.length} chars`;
    paint();
  }

  function select(next) {
    view = next;
    paint();
  }

  async function copy() {
    const text = view === "formatted" ? formatted : raw;
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers/contexts without the async clipboard API.
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      if (!ok) return false;
    }
    els.copyLabel.textContent = "Copied";
    window.setTimeout(() => {
      els.copyLabel.textContent = "Copy";
    }, 1600);
    return true;
  }

  els.tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab.dataset.view));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const next = (index + (event.key === "ArrowRight" ? 1 : -1) + els.tabs.length) % els.tabs.length;
      els.tabs[next].focus();
      select(els.tabs[next].dataset.view);
    });
  });

  els.copy.addEventListener("click", copy);

  return { set, select, copy, get view() { return view; } };
})();

export { els, THEME_COLOR };
