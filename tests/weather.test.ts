import { learnPoolBehavior } from "../lib/pool/learning";
import { describe, it, expect } from "vitest";
import { parseForecast, parseLocation } from "../lib/weather/provider";
import { weatherHeatingPlan, summarizeWeather } from "../lib/weather/planner";
import {
  weatherNow as now,
  weatherFixture,
  metFixture,
  locationFixture,
  thermalHome,
  thermalPrices,
  telemetryFixture,
} from "./fixtures/weather";
describe("verified weather", () => {
  it("accepts a matched Swedish postcode and rejects wrong country, postcode and coordinates", () => {
    expect(parseLocation(locationFixture, "13230").place).toBe("Saltsjö-Boo");
    expect(() => parseLocation(locationFixture, "11122")).toThrow();
    expect(() =>
      parseLocation(
        { ...locationFixture, "country abbreviation": "NO" },
        "13230",
      ),
    ).toThrow();
    expect(() =>
      parseLocation(
        {
          ...locationFixture,
          places: [{ ...locationFixture.places[0], latitude: "-90" }],
        },
        "13230",
      ),
    ).toThrow();
  });
  it("validates provider units, current coverage, age and ordering", () => {
    const location = parseLocation(locationFixture, "13230");
    const raw = metFixture();
    expect(
      parseForecast(raw, location, now + 1800000, now).hours[0].temperature,
    ).toBe(10);
    raw.properties.meta.units.air_temperature = "fahrenheit";
    expect(() => parseForecast(raw, location, now + 1800000, now)).toThrow();
    expect(() =>
      parseForecast(metFixture(), location, now + 1800000, now + 8 * 3600000),
    ).toThrow();
    const broken = metFixture();
    broken.properties.timeseries.reverse();
    expect(() => parseForecast(broken, location, now + 1800000, now)).toThrow();
  });
  it("summarizes remaining forecast hours in Swedish calendar days, including winter time", () => {
    const w = weatherFixture(8, Date.parse("2026-10-25T00:00:00Z"));
    expect(
      summarizeWeather(w, "2026-10-25", Date.parse("2026-10-25T00:00:00Z"))
        ?.hours,
    ).toBe(23);
    expect(summarizeWeather(w, "2026-10-28", now)).toBeNull();
  });
});
describe("weather plan using learned actual-device data", () => {
  it("refuses to guess without an actual learned model or fresh matching forecast", () => {
    const home = thermalHome(),
      learning = learnPoolBehavior(null, home.id, now);
    expect(
      weatherHeatingPlan(home, weatherFixture(), thermalPrices(), now, learning)
        .available,
    ).toBe(false);
    const ready = learnPoolBehavior(telemetryFixture(), home.id, now);
    expect(ready.status).toBe("ready");
    expect(
      weatherHeatingPlan(home, null, thermalPrices(), now, ready).available,
    ).toBe(false);
    expect(
      weatherHeatingPlan(
        { ...home, postcode: "11122" },
        weatherFixture(),
        [],
        now,
        ready,
      ).available,
    ).toBe(false);
  });
  it("predicts more cooling in cold weather and respects fixed price pauses", () => {
    const learning = learnPoolBehavior(telemetryFixture(), "demo-home", now);
    const prices = thermalPrices();
    prices.forEach((p, i) => {
      if (i >= 4 && i < 24) p.ore = 150;
    });
    const home = thermalHome();
    home.pool.target = learning.model!.water;
    const cold = weatherHeatingPlan(
      home,
      weatherFixture(0),
      prices,
      now,
      learning,
    );
    const warm = weatherHeatingPlan(
      home,
      weatherFixture(20),
      prices,
      now,
      learning,
    );
    expect(cold.available && warm.available).toBe(true);
    if (!cold.available || !warm.available) return;
    expect(cold.coolingTemperature).toBeLessThan(warm.coolingTemperature!);
    expect(cold.steps[0].action).toContain("Förvärm");
    expect(cold.steps[4].heating).toBe(false);
    expect(cold.steps[4].action).toContain("högt pris");
    expect(cold.coveredHours).toBe(24);
  });
  it("does not propose heat with missing prices, disabled smart or manual pause", () => {
    const learning = learnPoolBehavior(telemetryFixture(), "demo-home", now);
    for (const kind of ["smart", "weather", "manual", "prices"]) {
      const home = thermalHome();
      if (kind === "smart") home.smartControl!.enabled = false;
      if (kind === "weather") home.thermalSettings!.enabled = false;
      if (kind === "manual") home.pool.mode = "Paus";
      const plan = weatherHeatingPlan(
        home,
        weatherFixture(),
        kind === "prices" ? [] : thermalPrices(),
        now,
        learning,
      );
      expect(plan.available).toBe(true);
      if (plan.available) expect(plan.onHours).toBe(0);
    }
  });
  it("stops at forecast gaps and never invents electrical power readings", () => {
    const raw = telemetryFixture();
    const noPower = {
      ...raw,
      readings: raw.readings.map((r) => {
        const copy = { ...r };
        delete copy.electricalKw;
        return copy;
      }),
    };
    const learning = learnPoolBehavior(noPower, "demo-home", now);
    const w = weatherFixture();
    w.hours.splice(2, 1);
    const plan = weatherHeatingPlan(
      thermalHome(),
      w,
      thermalPrices(),
      now,
      learning,
    );
    expect(plan.available).toBe(true);
    if (plan.available) {
      expect(plan.coveredHours).toBe(2);
      expect(plan.poolKwh).toBeNull();
    }
  });
});
