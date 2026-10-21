import type { Household } from "../models";
import { categoryActive, readSmartControl } from "../smart-control";
import {
  evaluateRule,
  readSimulationSettings,
  type PriceInterval,
} from "../simulation/engine";
import {
  forecastFresh,
  thermalSettingsSchema,
  weatherHour,
  type Weather,
} from "./contracts";
import {
  learnedTemperatureAfter,
  type PoolLearning,
  type LearnedPool,
} from "../pool/learning";
import { swedishDate } from "../prices/time";
const hour = (now: number) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Stockholm",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
function coolingForecast(
  weather: Weather,
  model: LearnedPool,
  now: number,
  duration: number,
) {
  let water = model.water;
  const end = now + duration * 3600000;
  for (let t = now; t < end;) {
    const h = weatherHour(weather, t);
    if (!h) return null;
    const next = Math.min(end, Date.parse(h.time) + 3600000);
    water = learnedTemperatureAfter(
      water,
      h.temperature,
      (next - t) / 3600000,
      model,
      false,
    );
    t = next;
  }
  return water;
}
export function weatherHeatingPlan(
  home: Household,
  weather: Weather | null,
  prices: PriceInterval[],
  now: number,
  learning: PoolLearning,
) {
  if (
    !weather ||
    !forecastFresh(weather, now) ||
    weather.postcode !== (home.postcode ?? "").replace(/\s/g, "")
  )
    return {
      available: false as const,
      reason:
        "Aktuell verifierad väderprognos saknas. Inget väderbaserat styrförslag beräknas.",
    };
  if (!learning.model)
    return { available: false as const, reason: learning.message };
  const model = learning.model;
  const settings = thermalSettingsSchema.parse(
    home.thermalSettings ?? {
      enabled: false,
      tolerance: 0.5,
      preheat: 0.5,
      pauseHours: 4,
    },
  );
  const smart =
    settings.enabled && categoryActive(readSmartControl(home), "pool");
  const rule = readSimulationSettings(home).poolRule;
  const until = now + 86400000;
  let water = model.water,
    onHours = 0,
    minimum = water;
  const steps: {
    time: string;
    temperature: number;
    outdoor: number;
    heating: boolean;
    action: string;
    reason: string;
  }[] = [];
  for (let t = now; t < until;) {
    const w = weatherHour(weather, t);
    if (!w) break;
    const next = Math.min(
        until,
        (Math.floor(t / 900000) + 1) * 900000,
        Date.parse(w.time) + 3600000,
      ),
      hours = (next - t) / 3600000;
    const price = evaluateRule(rule, prices, t);
    let futureWater = water,
      expensiveAhead = false;
    for (let f = t; f < Math.min(until, t + 4 * 3600000); f += 900000) {
      const fw = weatherHour(weather, f);
      if (!fw) break;
      futureWater = learnedTemperatureAfter(
        futureWater,
        fw.temperature,
        0.25,
        model,
        false,
      );
      if (evaluateRule(rule, prices, f).status === "price-paused")
        expensiveAhead = true;
    }
    const preheat =
      expensiveAhead && futureWater < home.pool.target - settings.tolerance;
    const target = home.pool.target + (preheat ? settings.preheat : 0);
    const withoutHeat = learnedTemperatureAfter(
      water,
      w.temperature,
      hours,
      model,
      false,
    );
    let heating = withoutHeat < target;
    let action = preheat ? "Förvärm inför pristopp" : "Värm mot måltemperatur";
    let reason = preheat
      ? "Inlärd avsvalning och prognosen visar temperaturtapp inför en dyr period. Förvärmning tillåts endast under prisgränsen."
      : "Poolens inlärda värmebalans och riktig väderprognos visar ett värmebehov.";
    if (!smart || home.pool.mode === "Paus" || home.pool.mode === "Semester") {
      heating = false;
      action = "Väderstyrning av";
      reason =
        "Aktivera både smart Pool och väderhänsyn. Manuell paus respekteras.";
    } else if (hour(t) < 7 || hour(t) >= 23) {
      heating = false;
      action = "Utanför drifttid";
      reason = "Poolens driftfönster är 07–23.";
    } else if (price.status !== "running") {
      heating = false;
      action = price.label;
      reason = price.reason + " Temperaturbehov åsidosätter inte prisregeln.";
    } else if (!heating) {
      action = "Värme behövs inte nu";
      reason = "Poolens beräknade temperatur ligger vid eller över målet.";
    }
    steps.push({
      time: new Date(t).toISOString(),
      temperature: water,
      outdoor: w.temperature,
      heating,
      action,
      reason,
    });
    water = learnedTemperatureAfter(
      water,
      w.temperature,
      hours,
      model,
      heating,
    );
    minimum = Math.min(minimum, water);
    if (heating) onHours += hours;
    t = next;
  }
  const coveredHours = steps.length
    ? (Math.min(
        until,
        (Math.floor(Date.parse(steps.at(-1)!.time) / 900000) + 1) * 900000,
      ) -
        now) /
      3600000
    : 0;
  if (coveredHours < 0.01)
    return {
      available: false as const,
      reason: "Aktuell prognostimme saknas. Ingen värmeplan beräknas.",
    };
  return {
    available: true as const,
    settings,
    model,
    smart,
    steps,
    onHours,
    poolKwh: model.electricalKw === null ? null : onHours * model.electricalKw,
    minimum,
    endTemperature: water,
    coveredHours,
    coolingTemperature: coolingForecast(
      weather,
      model,
      now,
      settings.pauseHours,
    ),
    comfortRisk: smart && minimum < home.pool.target - settings.tolerance,
    extrapolated: steps.some(
      (s) =>
        s.outdoor < model.outdoorMin - 5 || s.outdoor > model.outdoorMax + 5,
    ),
  };
}
export type HeatingPlan = ReturnType<typeof weatherHeatingPlan>;
export function summarizeWeather(weather: Weather, date: string, now: number) {
  const hours = weather.hours.filter(
    (h) =>
      swedishDate(new Date(h.time)) === date &&
      Date.parse(h.time) + 3600000 > now,
  );
  if (!hours.length) return null;
  return {
    low: Math.min(...hours.map((h) => h.temperature)),
    high: Math.max(...hours.map((h) => h.temperature)),
    wind: Math.max(...hours.map((h) => h.wind)),
    hours: hours.length,
  };
}
