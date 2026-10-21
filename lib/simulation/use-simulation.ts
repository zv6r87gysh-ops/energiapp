"use client";
import { useEffect, useMemo, useState } from "react";
import type { Household } from "../models";
import { priceDaySchema, type PriceDay } from "../prices/contracts";
import { swedishDate } from "../prices/time";
import { simulateHousehold } from "./engine";
export function useHouseholdSimulation(home: Household) {
  const [clock, setClock] = useState<number | null>(null);
  const [result, setResult] = useState<{
    key: string;
    days: PriceDay[];
    message: string;
  } | null>(null);
  useEffect(() => {
    const tick = () => setClock(Date.now());
    queueMicrotask(tick);
    const timer = setInterval(tick, 5000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);
  const date = clock === null ? "" : swedishDate(new Date(clock));
  const key = `${home.region}/${date}`;
  useEffect(() => {
    if (!date) return;
    let mounted = true;
    let controller: AbortController;
    async function load() {
      controller?.abort();
      controller = new AbortController();
      const responses = await Promise.allSettled(
        ["today", "tomorrow"].map(async (day) => {
          const r = await fetch(
            `/api/electricity-prices?area=${home.region}&day=${day}`,
            { cache: "no-store", signal: controller.signal },
          );
          const raw = await r.json();
          if (raw.status === "unpublished") return null;
          if (raw.status !== "available")
            throw Error("Priser kunde inte hämtas");
          const parsed = priceDaySchema.parse(raw.data);
          if (parsed.area !== home.region) throw Error("Fel prisområde");
          return parsed;
        }),
      );
      if (!mounted) return;
      const days = responses.flatMap((r) =>
        r.status === "fulfilled" && r.value ? [r.value] : [],
      );
      setResult({
        key,
        days,
        message:
          days.length === 2
            ? "Dagens och morgondagens publicerade priser."
            : days.length
              ? "Morgondagens priser saknas eller kunde inte hämtas."
              : "Verifierade priser saknas. Inga demopriser ersätter dem.",
      });
    }
    void load();
    const timer = setInterval(() => void load(), 300000);
    const refresh = () => void load();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      mounted = false;
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, [date, key, home.region]);
  const validDays = useMemo(
    () =>
      result?.key === key && clock !== null
        ? result.days.filter((d) => clock - Date.parse(d.fetchedAt) < 600000)
        : [],
    [result, key, clock],
  );
  const prices = useMemo(
    () =>
      validDays
        .flatMap((d) => d.intervals)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [validDays],
  );
  const simulation = useMemo(
    () => (clock === null ? null : simulateHousehold(home, prices, clock)),
    [home, prices, clock],
  );
  return {
    simulation,
    prices,
    message:
      result?.key === key ? result.message : "Hämtar publicerade spotpriser…",
    fetchedAt: validDays[0]?.fetchedAt ?? null,
  };
}
