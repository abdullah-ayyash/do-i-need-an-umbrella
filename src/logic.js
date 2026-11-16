// Pure decision logic: no DOM, no network, fully unit-tested.

export const WINDOW_HOURS = 12;

/** Index of the first hourly slot at or after `nowIso` (both local ISO strings). */
export function startIndex(times, nowIso) {
  const hour = nowIso.slice(0, 13);
  const i = times.findIndex((t) => t.slice(0, 13) >= hour);
  return i === -1 ? 0 : i;
}

/** Turn the raw Open-Meteo payload into the next N hours of {time, prob, mm}. */
export function nextHours(data, count = WINDOW_HOURS) {
  const { time, precipitation_probability: prob, precipitation: mm } = data.hourly;
  const from = startIndex(time, data.current.time);
  return time.slice(from, from + count).map((t, i) => ({
    time: t,
    prob: prob[from + i] ?? 0,
    mm: mm[from + i] ?? 0,
  }));
}

/** YES / MAYBE / NO, based on peak probability and total rainfall. */
export function decide(hours) {
  if (!hours.length) throw new Error("No forecast hours available");
  const peak = hours.reduce((a, h) => (h.prob > a.prob ? h : a));
  const totalMm = hours.reduce((sum, h) => sum + h.mm, 0);
  let verdict = "NO";
  if (peak.prob >= 60 || totalMm >= 2) verdict = "YES";
  else if (peak.prob >= 30 || totalMm >= 0.3) verdict = "MAYBE";
  return { verdict, peak, totalMm: Math.round(totalMm * 10) / 10 };
}

export function toFahrenheit(c) {
  return Math.round((c * 9) / 5 + 32);
}

/** Hour label like "2 PM" from a local ISO string. */
export function hourLabel(iso, locale) {
  return new Date(iso).toLocaleTimeString(locale, { hour: "numeric" });
}
