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
