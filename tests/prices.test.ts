import { describe, it, expect } from "vitest";
import {
  addDate,
  dayBounds,
  swedishDate,
  intervalAt,
} from "../lib/prices/time";
import { parsePriceDay, providerUrl } from "../lib/prices/provider";
function fixture(date: string) {
  const { start, end } = dayBounds(date);
  return Array.from({ length: (end - start) / 900000 }, (_, i) => ({
    SEK_per_kWh: i === 0 ? -0.25 : 0.5,
    time_start: new Date(start + i * 900000).toISOString(),
    time_end: new Date(start + (i + 1) * 900000).toISOString(),
  }));
}
describe("Verkliga prisers kontrakt och svensk tid", () => {
  it.each([
    ["2026-03-29", 92],
    ["2026-10-25", 100],
    ["2026-10-21", 96],
  ])("validerar hela dygnet %s med %i kvartar", (date, count) => {
    expect(
      parsePriceDay(fixture(date), "SE3", date, new Date().toISOString())
        .intervals,
    ).toHaveLength(count);
  });
  it("konverterar SEK till öre och behåller negativa priser utan moms", () => {
    const data = parsePriceDay(
      fixture("2026-10-21"),
      "SE3",
      "2026-10-21",
      new Date().toISOString(),
    );
    expect(data.intervals[0].ore).toBe(-25);
    expect(data.intervals[1].ore).toBe(50);
  });
  it("avvisar timdata", () =>
    expect(() =>
      parsePriceDay(
        fixture("2026-10-21").filter((_, i) => i % 4 === 0),
        "SE3",
        "2026-10-21",
        new Date().toISOString(),
      ),
    ).toThrow());
  it("avvisar luckor, överlapp och fel dag", () => {
    const rows = fixture("2026-10-21");
    rows[5] = rows[4];
    expect(() =>
      parsePriceDay(rows, "SE3", "2026-10-21", new Date().toISOString()),
    ).toThrow();
    expect(() =>
      parsePriceDay(
        fixture("2026-10-20"),
        "SE3",
        "2026-10-21",
        new Date().toISOString(),
      ),
    ).toThrow();
  });
  it("avvisar trasig data", () =>
    expect(() =>
      parsePriceDay(
        [{ SEK_per_kWh: "50" }],
        "SE3",
        "2026-10-21",
        new Date().toISOString(),
      ),
    ).toThrow());
  it("använder svensk kalender även när UTC är föregående datum", () =>
    expect(swedishDate(new Date("2026-07-01T22:15:00Z"))).toBe("2026-07-02"));
  it("växlar datum över årsskifte", () =>
    expect(addDate("2026-12-31", 1)).toBe("2027-01-01"));
  it("väljer rätt kvart med exklusivt slut", () => {
    const intervals = parsePriceDay(
      fixture("2026-10-21"),
      "SE3",
      "2026-10-21",
      new Date().toISOString(),
    ).intervals;
    expect(intervalAt(intervals, Date.parse(intervals[0].end))).toEqual(
      intervals[1],
    );
  });
  it("bygger endast fast leverantörssökväg", () =>
    expect(providerUrl("SE4", "2026-10-21")).toBe(
      "https://www.elprisetjustnu.se/api/v1/prices/2026/10-21_SE4.json",
    ));
});
