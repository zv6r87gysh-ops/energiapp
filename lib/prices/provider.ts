import { z } from "zod";
import { dayBounds } from "./time";
import type { PriceArea, PriceDay } from "./contracts";
// Official API documentation and live SE1–SE4 quarter-day responses verified 2026-10-21.
const providerSchema = z.array(
  z.object({
    SEK_per_kWh: z.number().finite(),
    time_start: z.iso.datetime({ offset: true }),
    time_end: z.iso.datetime({ offset: true }),
  }),
);
export function parsePriceDay(
  raw: unknown,
  area: PriceArea,
  date: string,
  fetchedAt: string,
): PriceDay {
  const rows = providerSchema.parse(raw);
  const bounds = dayBounds(date);
  const expected = (bounds.end - bounds.start) / 900000;
  if (rows.length !== expected)
    throw Error("Källan innehåller inte ett komplett kvartsprisdygn");
  const intervals = rows
    .map((row) => ({
      start: new Date(row.time_start).toISOString(),
      end: new Date(row.time_end).toISOString(),
      ore: row.SEK_per_kWh * 100,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < intervals.length; i++) {
    const row = intervals[i];
    if (
      Date.parse(row.start) !== bounds.start + i * 900000 ||
      Date.parse(row.end) !== bounds.start + (i + 1) * 900000
    )
      throw Error("Fel datum, luckor eller överlappande kvartar i prisdata");
  }
  return {
    area,
    date,
    source: "Elprisetjustnu.se",
    sourceUrl: "https://www.elprisetjustnu.se/elpris-api",
    fetchedAt,
    intervals,
  };
}
export function providerUrl(area: PriceArea, date: string) {
  return `https://www.elprisetjustnu.se/api/v1/prices/${date.slice(0, 4)}/${date.slice(5)}_${area}.json`;
}
