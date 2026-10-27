import { expect, it } from "vitest";
import { sunTimes } from "../lib/scene/sun-times";
import { solarAltitude } from "../lib/scene/atmosphere";
import { dayBounds, swedishDate } from "../lib/prices/time";
const place = { latitude: 59.3173, longitude: 18.255 };
it.each(["2026-03-29", "2026-10-25", "2026-10-27", "2026-06-21"])(
  "finds local sunrise and sunset on %s including DST",
  (date) => {
    const times = sunTimes(date, place);
    expect(times.sunrise).not.toBeNull();
    expect(times.sunset).not.toBeNull();
    expect(times.sunrise!).toBeLessThan(times.sunset!);
    for (const t of [times.sunrise!, times.sunset!]) {
      expect(swedishDate(new Date(t))).toBe(date);
      expect(solarAltitude(t, place)).toBeCloseTo(-0.833, 2);
    }
    expect(solarAltitude(times.sunrise! - 60000, place)).toBeLessThan(-0.833);
    expect(solarAltitude(times.sunset! + 60000, place)).toBeLessThan(-0.833);
    const { start, end } = dayBounds(date);
    expect(times.sunrise!).toBeGreaterThan(start);
    expect(times.sunset!).toBeLessThan(end);
  },
);
it("handles polar day and night without invented clock times", () => {
  const kiruna = { latitude: 67.86, longitude: 20.22 };
  expect(sunTimes("2026-06-21", kiruna)).toEqual({
    sunrise: null,
    sunset: null,
    polarDay: true,
  });
  expect(sunTimes("2026-12-21", kiruna)).toEqual({
    sunrise: null,
    sunset: null,
    polarDay: false,
  });
});
