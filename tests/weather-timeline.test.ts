import { it, expect } from "vitest";
import {
  threeHourlyWeather,
  upcomingWeather,
  weatherSymbol,
} from "../lib/weather/timeline";
import { weatherFixture } from "./fixtures/weather";
it("shows eight Swedish clock times on normal, summer and winter clock-change days", () => {
  for (const date of ["2026-10-21", "2026-03-29", "2026-10-25"]) {
    const slots = threeHourlyWeather(weatherFixture(), date);
    expect(slots.map((s) => s.time)).toEqual([
      "00:00",
      "03:00",
      "06:00",
      "09:00",
      "12:00",
      "15:00",
      "18:00",
      "21:00",
    ]);
  }
});
it("keeps missing past hours empty and uses only exact provider timestamps", () => {
  const slots = threeHourlyWeather(weatherFixture(), "2026-10-21");
  expect(slots.slice(0, 4).every((s) => s.forecast === null)).toBe(true);
  expect(slots[4].forecast?.temperature).toBe(10);
  expect(slots[4].timestamp).toBe("2026-10-21T10:00:00.000Z");
});
it("maps provider conditions, night, precipitation and missing symbols without guessing", () => {
  expect(weatherSymbol("clearsky_day").label).toBe("Soligt");
  expect(weatherSymbol("clearsky_night")).toMatchObject({
    kind: "clear",
    night: true,
    label: "Klart",
  });
  expect(weatherSymbol("partlycloudy_night")).toMatchObject({
    kind: "partly",
    night: true,
  });
  expect(weatherSymbol("cloudy").kind).toBe("cloud");
  expect(weatherSymbol("heavyrainshowersandthunder_day").kind).toBe("thunder");
  expect(weatherSymbol("lightrainshowers_day").label).toBe("Lätt regn");
  expect(weatherSymbol("sleet").kind).toBe("sleet");
  expect(weatherSymbol("snow").kind).toBe("snow");
  expect(weatherSymbol("fog").kind).toBe("fog");
  expect(weatherSymbol(undefined).kind).toBe("unknown");
  expect(weatherSymbol("unrecognized").kind).toBe("unknown");
});

it.each([
  "2026-10-21T22:37:00Z",
  "2026-03-28T23:37:00Z",
  "2026-10-24T23:37:00Z",
])("shows only the next 24 hours across midnight and DST: %s", (instant) => {
  const now = Date.parse(instant);
  const slots = upcomingWeather(weatherFixture(10, now), now);
  expect(slots).toHaveLength(8);
  expect(
    slots.every(
      (s) =>
        Date.parse(s.timestamp) >= now &&
        Date.parse(s.timestamp) < now + 86400000,
    ),
  ).toBe(true);
  expect(slots.every((s) => s.forecast !== null)).toBe(true);
  expect(Date.parse(slots[0].timestamp)).toBe(
    Math.ceil(now / 3600000) * 3600000,
  );
  for (let i = 1; i < slots.length; i++)
    expect(
      Date.parse(slots[i].timestamp) - Date.parse(slots[i - 1].timestamp),
    ).toBe(3 * 3600000);
});
