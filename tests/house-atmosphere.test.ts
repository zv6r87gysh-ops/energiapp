import { it, expect } from "vitest";
import { houseAtmosphere, solarAltitude } from "../lib/scene/atmosphere";
import { lightingPower } from "../lib/lighting/automation";
import { defaultSmartControl, smartControlSchema } from "../lib/smart-control";
import { weatherFixture, weatherNow } from "./fixtures/weather";
const stockholm = { latitude: 59.3173, longitude: 18.255 };
it("calculates seasonal solar altitude, night and the midnight sun without fixed local hours", () => {
  expect(
    solarAltitude(Date.parse("2026-06-21T11:00:00Z"), stockholm),
  ).toBeGreaterThan(50);
  expect(
    solarAltitude(Date.parse("2026-12-21T11:00:00Z"), stockholm),
  ).toBeLessThan(10);
  expect(
    solarAltitude(Date.parse("2026-10-21T22:00:00Z"), stockholm),
  ).toBeLessThan(-6);
  expect(
    solarAltitude(Date.parse("2026-06-21T22:00:00Z"), {
      latitude: 67.86,
      longitude: 20.22,
    }),
  ).toBeGreaterThan(-0.833);
  expect(
    solarAltitude(Date.parse("2026-12-21T11:00:00Z"), {
      latitude: 67.86,
      longitude: 20.22,
    }),
  ).toBeLessThan(-0.833);
});
it("renders only real forecast conditions and never invents snow from the season", () => {
  const weather = weatherFixture();
  weather.hours.forEach((h) => {
    h.symbol = "rain";
  });
  const rain = houseAtmosphere(weatherNow, weather, stockholm);
  expect(rain.precipitation).toBe("rain");
  expect(rain.sunny).toBe(false);
  expect(rain.season).toBe("autumn");
  weather.hours.forEach((h) => {
    h.symbol = "snow";
  });
  expect(houseAtmosphere(weatherNow, weather, stockholm).precipitation).toBe(
    "snow",
  );
  expect(
    houseAtmosphere(weatherNow + 8 * 3600000, weather, stockholm).hasWeather,
  ).toBe(false);
  expect(
    houseAtmosphere(weatherNow + 8 * 3600000, weather, stockholm).precipitation,
  ).toBe("none");
  const winter = houseAtmosphere(
    Date.parse("2026-12-21T11:00:00Z"),
    null,
    stockholm,
  );
  expect(winter.season).toBe("winter");
  expect(winter.precipitation).toBe("none");
});
it("uses calculated darkness even when a forecast's symbol says day and handles unknown location", () => {
  const now = Date.parse("2026-10-21T22:00:00Z"),
    w = weatherFixture(8, now);
  w.hours.forEach((h) => {
    h.symbol = "clearsky_day";
  });
  const night = houseAtmosphere(now, w, stockholm);
  expect(night.phase).toBe("night");
  expect(night.sunny).toBe(false);
  expect(night.brightness).toBeLessThan(0.2);
  expect(houseAtmosphere(now, null, null).phase).toBe("unknown");
});
it("switches both independent lighting groups at apparent sunset and sunrise, and waits without location", () => {
  const c = smartControlSchema.parse({
    ...defaultSmartControl(),
    enabled: true,
    categories: ["outdoor-lighting", "pool-lighting"],
  });
  const lights = {
    provider: "plejd" as const,
    previewOn: false,
    poolPreviewOn: false,
  };
  for (const g of ["outdoor", "pool"] as const) {
    expect(lightingPower(lights, c, g, -0.84).on).toBe(true);
    expect(lightingPower(lights, c, g, -0.82).on).toBe(false);
    expect(lightingPower(lights, c, g, null)).toMatchObject({
      on: false,
      mode: "waiting-location",
    });
    expect(
      lightingPower(lights, { ...c, enabled: false }, g, -10),
    ).toMatchObject({ on: false, mode: "paused" });
  }
  expect(
    lightingPower(
      { ...lights, poolPreviewOn: true },
      defaultSmartControl(),
      "pool",
      10,
    ),
  ).toMatchObject({ on: true, mode: "manual" });
});
it("places evening light on the west-facing pool side and morning light behind the house", () => {
  const afternoon = Date.parse("2026-06-21T17:00:00Z"),
    morning = Date.parse("2026-06-21T05:00:00Z");
  const west = houseAtmosphere(
    afternoon,
    weatherFixture(20, afternoon),
    stockholm,
  );
  const east = houseAtmosphere(morning, weatherFixture(15, morning), stockholm);
  expect(west.sunAzimuth).toBeGreaterThan(250);
  expect(west.sunX).toBeLessThan(50);
  expect(west.sunY).toBeGreaterThan(50);
  expect(east.sunX).toBeGreaterThan(50);
  expect(east.sunY).toBeLessThan(50);
});
it("projects midday southerly light onto the right-hand south-facing facade", () => {
  const now = Date.parse("2026-06-21T11:00:00Z");
  const scene = houseAtmosphere(now, weatherFixture(20, now), stockholm);
  expect(scene.sunAzimuth).toBeGreaterThan(160);
  expect(scene.sunAzimuth).toBeLessThan(210);
  expect(scene.sunX).toBeGreaterThan(50);
});
