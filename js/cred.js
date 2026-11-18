/**
 * Weather interpretation engine (FR-05).
 *
 * Turns raw measurements into:
 *  - a "sky credit" score (0-100) used by the hero gauge
 *  - a weather personality (title + recommendation)
 *
 * Rules are ordered by priority: the first matching rule wins, which keeps
 * overlapping conditions deterministic.
 */

import { THRESHOLDS } from "./config.js";

export const PERSONALITIES = Object.freeze({
  freeze: {
    id: "freeze",
    title: "Freeze Frame",
    description: "Bone-chilling cold. Bundle up tight.",
    tone: "cold",
    icon: "snow",
  },
  sun: {
    id: "sun",
    title: "Sun Alert",
    description: "Stay hydrated and avoid excessive sun exposure.",
    tone: "hot",
    icon: "sun",
  },
  rain: {
    id: "rain",
    title: "Rain Check",
    description: "Carry an umbrella before stepping out.",
    tone: "rain",
    icon: "rain",
  },
  wind: {
    id: "wind",
    title: "Breezy Mode",
    description: "Expect strong winds. Dress accordingly.",
    tone: "wind",
    icon: "wind",
  },
  perfect: {
    id: "perfect",
    title: "Perfect Day",
    description: "Great weather to step outside.",
    tone: "great",
    icon: "spark",
  },
});

const GRADES = [
  { min: 90, label: "Excellent", letter: "A+", color: "#34d399" },
  { min: 75, label: "Good", letter: "A", color: "#6ee7ff" },
  { min: 60, label: "Fair", letter: "B", color: "#fbbf24" },
  { min: 40, label: "Poor", letter: "C", color: "#fb923c" },
  { min: 0, label: "Risky", letter: "D", color: "#f87171" },
];

const RAIN_TEXT = /rain|drizzle|shower|thunder|storm|sleet/i;

/**
 * Resolve the personality for the current conditions.
 * Priority: snow/freeze → extreme heat → rain → strong wind → pleasant.
 */
export function resolvePersonality(current) {
  const code = Number(current?.condition?.code);
  const temp = Number(current?.temp_c);
  const wind = Number(current?.wind_kph);
  const precip = Number(current?.precip_mm) || 0;
  const text = String(current?.condition?.text || "");

  if (THRESHOLDS.snowCodes.includes(code) || (Number.isFinite(temp) && temp <= THRESHOLDS.freezeMaxC)) {
    return { ...PERSONALITIES.freeze, rule: `Temperature ${formatNumber(temp)}°C (≤ ${THRESHOLDS.freezeMaxC}°C)` };
  }

  if (Number.isFinite(temp) && temp >= THRESHOLDS.sunMinC) {
    return { ...PERSONALITIES.sun, rule: `Temperature ${formatNumber(temp)}°C (≥ ${THRESHOLDS.sunMinC}°C)` };
  }

  if (THRESHOLDS.rainCodes.includes(code) || precip > 0.2 || RAIN_TEXT.test(text)) {
    return { ...PERSONALITIES.rain, rule: `Precipitation reported: ${text || "rain"}` };
  }

  if (Number.isFinite(wind) && wind >= THRESHOLDS.windMinKph) {
    return { ...PERSONALITIES.wind, rule: `Wind ${formatNumber(wind)} km/h (≥ ${THRESHOLDS.windMinKph} km/h)` };
  }

  return {
    ...PERSONALITIES.perfect,
    rule: `${formatNumber(temp)}°C · ${text || "clear"} · ${formatNumber(wind)} km/h wind`,
  };
}

/**
 * Derive a 0-100 "sky credit" score. Purely a presentation of comfort and
 * hazard factors; it is not a real credit score.
 */
export function computeScore(current) {
  const temp = Number(current?.temp_c);
  const wind = Number(current?.wind_kph) || 0;
  const uv = Number(current?.uv) || 0;
  const humidity = Number(current?.humidity) || 0;
  const cloud = Number(current?.cloud) || 0;
  const precip = Number(current?.precip_mm) || 0;
  const reasons = [];
  let score = 100;

  // Thermal comfort: 22°C–27°C is ideal.
  const deviation = temp < 22 ? 22 - temp : Math.max(0, temp - 27);
  if (deviation > 0) {
    const penalty = Math.min(42, deviation * 2.6);
    score -= penalty;
    reasons.push({ label: temp > 27 ? "heat" : "cold", points: Math.round(penalty) });
  }

  // Wind above 20 km/h starts to bite.
  if (wind > 20) {
    const penalty = Math.min(18, (wind - 20) * 0.55);
    score -= penalty;
    reasons.push({ label: "wind", points: Math.round(penalty) });
  }

  // UV above 5 is worth flagging.
  if (uv > 5) {
    const penalty = Math.min(16, (uv - 5) * 2.4);
    score -= penalty;
    reasons.push({ label: "UV", points: Math.round(penalty) });
  }

  // Any precipitation costs.
  if (precip > 0) {
    const penalty = Math.min(20, 8 + precip * 4);
    score -= penalty;
    reasons.push({ label: "rain", points: Math.round(penalty) });
  }

  // Humidity outside the comfortable band (30–65%).
  if (humidity > 65) {
    const penalty = Math.min(10, (humidity - 65) * 0.25);
    score -= penalty;
    reasons.push({ label: "humidity", points: Math.round(penalty) });
  } else if (humidity < 30) {
    const penalty = Math.min(8, (30 - humidity) * 0.2);
    score -= penalty;
    reasons.push({ label: "dry air", points: Math.round(penalty) });
  }

  // Heavy overcast skies are a small mood tax.
  if (cloud > 80) {
    score -= 4;
    reasons.push({ label: "overcast", points: 4 });
  }

  const value = Math.max(3, Math.min(100, Math.round(score)));
  const grade = GRADES.find((g) => value >= g.min);
  const top = reasons.filter((r) => r.points >= 2).sort((a, b) => b.points - a.points).slice(0, 2);

  return {
    value,
    grade: grade.letter,
    label: grade.label,
    color: grade.color,
    reasons,
    note: top.length
      ? `Docked for ${top.map((r) => `${r.label} (−${r.points})`).join(" and ")}.`
      : "No deductions — clean sky, clean record.",
  };
}

/** Combined interpretation used by the UI. */
export function interpretWeather(data) {
  const current = data?.current ?? {};
  return {
    personality: resolvePersonality(current),
    score: computeScore(current),
  };
}

/* ----------------------------------------------------------- descriptors */

export function humidityNote(value) {
  const v = Number(value) || 0;
  if (v < 30) return "Dry air";
  if (v <= 60) return "Comfortable";
  if (v <= 80) return "Humid";
  return "Very humid";
}

export function windNote(value) {
  const v = Number(value) || 0;
  if (v < 6) return "Calm";
  if (v < 20) return "Light breeze";
  if (v < 39) return "Moderate breeze";
  if (v < 62) return "Strong winds";
  return "Gale force";
}

export function uvNote(value) {
  const v = Number(value) || 0;
  if (v < 3) return "Low exposure";
  if (v < 6) return "Moderate";
  if (v < 8) return "High — use SPF";
  if (v < 11) return "Very high";
  return "Extreme";
}

function formatNumber(value) {
  return Number.isFinite(value) ? String(Math.round(value * 10) / 10) : "—";
}
