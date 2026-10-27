"use client";
import { useEffect, useMemo, useState } from "react";
import {
  forecastFresh,
  postcodeSchema,
  weatherSchema,
  type Weather,
} from "./contracts";
import { weatherErrorMessage } from "./errors";
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
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data: Weather | null;
    location?: { latitude: number; longitude: number };
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
          throw Error(
            weatherErrorMessage(raw.code) ??
              "Väderprognosen kunde inte hämtas. Försök igen om en minut.",
          );
        const data = weatherSchema.parse(raw.data);
        if (data.postcode !== code || !forecastFresh(data, Date.now()))
          throw Error(
            "Prognosen gäller fel plats eller är inaktuell. Kontrollera även datum och klocka på din enhet.",
          );
        retryAfter = Date.parse(data.expiresAt);
        if (mounted)
          setResult({
            key,
            data,
            location: { latitude: data.latitude, longitude: data.longitude },
            message: "",
          });
      } catch (error) {
        retryAfter = Date.now() + 60000;
        if (mounted)
          setResult((previous) => ({
            key,
            data: null,
            location: previous?.key === key ? previous.location : undefined,
            message: `${error instanceof Error ? error.message : "Väderprognosen kunde inte hämtas."} Inga demovärden används.`,
          }));
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
  }, [key, code, attempt]);
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
    refresh: () => {
      setResult((previous) =>
        previous?.key === key
          ? {
              ...previous,
              data: null,
              message: "Hämtar prognos från MET Norway…",
            }
          : null,
      );
      setAttempt((n) => n + 1);
    },
    weather,
    location: result?.key === key ? (result.location ?? null) : null,
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
