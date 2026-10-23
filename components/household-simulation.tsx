"use client";
import type { EnergyTotals } from "@/lib/simulation/totals";
import { useState } from "react";
import { Car, Settings2, Waves } from "lucide-react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Button } from "./ui/button";
import { money, number } from "@/lib/energy";
import { priceTime, swedishDate } from "@/lib/prices/time";
import {
  readSimulationSettings,
  simulationSettingsSchema,
  type HouseholdSimulation,
  type SimulationSettings,
  type DeviceSimulation,
} from "@/lib/simulation/engine";
import type { Household } from "@/lib/models";
import type { SmartCategory } from "@/lib/smart-control";
export function DeviceSimulationStatus({
  device,
}: {
  device: DeviceSimulation;
}) {
  return (
    <div className={`sim-device-status sim-state-${device.decision.status}`}>
      <strong>
        {device.smart ? "Smart aktiv" : "Smart av"} · {device.decision.label}
      </strong>
      <span>{device.decision.reason}</span>
      {device.decision.threshold !== null && (
        <span>
          Pausgräns: {number(device.decision.threshold, 2)} öre/kWh
          {device.decision.highest !== null
            ? ` · Högst kommande 24 h: ${number(device.decision.highest, 2)} öre/kWh`
            : ""}
        </span>
      )}
    </div>
  );
}
export function SimulationDashboard({
  simulation,
  message,
  view = "overview",
  totals,
}: {
  simulation: HouseholdSimulation | null;
  message: string;
  view?: string;
  totals?: EnergyTotals | null;
}) {
  const [period, setPeriod] = useState("Idag");
  if (!simulation)
    return (
      <section className="card">
        <h2>Levande hushållssimulering</h2>
        <p role="status">
          Förbereder familjens modell och hämtar verkliga spotpriser…
        </p>
      </section>
    );
  const s = simulation;
  const values =
    period === "Senaste timmen"
      ? s.series.filter((p) => Date.parse(p.timestamp) >= s.now - 3600000)
      : s.series;
  return (
    <div className="simulation-dashboard">
      <div className="simulation-heading">
        <span className="simulation-pulse" />
        <strong>
          Levande simulering · {s.settings.adults} vuxna och{" "}
          {s.settings.children} barn
        </strong>
        <span>
          {swedishDate(new Date(s.now))} kl.{" "}
          {priceTime(new Date(s.now).toISOString())} · svensk tid
        </span>
      </div>
      <p className="muted">
        Modellerad förbrukning, inte uppmätta värden. Verkliga spotpriser från
        Elprisetjustnu.se. Uppdateras var femte sekund. Grafen räknas om med
        dina aktuella regler; den är inte loggad historik.
      </p>
      {view === "consumption" && totals && (
        <section className="card" aria-label="Ackumulerad förbrukning">
          <h2>Total förbrukning</h2>
          <div className="metrics">
            <div className="metric">
              <span>Total förbrukning idag</span>
              <div className="metric-value">
                {number(totals.today, 2)} <small>kWh</small>
              </div>
            </div>
            <div className="metric">
              <span>Total förbrukning denna månad</span>
              <div className="metric-value">
                {number(totals.month, 2)} <small>kWh</small>
              </div>
            </div>
          </div>
          <p className="muted">
            Modellvärden · uppdateras var femte sekund. Månadssumman sparas i
            den här webbläsaren för valt hushåll och omfattar {totals.days} av{" "}
            {totals.expectedDays} dagar hittills denna månad (svensk tid). Dagar
            utan underlag ingår inte.
            {totals.partialDays > 0
              ? ` ${totals.partialDays} tidigare dagar har endast delvis underlag.`
              : ""}{" "}
            Dagens värde räknas om med aktuella styrregler.
          </p>
        </section>
      )}
      {!s.priceAvailable && (
        <p className="warning" role="status">
          {message} Kostnader och prisbaserad styrning visas inte som
          verifierade när priser saknas.
        </p>
      )}
      <div className="metrics">
        {[
          {
            label: "Simulerad effekt nu",
            value: number(s.power, 2),
            unit: "kW",
            note: "Grundlast, pool och laddare",
          },
          {
            label: "Modellerat idag",
            value: number(s.energy, 2),
            unit: "kWh",
            note: "Från svensk midnatt till nu",
          },
          {
            label: "Rörlig kostnad idag",
            value: s.cost === null ? "–" : money(s.cost),
            unit: "",
            note: "Inkl. rörliga avgifter och moms, exkl. fasta avgifter",
          },
          {
            label:
              view === "savings"
                ? "Prisskillnad · samma energi"
                : "Spotpris just nu",
            value:
              view === "savings"
                ? s.matchedDifference === null
                  ? "–"
                  : money(s.matchedDifference)
                : s.currentPrice === null
                  ? "–"
                  : number(s.currentPrice, 2),
            unit: view === "savings" ? "" : "öre/kWh",
            note:
              view === "savings"
                ? "Modellerat, inte verifierad besparing"
                : "Elprisetjustnu.se · exkl. moms och avgifter",
          },
        ].map((m) => (
          <section className="card" key={m.label}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value">
              {m.value} <small>{m.unit}</small>
            </div>
            <p className="muted">{m.note}</p>
          </section>
        ))}
      </div>
      <section className="card">
        <div className="toolbar">
          <h2>
            {view === "savings"
              ? "Samma energi – olika prisperioder"
              : "Familjens energiflöde · simulering"}
          </h2>
          <select
            aria-label="Simuleringens tidsperiod"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option>Idag</option>
            <option>Senaste timmen</option>
          </select>
        </div>
        <div
          className="graph"
          role="img"
          aria-label="Levande simulerad förbrukning med verkliga spotpriser"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={values}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="time" minTickGap={38} fontSize={11} />
              <YAxis width={38} fontSize={11} />
              <Tooltip
                formatter={(v, name) => [`${number(Number(v), 2)} kW`, name]}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                }}
              />
              <Area
                dataKey="power"
                name="Med valda regler"
                type="monotone"
                fill="#269a8025"
                stroke="#258e76"
                strokeWidth={2.5}
                isAnimationActive={false}
              />
              <Line
                dataKey="normal"
                name="Normal drift"
                type="monotone"
                stroke="#a7b2b4"
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="price-legend">
          <span>
            <i className="price-swatch price-swatch-low" />
            Med aktuella regler
          </span>
          <span>
            <i className="price-swatch price-swatch-past" />
            Normal drift utan prisregel
          </span>
        </div>
        <p className="muted">
          Grundmodellen inkluderar kyl/frys, standby, uppvärmning,
          morgonrutiner, matlagning och kvällsaktivitet. Poolens behov:{" "}
          {s.settings.poolKwh} kWh/dygn. Bilens behov: {s.settings.chargingKwh}{" "}
          kWh/dygn; bilen antas vara hemma 18–07. Enheternas last begränsas av
          hushållets säkring.
        </p>
      </section>
      <div className="two-col">
        {(["pool", "charging"] as SmartCategory[]).map((category) => {
          const d = s.devices[category];
          const Icon = category === "pool" ? Waves : Car;
          return (
            <section className="card" key={category}>
              <h2 className="sim-device-title">
                <Icon size={20} />
                {category === "pool" ? "Pool" : "Billaddare"} · simulering
              </h2>
              <DeviceSimulationStatus device={d} />
              <div className="chart-footer">
                <span>
                  Effekt nu<b>{number(d.power, 2)} kW</b>
                </span>
                <span>
                  Energi idag<b>{number(d.energy, 2)} kWh</b>
                </span>
                <span>
                  Återstående behov<b>{number(d.remaining, 2)} kWh</b>
                </span>
              </div>
              <p className="muted">
                Kostnad:{" "}
                {d.cost === null ? "saknar prisunderlag" : money(d.cost)}.{" "}
                {d.remaining > 0.01
                  ? "Återstående behov är inte en besparing. Prispaus kan göra att dagsmålet inte nås."
                  : "Modellens dagsmål är uppnått."}
              </p>
            </section>
          );
        })}
      </div>
      {view === "savings" && (
        <section className="card">
          <h2>Så har vi räknat</h2>
          <p>
            Prisskillnaden räknas för samma levererade energi per enhet:
            normaldriftens genomsnittliga rörliga kostnad per kWh × modellens
            levererade kWh minus modellens kostnad. Skatt, påslag, nätavgifter
            och moms beräknas en gång och med samma värden i båda fallen.
            Minskad eller uppskjuten förbrukning räknas inte som besparing.
          </p>
          <p className="muted">
            Detta är en normaliserad modelljämförelse, inte ett bevis för
            verklig besparing eller likvärdig poolkomfort. Konstant drift är en
            separat hypotetisk jämförelse, aldrig huvudsaklig besparing.
          </p>
          <details>
            <summary>Hypotetisk jämförelse – inte faktisk besparing</summary>
            <p>
              En 2 kW-poolpump i 24 timmars oavbruten drift använder 48 kWh.
              Modellens dagsbehov är {s.settings.poolKwh} kWh. Dessa energibehov
              är olika och skillnaden får inte kallas ekonomisk effekt av smart
              styrning.
            </p>
          </details>
        </section>
      )}
      {view === "cost" && (
        <section className="card">
          <h2>Kostnadsunderlag</h2>
          <p>
            Varje modellerad energimängd multipliceras med det verkliga priset
            för samma kvart. Rörliga avgifter och moms ingår. Fasta
            månadsavgifter ligger kvar i elavtalsinställningarna och ingår inte
            i jämförelsen mellan driftlägen. Månadsprognos och historiska
            månadsjämförelser kräver fler prisdygn och visas inte som verklig
            historik.
          </p>
        </section>
      )}
    </div>
  );
}
export function SimulationSettingsForm({
  home,
  onSave,
}: {
  home: Household;
  onSave: (settings: SimulationSettings) => void;
}) {
  const [draft, setDraft] = useState(() => readSimulationSettings(home));
  const [message, setMessage] = useState("");
  return (
    <section className="card" id="simulation-settings">
      <h2>
        <Settings2 size={17} /> Simulering och prisregler
      </h2>
      <p className="muted">
        Välj en fast gräns eller en andel av högsta publicerade priset under
        kommande 24 timmar. Vid pris lika med eller högre än gränsen pausas den
        valda smarta kategorin. Reglaget påverkar endast modellen, ingen
        hårdvara.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const r = simulationSettingsSchema.safeParse(draft);
          if (!r.success) {
            setMessage(
              "Kontrollera antal personer, energibehov och prisgränser.",
            );
            return;
          }
          onSave(r.data);
          setMessage("Simuleringens regler har sparats för hushållet.");
        }}
        noValidate
      >
        <div className="form-grid">
          {(
            [
              ["adults", "Antal vuxna"],
              ["children", "Antal barn"],
              ["poolKwh", "Poolens energibehov (kWh/dygn)"],
              ["chargingKwh", "Bilens laddbehov (kWh/dygn)"],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input
                type="number"
                min="0"
                max={key === "adults" || key === "children" ? 10 : 100}
                step={key === "adults" || key === "children" ? 1 : 0.5}
                value={draft[key]}
                onChange={(e) =>
                  setDraft({ ...draft, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
        <div className="two-col">
          {(["poolRule", "chargingRule"] as const).map((key, i) => (
            <fieldset className="sim-rule" key={key}>
              <legend>{i === 0 ? "Pool" : "Billaddare"}</legend>
              <label className="field">
                <span>{i === 0 ? "Poolens" : "Billaddarens"} regeltyp</span>
                <select
                  aria-label={`${i === 0 ? "Poolens" : "Billaddarens"} regeltyp`}
                  value={draft[key].type}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [key]:
                        e.target.value === "percent"
                          ? { type: "percent", value: 70 }
                          : { type: "fixed", value: 100 },
                    })
                  }
                >
                  <option value="percent">
                    Procent av högsta priset · kommande 24 h
                  </option>
                  <option value="fixed">Fast spotprisgräns</option>
                </select>
              </label>
              <label className="field">
                <span>
                  {i === 0 ? "Poolens" : "Billaddarens"}{" "}
                  {draft[key].type === "percent"
                    ? "gräns (%)"
                    : "gräns (öre/kWh)"}
                </span>
                <input
                  type="number"
                  aria-label={`${i === 0 ? "Poolens" : "Billaddarens"} ${draft[key].type === "percent" ? "gräns (%)" : "gräns (öre/kWh)"}`}
                  min={draft[key].type === "percent" ? 1 : -500}
                  max={draft[key].type === "percent" ? 100 : 5000}
                  step="1"
                  value={draft[key].value}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [key]: { ...draft[key], value: Number(e.target.value) },
                    })
                  }
                />
              </label>
              <p className="muted">
                {draft[key].type === "percent"
                  ? `Pausa vid minst ${draft[key].value} % av högsta priset. Exempel: 200 öre × 70 % = 140 öre/kWh. Hela nästa 24-timmarsperiod måste finnas; annars visas ”Inväntar priser”. Om alla priser är noll eller negativa finns ingen positiv pristopp att undvika.`
                  : `Pausa vid minst ${draft[key].value} öre/kWh. Spotpris exklusive moms och avgifter.`}
              </p>
            </fieldset>
          ))}
        </div>
        <p className="muted">
          Smart styrning måste också vara aktiverad för respektive kategori.
          Golvvärmens bidrag till grundlasten är en modell; dess hårdvara är
          fortfarande ej ansluten. Poolens komfort och säker drift måste
          verifieras innan modellen någonsin används för riktig styrning.
        </p>
        <Button type="submit">Spara simuleringsregler</Button>
        {message && (
          <p role="status" className="muted">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
