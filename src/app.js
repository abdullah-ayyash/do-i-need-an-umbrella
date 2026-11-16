import { decide, nextHours, toFahrenheit, hourLabel } from "./logic.js";
import { fetchForecast, searchCities } from "./api.js";

const $ = (id) => document.getElementById(id);
const els = {
  form: $("search"), input: $("city"), list: $("suggestions"), status: $("status"),
  answer: $("answer"), detail: $("detail"), chart: $("chart"), place: $("place"),
  temp: $("temp"), unit: $("unit"),
};
const state = { place: null, celsius: true, cities: [], active: -1, abort: null, lastTempC: null };
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

const ADVICE = { YES: "Take one.", MAYBE: "Pack a small one.", NO: "Leave it at home." };
const WORD = { YES: "Yes", MAYBE: "Maybe", NO: "No" };

function setStatus(msg) { els.status.textContent = msg; }

function showTemp() {
  if (state.lastTempC == null) return;
  const c = state.lastTempC;
  els.temp.textContent = state.celsius ? `${Math.round(c)}°C` : `${toFahrenheit(c)}°F`;
}

function render(place, data) {
  const hours = nextHours(data);
  const { verdict, peak, totalMm } = decide(hours);
  document.body.dataset.verdict = verdict.toLowerCase();
  els.answer.textContent = WORD[verdict];
  els.place.textContent = place === "your location" ? "Your location" : place;
  els.detail.textContent = `${ADVICE[verdict]} ${peak.prob}% chance of rain at ${hourLabel(peak.time)}, ${totalMm} mm expected over the next ${hours.length} hours.`;
  state.lastTempC = data.current.temperature_2m;
  showTemp();

  els.chart.replaceChildren(
    ...hours.map((h) => {
      const bar = document.createElement("li");
      if (h === peak) {
        bar.className = "peak";
        const pct = document.createElement("b");
        pct.textContent = `${h.prob}%`;
        bar.append(pct);
      }
      bar.style.setProperty("--p", `${Math.max(h.prob, 3)}%`);
      bar.title = `${hourLabel(h.time)}: ${h.prob}%`;
      const label = document.createElement("span");
      label.textContent = hourLabel(h.time).replace(/\s/g, "");
      bar.append(label);
      return bar;
    })
  );
  setStatus(`${WORD[verdict]}. ${els.detail.textContent}`);
}

async function show(place, lat, lon) {
  state.place = { name: place, lat, lon };
  store.set("umbrella:place", JSON.stringify(state.place));
  document.body.classList.add("loading");
  setStatus("Loading forecast…");
  try {
    render(place, await fetchForecast(lat, lon));
  } catch (err) {
    console.error(err);
    els.detail.textContent = "Couldn't load the forecast. Check your connection and try again.";
    setStatus(els.detail.textContent);
  } finally {
    document.body.classList.remove("loading");
  }
}

function closeList() {
  els.list.hidden = true;
  els.input.setAttribute("aria-expanded", "false");
  els.input.removeAttribute("aria-activedescendant");
  state.active = -1;
}

function renderSuggestions(cities) {
  state.cities = cities;
  els.list.replaceChildren(
    ...cities.map((c, i) => {
      const li = document.createElement("li");
      li.id = `opt-${i}`;
      li.setAttribute("role", "option");
      const strong = document.createElement("strong");
      strong.textContent = c.name;
      li.append(strong, ` ${[c.admin1, c.country].filter(Boolean).join(", ")}`);
      li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(i); });
      return li;
    })
  );
  els.list.hidden = !cities.length;
  els.input.setAttribute("aria-expanded", String(cities.length > 0));
}

function choose(i) {
  const c = state.cities[i];
  if (!c) return;
  els.input.value = c.name;
  closeList();
  state.cities = [];
  show(c.name, c.latitude, c.longitude);
}

function highlight(i) {
  state.active = (i + state.cities.length) % state.cities.length;
  [...els.list.children].forEach((li, n) => li.setAttribute("aria-selected", String(n === state.active)));
  els.input.setAttribute("aria-activedescendant", `opt-${state.active}`);
}

let timer;
els.input.addEventListener("input", () => {
  clearTimeout(timer);
  state.cities = [];
  const q = els.input.value.trim();
  if (q.length < 2) return closeList();
  timer = setTimeout(async () => {
    state.abort?.abort();
    state.abort = new AbortController();
    try {
      renderSuggestions(await searchCities(q, state.abort.signal));
    } catch (err) {
      if (err.name !== "AbortError") closeList();
    }
  }, 250);
});

els.input.addEventListener("keydown", (e) => {
  if (els.list.hidden) return;
  if (e.key === "ArrowDown") { e.preventDefault(); highlight(state.active + 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); highlight(state.active - 1); }
  else if (e.key === "Escape") closeList();
});

els.input.addEventListener("blur", closeList);

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (state.cities.length) return choose(Math.max(state.active, 0));
  const q = els.input.value.trim();
  if (!q) return setStatus("Enter a city name.");
  const [c] = await searchCities(q).catch(() => []);
  c ? show(c.name, c.latitude, c.longitude) : setStatus(`No city found for "${q}".`);
});

els.unit.addEventListener("click", () => {
  state.celsius = !state.celsius;
  store.set("umbrella:celsius", String(state.celsius));
  els.unit.textContent = state.celsius ? "Show °F" : "Show °C";
  showTemp();
});

function init() {
  state.celsius = store.get("umbrella:celsius") !== "false";
  els.unit.textContent = state.celsius ? "Show °F" : "Show °C";
  const saved = JSON.parse(store.get("umbrella:place") ?? "null");
  if (!("geolocation" in navigator)) {
    return saved ? show(saved.name, saved.lat, saved.lon) : setStatus("Search for a city to check the forecast.");
  }
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (p) => show("your location", p.coords.latitude, p.coords.longitude),
    () => (saved ? show(saved.name, saved.lat, saved.lon) : setStatus("Location is off. Search for a city instead.")),
    { timeout: 8000, maximumAge: 600000 }
  );
}
init();
