const FORECAST = "https://api.open-meteo.com/v1/forecast";
const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";

const cache = new Map();
const TTL = 10 * 60 * 1000;

async function getJson(url, signal) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const data = await res.json();
  cache.set(url, { data, at: Date.now() });
  return data;
}

export function fetchForecast(lat, lon) {
  const q = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: "precipitation_probability,precipitation",
    current: "temperature_2m",
    timezone: "auto",
    forecast_days: 2,
  });
  return getJson(`${FORECAST}?${q}`);
}

const PLACE_CODES = /^(PPL|PPLA\d?|PPLC|ADM[234])$/;

export async function searchCities(name, signal) {
  const q = new URLSearchParams({ name, count: 10, language: "en", format: "json" });
  const data = await getJson(`${GEOCODE}?${q}`, signal);
  return (data.results ?? []).filter((c) => PLACE_CODES.test(c.feature_code ?? "")).slice(0, 5);
}
