import { it, expect } from "vitest";
import {
  learnPoolBehavior,
  learnedTemperatureAfter,
} from "../lib/pool/learning";
import { telemetryFixture, weatherNow } from "./fixtures/weather";
it("learns cooling and heating from temperature and confirmed heat-state windows without user coefficients", () => {
  const learned = learnPoolBehavior(
    telemetryFixture(),
    "demo-home",
    weatherNow,
  );
  expect(learned.status).toBe("ready");
  expect(learned.model?.coolingPerHour).toBeCloseTo(0.01, 4);
  expect(learned.model?.heatingDegreesPerHour).toBeCloseTo(0.7, 3);
  expect(learned.model?.confidence).toBe("preliminär");
  expect(learned.model?.electricalKw).toBe(2);
  if (learned.model)
    expect(
      learnedTemperatureAfter(28, 10, 4, learned.model, false),
    ).toBeLessThan(28);
});
it("does not learn from registration, demos, another household or stale readings", () => {
  expect(
    learnPoolBehavior({ status: "registered" }, "demo-home", weatherNow).status,
  ).toBe("not-connected");
  const raw = telemetryFixture();
  expect(
    learnPoolBehavior({ ...raw, verified: false }, "demo-home", weatherNow)
      .status,
  ).toBe("not-connected");
  expect(learnPoolBehavior(raw, "other-home", weatherNow).status).toBe(
    "not-connected",
  );
  expect(learnPoolBehavior(raw, "demo-home", weatherNow + 3600000).status).toBe(
    "stale",
  );
});
it("waits for enough off/on periods and rejects out-of-order or transition-invalid data", () => {
  const raw = telemetryFixture();
  expect(
    learnPoolBehavior(
      { ...raw, readings: raw.readings.slice(-4) },
      "demo-home",
      weatherNow,
    ).status,
  ).toBe("learning");
  const bad = structuredClone(raw);
  bad.readings[1].at = bad.readings[0].at;
  expect(learnPoolBehavior(bad, "demo-home", weatherNow).status).toBe(
    "invalid",
  );
  const wrong = structuredClone(raw);
  wrong.readings[0].heatingStateSince = new Date(weatherNow).toISOString();
  expect(learnPoolBehavior(wrong, "demo-home", weatherNow).status).toBe(
    "invalid",
  );
});
it("does not combine cover conditions or infer electrical use without an energy meter", () => {
  const raw = telemetryFixture();
  raw.readings.at(-1)!.cover = "open";
  expect(learnPoolBehavior(raw, "demo-home", weatherNow).status).toBe(
    "learning",
  );
  const noMeter = telemetryFixture();
  noMeter.readings.forEach((r) => {
    delete (r as { electricalKw?: number }).electricalKw;
  });
  expect(
    learnPoolBehavior(noMeter, "demo-home", weatherNow).model?.electricalKw,
  ).toBeNull();
});
