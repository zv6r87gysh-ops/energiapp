import { z } from "zod";
import { swedishDate, dayBounds } from "../prices/time";
const entry = z.object({
  date: z.iso.date(),
  energy: z.number().finite().nonnegative(),
  through: z.number().finite(),
});
export type EnergyLedger = z.infer<typeof entry>[];
export function readLedger(raw: string | null): EnergyLedger {
  try {
    return z.array(entry).parse(JSON.parse(raw ?? "[]"));
  } catch {
    return [];
  }
}
export function recordEnergy(
  ledger: EnergyLedger,
  now: number,
  energy: number,
): EnergyLedger {
  const date = swedishDate(new Date(now));
  return [
    ...ledger.filter(
      (e) => e.date !== date && e.date.slice(0, 7) === date.slice(0, 7),
    ),
    { date, energy, through: now },
  ];
}
export function energyTotals(ledger: EnergyLedger, now: number, today: number) {
  const date = swedishDate(new Date(now));
  const entries = recordEnergy(ledger, now, today);
  return {
    today,
    month: entries.reduce((sum, e) => sum + e.energy, 0),
    days: entries.length,
    expectedDays: Number(date.slice(8)),
    partialDays: entries.filter(
      (e) => e.date !== date && dayBounds(e.date).end - e.through > 10000,
    ).length,
  };
}
export type EnergyTotals = ReturnType<typeof energyTotals>;
