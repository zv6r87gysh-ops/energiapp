import { expect, it } from "vitest";
import { rollingPrices } from "../lib/prices/chart";
it("covers twelve elapsed hours on either side of now across midnight and DST", () => {
  for (const time of [
    "2026-11-16T22:00:00Z",
    "2026-10-25T01:00:00Z",
    "2026-03-29T01:00:00Z",
  ]) {
    const now = Date.parse(time),
      points = rollingPrices([], now);
    expect(points).toHaveLength(96);
    expect(Date.parse(points[0].start)).toBe(now - 12 * 3600000);
    expect(Date.parse(points[48].start)).toBe(now);
    expect(Date.parse(points[95].end)).toBe(now + 12 * 3600000);
    expect(points.every((p) => p.ore === null)).toBe(true);
  }
});
it("preserves published negative and zero prices and leaves missing periods empty", () => {
  const now = Date.parse("2026-11-16T22:00:00Z");
  const points = rollingPrices(
    [
      {
        start: new Date(now).toISOString(),
        end: new Date(now + 900000).toISOString(),
        ore: 0,
      },
      {
        start: new Date(now + 900000).toISOString(),
        end: new Date(now + 1800000).toISOString(),
        ore: -10,
      },
    ],
    now,
  );
  expect(points[48].ore).toBe(0);
  expect(points[49].ore).toBe(-10);
  expect(points[50].ore).toBeNull();
});
