import type { ElectricityContract, GridTariff } from "./models";
export const money = (value: number) =>
  new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);
export const number = (value: number, digits = 1) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: digits }).format(
    value,
  );
// All input rates are exclusive of VAT. Energy tax is included exactly once.
export function cost(
  kwh: number,
  spotOre: number,
  c: ElectricityContract,
  g: GridTariff,
  includeFixed = true,
) {
  const energy =
    (kwh * (spotOre + c.markup + g.variable + g.tax + g.timeBased)) / 100;
  const fixed = includeFixed
    ? c.monthly + g.monthly + g.demand - c.discount
    : 0;
  return {
    energy: energy * (1 + c.vat / 100),
    fixed: fixed * (1 + c.vat / 100),
    total: (energy + fixed) * (1 + c.vat / 100),
  };
}
export function savings(baseline: number, optimized: number) {
  return {
    amount: baseline - optimized,
    percent: baseline === 0 ? 0 : ((baseline - optimized) / baseline) * 100,
  };
}
export function forecast(toDate: number, elapsed: number, days: number) {
  if (elapsed <= 0 || days < elapsed) throw Error("Ogiltig period");
  const total = (toDate / elapsed) * days;
  return {
    total,
    low: total * 0.85,
    high: total * 1.15,
    remaining: total - toDate,
  };
}
export function quarterSlots(start: string, end: string) {
  const a = Date.parse(start),
    b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a)
    throw Error("Ogiltiga tidsstämplar");
  return Array.from({ length: Math.floor((b - a) / 900000) }, (_, i) =>
    new Date(a + i * 900000).toISOString(),
  );
}
export function stockholm(utc: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(utc));
}
export function planCharging(
  prices: { ore: number; timestamp: string }[],
  battery: number,
  soc: number,
  target: number,
  ac: number,
  loss: number,
  maxPrice = Infinity,
) {
  const needed =
    Math.max(0, (battery * (target - soc)) / 100) / (1 - loss / 100);
  const slots = [...prices]
    .filter((p) => p.ore <= maxPrice)
    .sort((a, b) => a.ore - b.ore);
  let remaining = needed;
  const selected = [];
  for (const slot of slots) {
    if (remaining <= 0) break;
    const kwh = Math.min(remaining, ac * 0.25);
    selected.push({ ...slot, kwh });
    remaining -= kwh;
  }
  return {
    needed,
    selected: selected.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    missing: Math.max(0, remaining),
    spotCost: selected.reduce((s, p) => s + (p.kwh * p.ore) / 100, 0),
    hours: needed / ac,
  };
}
