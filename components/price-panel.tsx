"use client";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Button } from "./ui/button";
import { number } from "@/lib/energy";
import {
  priceDaySchema,
  type PriceArea,
  type PricesResponse,
} from "@/lib/prices/contracts";
import { addDate, swedishDate, intervalAt, priceTime } from "@/lib/prices/time";

export function PricePanel({
  area,
  compact = false,
  chartOnly = false,
}: {
  area: PriceArea;
  compact?: boolean;
  chartOnly?: boolean;
}) {
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [clock, setClock] = useState(() => Date.now());
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    payload: PricesResponse;
  } | null>(null);
  const date = addDate(
    swedishDate(new Date(clock)),
    day === "tomorrow" ? 1 : 0,
  );
  const key = `${area}/${date}/${day}`;
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const timer = setInterval(tick, 30000);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", tick);
    };
  }, []);
  useEffect(() => {
    let mounted = true;
    let current: AbortController | null = null;
    async function load() {
      current?.abort();
      current = new AbortController();
      try {
        const response = await fetch(
          `/api/electricity-prices?area=${area}&day=${day}`,
          { cache: "no-store", signal: current.signal },
        );
        const raw = (await response.json()) as PricesResponse;
        if (!mounted) return;
        if (raw.area !== area || raw.date !== date)
          throw Error("Fel prisområde eller datum");
        if (raw.status === "available") {
          const parsed = priceDaySchema.parse(raw.data);
          if (parsed.area !== area || parsed.date !== date)
            throw Error("Fel prisdata");
          setResult({ key, payload: { ...raw, data: parsed } });
        } else if (
          ["unpublished", "unavailable", "not-configured"].includes(raw.status)
        )
          setResult({ key, payload: { ...raw, data: null } });
        else throw Error("Ogiltigt svar");
      } catch (error) {
        if (mounted && !(error instanceof Error && error.name === "AbortError"))
          setResult({
            key,
            payload: {
              status: "unavailable",
              area,
              date,
              data: null,
              message:
                "Priserna kunde inte hämtas. Kontrollera anslutningen och försök igen.",
            },
          });
      }
    }
    void load();
    const timer = setInterval(() => void load(), 300000);
    const online = () => void load();
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("focus", online);
    return () => {
      mounted = false;
      current?.abort();
      clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("focus", online);
    };
  }, [area, day, date, key, retry]);
  const payload = result?.key === key ? result.payload : null;
  const stale = payload?.data
    ? clock - Date.parse(payload.data.fetchedAt) > 600000
    : false;
  const data = stale ? null : payload?.data;
  const current = data ? intervalAt(data.intervals, clock) : null;
  const next = data
    ? intervalAt(data.intervals, Math.floor(clock / 900000) * 900000 + 900000)
    : null;
  const points =
    data?.intervals.map((p) => ({ time: priceTime(p.start), price: p.ore })) ??
    [];
  const average = data
    ? data.intervals.reduce((s, p) => s + p.ore, 0) / data.intervals.length
    : null;
  const cheapest = data
    ? [...data.intervals].sort((a, b) => a.ore - b.ore)[0]
    : null;
  const message = stale
    ? "Prisuppgifterna är för gamla. Hämta aktuella priser igen."
    : (payload?.message ?? "Hämtar aktuella spotpriser…");
  if (compact)
    return (
      <section className="card price-compact">
        <div className="metric-label">
          Elpris just nu · {area}
          <span className="badge neutral">
            {current ? "Spotpris" : "Ej tillgängligt"}
          </span>
        </div>
        <div className="metric-value">
          {current ? number(current.ore, 2) : "–"} <small>öre/kWh</small>
        </div>
        <p className="muted">
          {current ? "Elprisetjustnu.se · exkl. moms och avgifter" : message}
        </p>
      </section>
    );
  return (
    <>
      {!chartOnly && (
        <div className="toolbar">
          {(["today", "tomorrow"] as const).map((d) => (
            <Button
              key={d}
              className={day === d ? "" : "secondary"}
              onClick={() => setDay(d)}
            >
              {d === "today" ? "Idag" : "Imorgon"}
            </Button>
          ))}
          <Button
            className="secondary"
            onClick={() => {
              setClock(Date.now());
              setRetry((r) => r + 1);
            }}
          >
            Hämta igen
          </Button>
        </div>
      )}
      <section className="card">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>
            {chartOnly ? "Dagens kvartspriser" : "Spotpriser"} · {area}
          </h2>
          <span className="badge neutral">
            {data ? "Publicerade priser" : "Inga verifierade priser"}
          </span>
        </div>
        <p className="muted">
          {data
            ? `${data.date} · ${data.intervals.length} kvartar · Europe/Stockholm`
            : message}
        </p>
        {!data && (
          <div role="status" className="warning">
            {message} Inga demopriser används som ersättning.
          </div>
        )}
        {data && (
          <>
            {!chartOnly && (
              <div className="metrics">
                {[
                  {
                    label: day === "today" ? "Nuvarande kvart" : "Nästa dygn",
                    value: current?.ore,
                    note: current
                      ? priceTime(current.start)
                      : "Inte innevarande dygn",
                  },
                  {
                    label: "Nästa kvart",
                    value: next?.ore,
                    note: next
                      ? priceTime(next.start)
                      : "Priset är inte tillgängligt",
                  },
                  {
                    label: "Dygnets genomsnitt",
                    value: average,
                    note: "Tidsvägt genomsnitt",
                  },
                  {
                    label: "Lägst / högst",
                    value: null,
                    note: `${number(Math.min(...data.intervals.map((p) => p.ore)), 2)} / ${number(Math.max(...data.intervals.map((p) => p.ore)), 2)} öre/kWh`,
                  },
                ].map((m) => (
                  <div className="card" key={m.label}>
                    <div className="metric-label">{m.label}</div>
                    <div className="metric-value">
                      {m.value != null ? number(m.value, 2) : "–"}{" "}
                      <small>{m.value != null ? "öre/kWh" : ""}</small>
                    </div>
                    <p className="muted">{m.note}</p>
                  </div>
                ))}
              </div>
            )}
            <div
              className="graph"
              role="img"
              aria-label="Publicerade kvartspriser"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="time" minTickGap={45} fontSize={10} />
                  <YAxis width={45} fontSize={10} />
                  <Tooltip
                    formatter={(v) => [
                      `${number(Number(v), 2)} öre/kWh`,
                      "Spotpris exkl. moms",
                    ]}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--line)",
                    }}
                  />
                  <ReferenceLine y={0} stroke="var(--muted)" />
                  <Bar
                    dataKey="price"
                    fill="#27957c"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {cheapest && (
              <p>
                Billigaste kvart:{" "}
                <b>
                  {priceTime(cheapest.start)} – {priceTime(cheapest.end)}
                </b>{" "}
                · {number(cheapest.ore, 2)} öre/kWh.
              </p>
            )}
            <p className="muted">
              Källa:{" "}
              <a href={data.sourceUrl} target="_blank" rel="noreferrer">
                Elprisetjustnu.se
              </a>{" "}
              · Hämtat {priceTime(data.fetchedAt)}. Automatisk hämtning var
              femte minut. Priserna kan avvika något från officiella priser på
              grund av leverantörens valutakurs.
            </p>
          </>
        )}
        <p className="muted">
          Spotpris exklusive moms, elhandelspåslag, energiskatt och
          elnätsavgifter. Detta är inte ditt totala elpris. Kostnadsprognoser,
          laddning och besparingar i övriga appen använder fortfarande tydligt
          märkta demodata.
        </p>
      </section>
    </>
  );
}
