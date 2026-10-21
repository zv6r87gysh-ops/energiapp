import type { Household } from "./models";
import { demoSeries, daily } from "./demo";
import { cost, forecast, savings } from "./energy";
/** Fixed reference instant: 2026-10-21 14:00 Europe/Stockholm. */
export function demoMetrics(home: Household) {
  const prices = demoSeries(96, home.region);
  const today = prices.slice(0, 56);
  const dayEnergy = today.reduce((s, p) => s + p.power * 0.25, 0);
  const elapsed = 20 + 14 / 24;
  const rows = daily.slice(0, 21).map((r, i) => {
    const energy = i === 20 ? dayEnergy : r.energy;
    return {
      ...r,
      energy,
      cost:
        cost(energy, 62, home.contract, home.tariff, false).total +
        (cost(0, 0, home.contract, home.tariff).fixed / 31) *
          (i === 20 ? 14 / 24 : 1),
    };
  });
  const monthEnergy = rows.reduce((s, r) => s + r.energy, 0);
  const spent = rows.reduce((s, r) => s + r.cost, 0);
  const prediction = forecast(spent, elapsed, 31);
  const baseline = cost(150, 100, home.contract, home.tariff, false).total;
  const optimized = cost(150, 45, home.contract, home.tariff, false).total;
  const saving = savings(baseline, optimized);
  const savingsRows = rows.map((r, i) => ({
    ...r,
    saving: [2, 5, 9, 12, 16, 19].includes(i) ? saving.amount / 6 : 0,
  }));
  return {
    prices,
    dayEnergy,
    monthEnergy,
    spent,
    prediction,
    rows,
    savingsRows,
    baseline,
    optimized,
    saving,
    elapsed,
    projectedEnergy: (monthEnergy / elapsed) * 31,
    currentPower: prices[56].power + (home.charging ? 6 : 0),
  };
}
