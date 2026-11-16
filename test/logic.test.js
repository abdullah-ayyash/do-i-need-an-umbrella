import test from "node:test";
import assert from "node:assert/strict";
import { decide, nextHours, startIndex, toFahrenheit } from "../src/logic.js";

const hrs = (probs, mm = 0) =>
  probs.map((prob, i) => ({ time: `2026-01-01T${String(i).padStart(2, "0")}:00`, prob, mm }));

test("clear skies means NO", () => assert.equal(decide(hrs([0, 5, 10])).verdict, "NO"));
test("moderate chance means MAYBE", () => assert.equal(decide(hrs([10, 35, 20])).verdict, "MAYBE"));
test("high chance means YES", () => assert.equal(decide(hrs([10, 70, 20])).verdict, "YES"));
test("low odds but heavy rain still means YES", () => assert.equal(decide(hrs([20, 20, 20], 1)).verdict, "YES"));
test("peak hour is reported", () => assert.equal(decide(hrs([10, 80, 20])).peak.prob, 80));
test("empty forecast throws", () => assert.throws(() => decide([])));

test("startIndex skips past hours", () => {
  const times = ["2026-01-01T08:00", "2026-01-01T09:00", "2026-01-01T10:00"];
  assert.equal(startIndex(times, "2026-01-01T09:15"), 1);
});

test("nextHours slices from the current hour", () => {
  const time = ["2026-01-01T08:00", "2026-01-01T09:00", "2026-01-01T10:00"];
  const data = {
    current: { time: "2026-01-01T09:15" },
    hourly: { time, precipitation_probability: [1, 2, 3], precipitation: [0, 0, 0] },
  };
  assert.deepEqual(nextHours(data, 2).map((h) => h.prob), [2, 3]);
});

test("toFahrenheit", () => assert.equal(toFahrenheit(100), 212));
