"use client";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Rectangle,
  type BarShapeProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Button } from "./ui/button";
import { number } from "@/lib/energy";
import { priceBands, classifyPrice, priceBandLabels } from "@/lib/prices/chart";
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
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", tick);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
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
  const bands = priceBands(data?.intervals.map((p) => p.ore) ?? []);
  const points =
    data?.intervals.map((p) => ({
      time: priceTime(p.start),
      price: p.ore,
      start: p.start,
      band: classifyPrice(p.ore, bands),
      state:
        Date.parse(p.end) <= clock
          ? "past"
          : p === current
            ? "current"
            : "future",
    })) ?? [];
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
            ? `${data.date} · ${data.intervals.length} kvartar · Svensk tid (Stockholm)`
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
            {current && (
              <p className="price-now" data-testid="price-now">
                <span className="price-now-dot" />
                <strong>Nu {priceTime(new Date(clock).toISOString())}</strong>
                <span>
                  Aktuell kvart {priceTime(current.start)}–
                  {priceTime(current.end)}
                </span>
              </p>
            )}
            <div
              className="graph"
              role="img"
              aria-label="Publicerade kvartspriser"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={points}
                  margin={{ top: 24, right: 18, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis
                    dataKey="start"
                    tickFormatter={(start: string) => priceTime(start)}
                    minTickGap={45}
                    fontSize={10}
                  />
                  <YAxis width={45} fontSize={10} />
                  <Tooltip
                    labelFormatter={(start) => priceTime(String(start), true)}
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
                    isAnimationActive={false}
                    activeBar={false}
                    shape={({ index, x, y, width, height }: BarShapeProps) => {
                      const point = points[index];
                      return (
                        <Rectangle
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          radius={[3, 3, 0, 0]}
                          fill={
                            point.state === "past"
                              ? "var(--price-past)"
                              : `var(--price-${point.band})`
                          }
                          stroke={
                            point.state === "current"
                              ? "var(--price-now)"
                              : "none"
                          }
                          strokeWidth={point.state === "current" ? 1.5 : 0}
                          data-price-state={point.state}
                          data-price-band={point.band}
                          aria-label={`${point.state === "past" ? "Passerad" : point.state === "current" ? "Aktuell" : "Kommande"} kvart ${point.time}: ${number(point.price, 2)} öre/kWh · ${priceBandLabels[point.band]}`}
                        />
                      );
                    }}
                  />
                  {current && (
                    <ReferenceLine
                      x={current.start}
                      stroke="var(--price-now)"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      label={{
                        value: "Nu",
                        position: "top",
                        fill: "var(--price-now-text)",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="price-legend" aria-label="Grafens färger">
              <span>
                <i className="price-swatch price-swatch-past" />
                Passerat
              </span>
              {current && (
                <span>
                  <i className="price-swatch price-swatch-now" />
                  Nu · aktuell kvart
                </span>
              )}
              <span>
                <i className="price-swatch price-swatch-low" />
                Billigt
              </span>
              <span>
                <i className="price-swatch price-swatch-middle" />
                Mellanpris
              </span>
              <span>
                <i className="price-swatch price-swatch-high" />
                Dyrt
              </span>
            </div>
            <p className="muted price-color-explanation">
              Färgerna jämför priser inom det valda dygnet.{" "}
              {bands?.equal
                ? "Alla kvartar har samma pris."
                : bands
                  ? `Grönt: högst ${number(bands.low, 2)} · Gult: upp till ${number(bands.high, 2)} · Rött: över ${number(bands.high, 2)} öre/kWh. Gränserna delar dygnets prisspann i tre lika delar.`
                  : ""}{" "}
              Passerade kvartar visas i grått.
            </p>
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
