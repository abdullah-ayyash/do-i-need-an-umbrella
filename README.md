# Do I need an umbrella?

A tiny weather app that answers one question in one word, using the next 12 hours of forecast rather than a single daily number.

**Live demo:** _add your GitHub Pages link here_ · ![CI](../../actions/workflows/ci.yml/badge.svg)

<!-- Add a screenshot or GIF here: docs/screenshot.png -->

## What it does

- Detects your location, or lets you search any city with keyboard-friendly autocomplete.
- Looks at hourly rain probability **and** expected rainfall, then says **Yes**, **Maybe** or **No**.
- Shows an hourly chart so you can see *when* the rain is coming.
- Remembers your last city and °C/°F choice, and follows your light/dark setting.

## Decision rules

| Answer | When (next 12 hours) |
| ------ | -------------------- |
| Yes    | Peak chance ≥ 60%, or ≥ 2 mm total |
| Maybe  | Peak chance ≥ 30%, or ≥ 0.3 mm total |
| No     | Anything lower |

The rules live in `src/logic.js` as pure functions and are covered by unit tests.

## Engineering notes

- **Plain HTML, CSS and JavaScript.** Native ES modules, no build step, hosted as-is on GitHub Pages.
- **Separated concerns:** `logic.js` (pure decisions), `api.js` (fetch and cache), `app.js` (DOM).
- **Safe rendering:** API data is inserted with `textContent`, never `innerHTML`.
- **Accessible:** ARIA combobox with arrow-key navigation, live-region updates, visible focus, reduced-motion support.
- **Resilient:** request timeouts, cancelled stale searches, 10-minute response cache, storage failures handled.
- **CI:** tests run on every push via GitHub Actions.

## Run it

No install or build step. Serve the folder and open it:

```bash
python3 -m http.server   # then visit http://localhost:8000
```

Deploy by enabling **Settings → Pages → Deploy from a branch → main / root**.

Optional: `npm test` runs the unit tests (needs Node 20+; only for development).

## Data

Weather and geocoding by [Open-Meteo](https://open-meteo.com/) (free, no API key).

## Ideas for next

Reverse-geocode the "your location" label, add a 7-day view, make it an installable PWA.
