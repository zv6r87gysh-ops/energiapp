"use client";
import { useEffect, useMemo, useState } from "react";
import {
  forecastFresh,
  postcodeSchema,
  weatherSchema,
  type Weather,
} from "./contracts";
import { learnPoolBehavior, type PoolTelemetry } from "../pool/learning";
import { weatherHeatingPlan } from "./planner";
import type { Household } from "../models";
import type { PriceInterval } from "../simulation/engine";
export function useWeather(
  home: Household,
  prices: PriceInterval[],
  now: number | null,
  telemetry: PoolTelemetry | null = null,
) {
  const postcode = postcodeSchema.safeParse(home.postcode ?? "");
  const code = postcode.success ? postcode.data : "";
  const key = `${home.id}/${code}`;
  const [result, setResult] = useState<{
    key: string;
    data: Weather | null;
    message: string;
  } | null>(null);
  useEffect(() => {
    if (!code) return;
    let mounted = true;
    let controller: AbortController | null = null;
    let retryAfter = 0;
    let busy = false;
    async function load() {
      if (document.hidden || busy || Date.now() < retryAfter) return;
      busy = true;
      controller = new AbortController();
      try {
        const r = await fetch(`/api/weather?postcode=${code}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const raw = await r.json();
        if (!r.ok || raw.status !== "available")
          throw Error("Källan svarade inte");
        const data = weatherSchema.parse(raw.data);
        if (data.postcode !== code || !forecastFresh(data, Date.now()))
          throw Error("Fel plats eller inaktuell prognos");
        retryAfter = Date.parse(data.expiresAt);
        if (mounted) setResult({ key, data, message: "" });
      } catch {
        retryAfter = Date.now() + 60000;
        if (mounted)
          setResult({
            key,
            data: null,
            message:
              "Väderprognosen kunde inte verifieras. Inga demovärden används.",
          });
      } finally {
        busy = false;
      }
    }
    void load();
    const timer = setInterval(() => void load(), 60000);
    const refresh = () => void load();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted = false;
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [key, code]);
  const weather =
    result?.key === key &&
    result.data &&
    now !== null &&
    forecastFresh(result.data, now)
      ? result.data
      : null;
  const learning = useMemo(
    () => learnPoolBehavior(telemetry, home.id, now ?? 0),
    [telemetry, home.id, now],
  );
  const plan = useMemo(
    () =>
      now === null
        ? null
        : weatherHeatingPlan(home, weather, prices, now, learning),
    [home, weather, prices, now, learning],
  );
  return {
    weather,
    learning,
    plan,
    message: !code
      ? "Ange hushållets postnummer för lokal väderprognos."
      : result?.key === key
        ? result.message ||
          (weather ? "" : "Prognosen är inaktuell. Hämtar ny data…")
        : "Hämtar prognos från MET Norway…",
  };
}
