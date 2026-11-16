export type PriceBand = "low" | "middle" | "high";
export const priceBandLabels: Record<PriceBand, string> = {
  low: "Billigt",
  middle: "Mellanpris",
  high: "Dyrt",
};
export function priceBands(prices: number[]) {
  if (!prices.length) return null;
  const min = Math.min(...prices),
    max = Math.max(...prices);
  return {
    low: min + (max - min) / 3,
    high: min + ((max - min) * 2) / 3,
    equal: min === max,
  };
}
export function classifyPrice(
  price: number,
  bands: ReturnType<typeof priceBands>,
): PriceBand {
  if (!bands || bands.equal) return "middle";
  return price <= bands.low ? "low" : price > bands.high ? "high" : "middle";
}

export function rollingPrices(
  intervals: { start: string; end: string; ore: number }[],
  now: number,
) {
  const quarter = 900000;
  const start = Math.floor(now / quarter) * quarter - 12 * 3600000;
  const byStart = new Map(intervals.map((p) => [Date.parse(p.start), p.ore]));
  return Array.from({ length: 96 }, (_, i) => ({
    start: new Date(start + i * quarter).toISOString(),
    end: new Date(start + (i + 1) * quarter).toISOString(),
    ore: byStart.get(start + i * quarter) ?? null,
  }));
}
