import { z } from "zod";
import type { Household } from "../models";
import {
  categoryActive,
  readSmartControl,
  type SmartCategory,
} from "../smart-control";
import { cost } from "../energy";
import { dayBounds, intervalAt, priceTime, swedishDate } from "../prices/time";
import type { PriceDay } from "../prices/contracts";
export const ruleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fixed"), value: z.number().min(-500).max(5000) }),
  z.object({ type: z.literal("percent"), value: z.number().min(1).max(100) }),
]);
export const simulationSettingsSchema = z.object({
  adults: z.number().int().min(1).max(10),
  children: z.number().int().min(0).max(10),
  poolKwh: z.number().min(0).max(60),
  chargingKwh: z.number().min(0).max(100),
  poolRule: ruleSchema,
  chargingRule: ruleSchema,
});
export type SimulationSettings = z.infer<typeof simulationSettingsSchema>;
export type PriceRule = z.infer<typeof ruleSchema>;
export type PriceInterval = PriceDay["intervals"][number];
export const defaultSimulationSettings: SimulationSettings = {
  adults: 2,
  children: 2,
  poolKwh: 8,
  chargingKwh: 14,
  poolRule: { type: "percent", value: 70 },
  chargingRule: { type: "percent", value: 70 },
};
export function readSimulationSettings(home: {
  simulationSettings?: unknown;
}): SimulationSettings {
  const r = simulationSettingsSchema.safeParse(home.simulationSettings);
  return r.success ? r.data : structuredClone(defaultSimulationSettings);
}
export interface Decision {
  status:
    | "running"
    | "price-paused"
    | "waiting-prices"
    | "manual"
    | "paused"
    | "idle";
  label: string;
  threshold: number | null;
  highest: number | null;
  coverageHours: number;
  reason: string;
}
export function evaluateRule(
  rule: PriceRule,
  prices: PriceInterval[],
  now: number,
): Decision {
  const end = now + 86400000;
  const sorted = prices
    .filter((p) => Date.parse(p.end) > now && Date.parse(p.start) < end)
    .sort((a, b) => a.start.localeCompare(b.start));
  let coveredTo = now;
  for (const p of sorted) {
    if (Date.parse(p.start) > coveredTo) break;
    coveredTo = Math.max(coveredTo, Math.min(end, Date.parse(p.end)));
  }
  const coverageHours = (coveredTo - now) / 3600000;
  const current = intervalAt(prices, now);
  const waiting = (reason: string): Decision => ({
    status: "waiting-prices",
    label: "Inväntar priser",
    threshold: null,
    highest: null,
    coverageHours,
    reason,
  });
  if (!current) return waiting("Aktuellt verifierat kvartpris saknas.");
  if (rule.type === "percent" && coveredTo < end)
    return waiting(
      `Hela kommande 24 timmar är inte publicerade. Tillgängligt: ${coverageHours.toFixed(1)} timmar. Ingen priströskel gissas.`,
    );
  const highest = sorted.length ? Math.max(...sorted.map((p) => p.ore)) : null;
  // When all upcoming prices are non-positive there is no positive price peak to avoid.
  const threshold =
    rule.type === "fixed"
      ? rule.value
      : highest !== null && highest > 0
        ? (highest * rule.value) / 100
        : null;
  const paused = threshold !== null && current.ore + 1e-9 >= threshold;
  return {
    status: paused ? "price-paused" : "running",
    label: paused ? "Pausad · högt pris" : "Kör",
    threshold,
    highest,
    coverageHours,
    reason: paused
      ? `Spotpriset är minst din gräns (${threshold?.toFixed(2)} öre/kWh).`
      : threshold === null
        ? "Kommande priser är noll eller negativa. Ingen positiv pristopp att undvika."
        : "Spotpriset ligger under din gräns.",
  };
}
const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Stockholm",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const hourOf = (time: number) => {
  const f = hourFormatter.format(new Date(time));
  return Number(f.slice(0, 2)) + Number(f.slice(3)) / 60;
};
function householdActivity(time: number) {
  return 0.05 * Math.sin(time / 11000) + 0.035 * Math.sin(time / 3700);
}
export function familyPower(
  time: number,
  adults: number,
  children: number,
  area = 127,
) {
  const h = hourOf(time);
  const people = adults + children;
  const peak = (center: number, width: number) =>
    Math.exp(-((h - center) ** 2) / width);
  const daily =
    0.26 +
    0.045 * people +
    (1 + 0.12 * people) * peak(7.3, 0.85) +
    (1.4 + 0.17 * people) * peak(18, 2.5) +
    0.6 * peak(20.5, 1.5);
  const heating = 0.6 + 0.004 * area;
  const activity = householdActivity(time);
  return Math.max(0.15, daily + heating + activity);
}
export interface SimPoint {
  time: string;
  timestamp: string;
  power: number;
  normal: number;
  pool: number;
  charging: number;
  house: number;
  cost: number | null;
  normalCost: number | null;
  kwh: number;
  poolKwh: number;
  chargingKwh: number;
  poolCost: number | null;
  chargingCost: number | null;
  normalPoolKwh: number;
  normalChargingKwh: number;
  normalPoolCost: number | null;
  normalChargingCost: number | null;
}
export interface DeviceSimulation {
  category: SmartCategory;
  smart: boolean;
  decision: Decision;
  power: number;
  energy: number;
  cost: number | null;
  normalEnergy: number;
  normalCost: number | null;
  remaining: number;
  target: number;
  temperature?: number;
}
function inactive(
  status: Decision["status"],
  label: string,
  reason: string,
): Decision {
  return {
    status,
    label,
    reason,
    threshold: null,
    highest: null,
    coverageHours: 0,
  };
}
export function simulateHousehold(
  home: Household,
  prices: PriceInterval[],
  now: number,
) {
  const settings = readSimulationSettings(home),
    control = readSmartControl(home);
  const { start } = dayBounds(swedishDate(new Date(now)));
  const currentPrice = intervalAt(prices, now);
  const poolSmart = categoryActive(control, "pool"),
    carSmart = categoryActive(control, "charging");
  let poolEnergy = 0,
    carEnergy = 0,
    normalPool = 0,
    normalCar = 0,
    energy = 0,
    totalCost = 0,
    normalCost = 0,
    poolCost = 0,
    carCost = 0,
    normalPoolCost = 0,
    normalCarCost = 0,
    nonstopPoolCost = 0,
    nonstopCarCost = 0,
    unpriced = false;
  let lastPool = 0,
    lastCar = 0,
    lastHouse = 0;
  const decisions: Record<SmartCategory, Decision> = {
    pool: inactive("manual", "Manuellt", "Smart styrning är avstängd."),
    charging: inactive("manual", "Manuellt", "Smart styrning är avstängd."),
  };
  const series: SimPoint[] = [];
  const limits = {
    pool: Math.min(2.0, (home.fuse * 230 * 3) / 1000),
    charging: Math.min(
      home.vehicles.find((v) => v.isDefault)?.ac ?? 6,
      6,
      (home.fuse * 230 * 3) / 1000,
    ),
  };
  // Replay a transparent model day with current settings; this is not logged household history.
  for (let timestamp = start; timestamp <= now; timestamp += 900000) {
    const end = Math.min(now, timestamp + 900000);
    const hours = (end - timestamp) / 3600000;
    const t = timestamp === Math.floor(now / 900000) * 900000 ? now : timestamp;
    const h = hourOf(t);
    const price = intervalAt(prices, t === now ? now : timestamp);
    const house = familyPower(t, settings.adults, settings.children, home.area);
    const quarterBase =
      familyPower(timestamp, settings.adults, settings.children, home.area) -
      householdActivity(timestamp);
    const activityEnergy =
      (0.05 * 11000 * (Math.cos(timestamp / 11000) - Math.cos(end / 11000)) +
        0.035 * 3700 * (Math.cos(timestamp / 3700) - Math.cos(end / 3700))) /
      3600000;
    const houseEnergy = quarterBase * hours + activityEnergy;
    const poolWindow = h >= 7 && h < 23;
    const carWindow = h < 7 || h >= 18;
    const poolManualAllowed =
      home.pool.mode !== "Paus" && home.pool.mode !== "Semester";
    function deviceDecision(
      category: SmartCategory,
      smart: boolean,
      window: boolean,
      remaining: number,
      manualAllowed: boolean,
    ): Decision {
      if (remaining <= 0.0001)
        return inactive(
          "idle",
          "Dagsbehov uppnått",
          "Modellens energibehov är tillgodosett.",
        );
      if (!manualAllowed)
        return inactive(
          "paused",
          "Manuell paus",
          "Du har pausat denna simulering.",
        );
      if (!window)
        return inactive(
          "idle",
          category === "charging" ? "Bilen är inte hemma" : "Utanför drifttid",
          category === "charging"
            ? "Modellantagande: bilen finns hemma 18–07."
            : "Poolens modellerade driftfönster är 07–23.",
        );
      if (smart)
        return evaluateRule(
          category === "pool" ? settings.poolRule : settings.chargingRule,
          prices,
          t,
        );
      if (control.categories.includes(category) && !control.enabled)
        return inactive(
          "paused",
          "Smart pausad",
          "Husets smarta simulering är pausad.",
        );
      return inactive(
        "manual",
        "Manuellt · kör",
        "Normal drift utan prisregel.",
      );
    }
    const poolDecision = deviceDecision(
      "pool",
      poolSmart,
      poolWindow,
      settings.poolKwh - poolEnergy,
      poolManualAllowed,
    );
    const carDecision = deviceDecision(
      "charging",
      carSmart,
      carWindow || home.charging,
      settings.chargingKwh - carEnergy,
      home.vehicles.length > 0,
    );
    const run = (d: Decision) =>
      d.status === "running" || d.status === "manual";
    // Manual start overrides the smart charging plan only in this simulation.
    const pool =
      run(poolDecision) && poolWindow
        ? Math.min(
            limits.pool,
            hours > 0
              ? Math.max(0, settings.poolKwh - poolEnergy) / hours
              : limits.pool,
          )
        : 0;
    const car =
      (home.charging || run(carDecision)) &&
      (carWindow || home.charging) &&
      carEnergy < settings.chargingKwh
        ? Math.min(
            limits.charging,
            hours > 0
              ? Math.max(0, settings.chargingKwh - carEnergy) / hours
              : limits.charging,
          )
        : 0;
    const normalPoolPower =
      poolWindow && normalPool < settings.poolKwh
        ? Math.min(
            limits.pool,
            hours > 0 ? (settings.poolKwh - normalPool) / hours : limits.pool,
          )
        : 0;
    const normalCarPower =
      carWindow && home.vehicles.length > 0 && normalCar < settings.chargingKwh
        ? Math.min(
            limits.charging,
            hours > 0
              ? (settings.chargingKwh - normalCar) / hours
              : limits.charging,
          )
        : 0;
    // Shared fuse cap, including the modelled household background load.
    const headroom = Math.max(0, (home.fuse * 230 * 3) / 1000 - house);
    const poolActual = Math.min(pool, headroom);
    const carActual = Math.min(car, Math.max(0, headroom - poolActual));
    const normalPoolActual = Math.min(normalPoolPower, headroom),
      normalCarActual = Math.min(
        normalCarPower,
        Math.max(0, headroom - normalPoolActual),
      );
    const power = house + poolActual + carActual,
      normal = house + normalPoolActual + normalCarActual;
    poolEnergy += poolActual * hours;
    carEnergy += carActual * hours;
    normalPool += normalPoolActual * hours;
    normalCar += normalCarActual * hours;
    const energyForPoint = houseEnergy + (poolActual + carActual) * hours;
    const normalEnergyForPoint =
      houseEnergy + (normalPoolActual + normalCarActual) * hours;
    energy += energyForPoint;
    let pointCost: number | null = null,
      normalPointCost: number | null = null;
    if (price) {
      // Hypothetical reference requested by the user: full device power from midnight.
      // This deliberately uses different delivered energy; it is not price-shifting savings.
      nonstopPoolCost += cost(
        limits.pool * hours,
        price.ore,
        home.contract,
        home.tariff,
        false,
      ).total;
      nonstopCarCost += cost(
        limits.charging * hours,
        price.ore,
        home.contract,
        home.tariff,
        false,
      ).total;
      pointCost = cost(
        energyForPoint,
        price.ore,
        home.contract,
        home.tariff,
        false,
      ).total;
      normalPointCost = cost(
        normalEnergyForPoint,
        price.ore,
        home.contract,
        home.tariff,
        false,
      ).total;
      totalCost += pointCost;
      normalCost += normalPointCost;
      poolCost += cost(
        poolActual * hours,
        price.ore,
        home.contract,
        home.tariff,
        false,
      ).total;
      carCost += cost(
        carActual * hours,
        price.ore,
        home.contract,
        home.tariff,
        false,
      ).total;
      normalPoolCost += cost(
        normalPoolActual * hours,
        price.ore,
        home.contract,
        home.tariff,
        false,
      ).total;
      normalCarCost += cost(
        normalCarActual * hours,
        price.ore,
        home.contract,
        home.tariff,
        false,
      ).total;
    } else if (hours > 0) unpriced = true;
    series.push({
      time: priceTime(new Date(t).toISOString()),
      timestamp: new Date(t).toISOString(),
      power,
      normal,
      pool: poolActual,
      charging: carActual,
      house,
      cost: unpriced ? null : totalCost,
      normalCost: unpriced ? null : normalCost,
      kwh: energy,
      poolKwh: poolEnergy,
      chargingKwh: carEnergy,
      poolCost: unpriced ? null : poolCost,
      chargingCost: unpriced ? null : carCost,
      normalPoolKwh: normalPool,
      normalChargingKwh: normalCar,
      normalPoolCost: unpriced ? null : normalPoolCost,
      normalChargingCost: unpriced ? null : normalCarCost,
    });
    decisions.pool = poolDecision;
    decisions.charging =
      home.charging && carActual > 0
        ? inactive(
            "manual",
            "Manuell start",
            "Manuell laddning åsidosätter prisregeln i simuleringen.",
          )
        : carDecision;
    lastPool = poolEnergy >= settings.poolKwh - 0.0001 ? 0 : poolActual;
    lastCar = carEnergy >= settings.chargingKwh - 0.0001 ? 0 : carActual;
    if (poolEnergy >= settings.poolKwh - 0.0001)
      decisions.pool = inactive(
        "idle",
        "Dagsbehov uppnått",
        "Modellens energibehov är tillgodosett.",
      );
    if (carEnergy >= settings.chargingKwh - 0.0001)
      decisions.charging = inactive(
        "idle",
        "Dagsbehov uppnått",
        "Modellens energibehov är tillgodosett.",
      );
    lastHouse = house;
  }
  const last = series.at(-1);
  if (last) {
    last.power = lastHouse + lastPool + lastCar;
    last.pool = lastPool;
    last.charging = lastCar;
  }
  const devices: Record<SmartCategory, DeviceSimulation> = {
    pool: {
      category: "pool",
      smart: poolSmart,
      decision: decisions.pool,
      power: lastPool,
      energy: poolEnergy,
      cost: unpriced ? null : poolCost,
      normalEnergy: normalPool,
      normalCost: unpriced ? null : normalPoolCost,
      remaining: Math.max(0, settings.poolKwh - poolEnergy),
      target: settings.poolKwh,
      temperature:
        home.pool.target -
        0.5 +
        Math.min(0.5, (poolEnergy / Math.max(1, settings.poolKwh)) * 0.5),
    },
    charging: {
      category: "charging",
      smart: carSmart,
      decision: decisions.charging,
      power: lastCar,
      energy: carEnergy,
      cost: unpriced ? null : carCost,
      normalEnergy: normalCar,
      normalCost: unpriced ? null : normalCarCost,
      remaining: Math.max(0, settings.chargingKwh - carEnergy),
      target: settings.chargingKwh,
    },
  };
  // Compare identical delivered device energy, excluding reduced or postponed energy from claimed savings.
  const matchedDifference = Object.values(devices).reduce(
    (sum, d) =>
      sum +
      (d.cost !== null && d.normalCost !== null && d.normalEnergy > 0
        ? d.energy * (d.normalCost / d.normalEnergy) - d.cost
        : 0),
    0,
  );
  return {
    now,
    settings,
    series,
    devices,
    currentPrice: currentPrice?.ore ?? null,
    power: lastHouse + lastPool + lastCar,
    housePower: lastHouse,
    energy,
    cost: unpriced ? null : totalCost,
    normalCost: unpriced ? null : normalCost,
    matchedDifference: unpriced ? null : matchedDifference,
    continuousComparison: {
      pool: unpriced ? null : nonstopPoolCost - poolCost,
      charging:
        unpriced || !home.vehicles.length ? null : nonstopCarCost - carCost,
      house: unpriced ? null : 0, // Background house load has no smart control in this model.
      floor: null, // No separate heating model or verified consumption breakdown.
      poolPower: limits.pool,
      chargingPower: limits.charging,
    },
    priceAvailable: !!currentPrice,
  };
}
export type HouseholdSimulation = ReturnType<typeof simulateHousehold>;
