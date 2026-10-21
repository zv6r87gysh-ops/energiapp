"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Car,
  ChartColumn,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Flame,
  Home,
  Leaf,
  Menu,
  Plus,
  Settings,
  Sun,
  Moon,
  Wallet,
  Waves,
  Zap,
  WifiOff,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "./ui/button";
import { PricePanel } from "./price-panel";
import { SmartControlPanel } from "./smart-control";
import {
  applySmartControl,
  readSmartControl,
  categoryActive,
  changeSmartCategory,
} from "@/lib/smart-control";
import type { PriceArea } from "@/lib/prices/contracts";
import {
  catalog,
  demoSeries,
  initialHousehold,
  sections,
  zones,
} from "@/lib/demo";
import { cost, money, number, planCharging, stockholm } from "@/lib/energy";
import { demoMetrics } from "@/lib/demo-metrics";
import { integrationStatus } from "@/lib/adapters";
import { vehicleSchema, type Household, type Vehicle } from "@/lib/models";
const icons = [
  Home,
  Activity,
  Wallet,
  ChartNoAxesCombined,
  Waves,
  Car,
  Flame,
  ChartColumn,
  Leaf,
  Settings,
];
function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
function Metric({
  label,
  value,
  unit,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "accent" : ""}>
      <div className="metric-label">
        {label}
        <span className="metric-icon">
          <Zap size={17} />
        </span>
      </div>
      <div className="metric-value">
        {value} <small>{unit}</small>
      </div>
      <div className="metric-note">
        <ArrowDownRight size={14} />
        {note}
      </div>
    </Card>
  );
}
function Graph({
  data,
  field = "power",
  bars = false,
  label = "kW",
}: {
  data: object[];
  field?: string;
  bars?: boolean;
  label?: string;
}) {
  return (
    <div className="graph" role="img" aria-label={`Demodiagram: ${label}`}>
      <ResponsiveContainer width="100%" height="100%">
        {bars ? (
          <BarChart data={data}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="time"
              minTickGap={35}
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis width={35} tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip
              formatter={(v) => [`${v} ${label}`, "Demo"]}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}
            />
            <Bar
              dataKey={field}
              fill="#27957c"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        ) : (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`fill-${field}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#269a80" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#269a80" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="time"
              minTickGap={40}
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis width={35} tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip
              formatter={(v) => [`${v} ${label}`, "Demo"]}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}
            />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey={field}
              stroke="#208d75"
              strokeWidth={2.5}
              fill={`url(#fill-${field})`}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export default function EnergyApp({ section }: { section: string }) {
  const [homes, setHomes] = useState<Household[]>([
    structuredClone(initialHousehold),
  ]);
  const [active, setActive] = useState(initialHousehold.id);
  const [loaded, setLoaded] = useState(false);
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("Idag");
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState("2026-10-21");
  const [scenario, setScenario] = useState("normal");
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Vehicle>({
    ...initialHousehold.vehicles[0],
    id: "",
    brand: "",
    model: "",
    variant: "",
    nickname: "",
  });
  const [wizard, setWizard] = useState(0);
  const [deviceType, setDeviceType] = useState("Elmätare");
  const [manufacturer, setManufacturer] = useState("Boo Energi");
  const [deviceModel, setDeviceModel] = useState("Power Hub KM");
  const [connection, setConnection] = useState("Demonstration");
  const [deviceName, setDeviceName] = useState("Min energimätare");
  const [tested, setTested] = useState(false);
  const [soc, setSoc] = useState(35);
  const [target, setTarget] = useState(80);
  const [deadline, setDeadline] = useState("07:00");
  const [maxPrice, setMaxPrice] = useState(150);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Medlem");
  const [houseName, setHouseName] = useState("");
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      try {
        const saved = localStorage.getItem("energihem-demo-v1");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.homes) && parsed.homes.length) {
            setHomes(parsed.homes);
            setActive(parsed.active ?? parsed.homes[0].id);
          }
        }
        setDark(localStorage.getItem("energihem-dark") === "true");
      } catch {
        setNotice("Sparad demodata kunde inte läsas. Standardvärden används.");
      }
      setLoaded(true);
      setOffline(!navigator.onLine);
    });
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      mounted = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(
          "energihem-demo-v1",
          JSON.stringify({ homes, active }),
        );
        localStorage.setItem("energihem-dark", String(dark));
      } catch {
        /* UI continues without persistence. */
      }
    }
  }, [homes, active, dark, loaded]);
  const home = homes.find((h) => h.id === active) ?? homes[0];
  const update = (patch: Partial<Household>) =>
    setHomes((list) =>
      list.map((h) => (h.id === home.id ? { ...h, ...patch } : h)),
    );
  const smartControl = readSmartControl(home);
  const poolMode =
    home.pool.mode === "Smart" && !categoryActive(smartControl, "pool")
      ? "Manuellt"
      : home.pool.mode;
  const prices = demoSeries(96, home.region);
  const metrics = demoMetrics(home);
  const nowPrice = prices[56].price;
  const total = cost(metrics.projectedEnergy, 62, home.contract, home.tariff);
  const prediction = metrics.prediction;
  const car = home.vehicles.find((v) => v.isDefault) ?? home.vehicles[0];
  const plan = car
    ? planCharging(
        prices
          .filter((p) => p.time < deadline)
          .map((p) => ({
            ...p,
            timestamp: new Date(
              Date.parse(p.timestamp) + 86400000,
            ).toISOString(),
          })),
        car.battery,
        soc,
        target,
        car.ac,
        car.loss,
        maxPrice,
      )
    : null;
  const save = metrics.saving;
  const title = sections.find((s) => s.id === section)?.name ?? "Översikt";
  function saveVehicle() {
    const result = vehicleSchema.safeParse({
      ...draft,
      id: editId ?? crypto.randomUUID(),
      isDefault: home.vehicles.length === 0 || draft.isDefault,
    });
    if (!result.success) {
      setNotice("Kontrollera bilens namn, årsmodell, batteri och laddeffekt.");
      return;
    }
    const vehicle = result.data;
    let vehicles = editId
      ? home.vehicles.map((v) => (v.id === editId ? vehicle : v))
      : [...home.vehicles, vehicle];
    if (vehicle.isDefault)
      vehicles = vehicles.map((v) => ({
        ...v,
        isDefault: v.id === vehicle.id,
      }));
    if (!vehicles.some((v) => v.isDefault) && vehicles[0])
      vehicles[0].isDefault = true;
    update({ vehicles });
    setVehicleOpen(false);
    setNotice("Fordonet har sparats lokalt i demohushållet.");
  }
  const rangeData =
    period === "Senaste timmen"
      ? prices.slice(52, 57)
      : period === "Idag"
        ? prices.slice(0, 57)
        : period === "Vecka"
          ? metrics.rows.slice(14, 21)
          : period === "Anpassat intervall"
            ? metrics.rows.filter((r) => {
                const date = `2026-10-${r.time.padStart(2, "0")}`;
                return date >= from && date <= to;
              })
            : metrics.rows;
  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand" href="/">
          <span className="logo">
            <Zap size={24} fill="currentColor" />
          </span>
          energihem<span className="brand-dot">.</span>
        </Link>
        <p className="nav-caption">DITT SMARTA HEM</p>
        <nav>
          {sections.map((s, i) => {
            const Icon = icons[i];
            return (
              <Link
                key={s.id}
                href={s.id === "oversikt" ? "/" : `/${s.id}`}
                onClick={() => setMenu(false)}
                className={section === s.id ? "selected" : ""}
              >
                <Icon size={19} />
                <span>{s.name}</span>
                {section === s.id && <span className="nav-dot" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="leaf-icon">
            <Leaf size={23} />
          </div>
          <b>Små val. Stor skillnad.</b>
          <p>Lite smartare energi, varje dag.</p>
          <span className="badge">Demo · inga enheter styrs</span>
        </div>
        <div className="profile">
          <span className="avatar">EH</span>
          <div>
            <b>Mitt demohushåll</b>
            <small>Lokalt på den här enheten</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Öppna meny"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <div className="breadcrumb">
            Mitt hem <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <span className="badge">Demo</span>
            <button
              className="icon-button"
              aria-label="Växla färgtema"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <span className="avatar">EH</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">DITT HEM, I BALANS</div>
              <h1>
                {section === "oversikt" ? "God dag, välkommen hem" : title}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {section === "oversikt"
                  ? "Här är läget för din energi. Lite mer insikt, lite mindre kostnad."
                  : section === "elpriser"
                    ? "Publicerade spotpriser visas bara när källan är verifierad och tillgänglig."
                    : "Din energi, samlad på ett ställe. Hushållsvärdena är simulerade."}
              </p>
            </div>
            <select
              aria-label="Aktivt hushåll"
              value={home.id}
              onChange={(e) => setActive(e.target.value)}
            >
              {homes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <div className="demo-banner">
            <span>
              <span className="status-dot" />
              Du utforskar Energihem i demoläge
            </span>
            <small>
              Hushållsdata: Demo · 21 oktober 2026 kl. 14.00 · {home.region} ·
              Elpriser har separat källa
            </small>
          </div>
          {offline && (
            <div className="warning">
              <WifiOff size={18} />
              Du är offline. Visar sparad demonstration, inga aktuella
              mätvärden.
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button
                aria-label="Stäng meddelande"
                onClick={() => setNotice("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          <SmartControlPanel
            key={home.id}
            control={smartControl}
            onChange={(next) => update(applySmartControl(home, next))}
          />
          {section === "oversikt" && (
            <>
              <div className="metrics">
                <Metric
                  label="Förbrukning just nu"
                  value={number(metrics.currentPower)}
                  unit="kW"
                  note="Simulerad effekt"
                  accent
                />
                <PricePanel area={home.region as PriceArea} compact />
                <Metric
                  label="Prognos för oktober"
                  value={money(prediction.total)}
                  note="Inklusive avgifter och moms"
                />
                <Metric
                  label="Smart besparing"
                  value={number(save.amount, 0)}
                  unit="kr"
                  note="Modellerat denna månad"
                />
              </div>
              <div className="dashboard-grid">
                <Card title="Hemmets energipuls" className="wide">
                  <div className="chart-meta">
                    <span>
                      <i /> Förbrukning · Demo
                    </span>
                    <span>Idag till kl. 14 · kW</span>
                  </div>
                  <Graph data={prices.slice(0, 57)} />
                  <div className="chart-footer">
                    <span>
                      Idag <b>{number(metrics.dayEnergy)} kWh</b>
                    </span>
                    <span>
                      Denna månad <b>{number(metrics.monthEnergy, 0)} kWh</b>
                    </span>
                    <span>
                      Medel idag <b>{number(metrics.dayEnergy / 14)} kW</b>
                    </span>
                  </div>
                </Card>
                <Card className="insight">
                  <div className="insight-symbol">
                    <Leaf size={29} />
                  </div>
                  <span className="eyebrow">EN SMARTARE VARDAG</span>
                  <h2>
                    Låt elen jobba
                    <br />
                    på dina villkor.
                  </h2>
                  <p>
                    Nattens lägre demopriser ger ett bra tillfälle att ladda
                    bilen.
                  </p>
                  <div className="insight-saving">
                    <b>{number(save.percent, 0)} %</b>
                    <span>
                      modellerad besparing
                      <br />
                      på jämförbar laddning
                    </span>
                  </div>
                  <Link href="/besparing">
                    Se din besparing <ArrowUpRight size={18} />
                  </Link>
                </Card>
                <PricePanel area={home.region as PriceArea} chartOnly />
                <Card title="Ditt hem just nu">
                  <div className="device-row">
                    <span className="device-icon">
                      <Car />
                    </span>
                    <div>
                      <b>
                        {car
                          ? `${car.brand} ${car.model}`
                          : "Ingen bil tillagd"}
                      </b>
                      <small>
                        {home.charging
                          ? "Simulerad laddning pågår"
                          : "Pausad · Demo"}
                      </small>
                    </div>
                    <Link href="/laddning">
                      <ChevronRight />
                    </Link>
                  </div>
                  <div className="device-row">
                    <span className="device-icon blue">
                      <Waves />
                    </span>
                    <div>
                      <b>Poolen</b>
                      <small>
                        {number(home.pool.temperature)} °C · {poolMode} · Demo
                      </small>
                    </div>
                    <Link href="/pool">
                      <ChevronRight />
                    </Link>
                  </div>
                  <div className="device-row">
                    <span className="device-icon orange">
                      <Flame />
                    </span>
                    <div>
                      <b>Golvvärme</b>
                      <small>5 zoner · Ej anslutna</small>
                    </div>
                    <Link href="/golvvarme">
                      <ChevronRight />
                    </Link>
                  </div>
                  <div className="safe-note">
                    <Check size={15} /> Ingen fysisk utrustning är ansluten
                  </div>
                </Card>
              </div>
              <div className="quick-links">
                {[
                  { id: "laddning", text: "Planera laddning", icon: Car },
                  { id: "pool", text: "Se din pool", icon: Waves },
                  { id: "besparing", text: "Hitta besparingar", icon: Leaf },
                  { id: "elpriser", text: "Se billigaste kvarten", icon: Zap },
                ].map((a) => (
                  <Link key={a.id} href={`/${a.id}`}>
                    <a.icon size={20} />
                    {a.text}
                    <ArrowUpRight size={17} />
                  </Link>
                ))}
              </div>
              <Card title="Månadens kostnadsutveckling · Demo">
                <Graph
                  data={metrics.rows.map((d, i) => ({
                    ...d,
                    cost: metrics.rows
                      .slice(0, i + 1)
                      .reduce((s, r) => s + r.cost, 0),
                  }))}
                  field="cost"
                  label="kr"
                />
              </Card>
            </>
          )}
          {(section === "forbrukning" || section === "statistik") && (
            <>
              <div className="metrics">
                <Metric
                  label="Total effekt"
                  value={number(metrics.currentPower)}
                  unit="kW"
                  note="Demo · inte uppmätt"
                />
                <Metric
                  label="Förbrukning idag"
                  value={number(metrics.dayEnergy)}
                  unit="kWh"
                  note="Simulerad energiförbrukning"
                />
                <Metric
                  label="Denna månad"
                  value={number(metrics.monthEnergy, 0)}
                  unit="kWh"
                  note="Till 21 oktober kl. 14 · Demo"
                />
                <Metric
                  label="Kostnad per timme"
                  value={money(
                    cost(2.4, nowPrice, home.contract, home.tariff, false)
                      .total,
                  )}
                  note="Rörliga avgifter inklusive moms"
                />
              </div>
              <Card
                title={
                  section === "statistik"
                    ? "Historik och jämförelse"
                    : "Förbrukning över tid"
                }
              >
                <div className="toolbar">
                  <select
                    aria-label="Tidsperiod"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    {[
                      "Senaste timmen",
                      "Idag",
                      "Vecka",
                      "Månad",
                      "År",
                      "Anpassat intervall",
                    ].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  {period === "Anpassat intervall" && (
                    <>
                      <input
                        aria-label="Från datum"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                      <input
                        aria-label="Till datum"
                        type="date"
                        min={from}
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </>
                  )}
                  <span className="muted">
                    Demo · {period === "År" ? "Månadsöversikt" : period}
                  </span>
                </div>
                <Graph
                  data={
                    period === "År"
                      ? Array.from({ length: 12 }, (_, i) => ({
                          time: [
                            "Jan",
                            "Feb",
                            "Mar",
                            "Apr",
                            "Maj",
                            "Jun",
                            "Jul",
                            "Aug",
                            "Sep",
                            "Okt",
                            "Nov",
                            "Dec",
                          ][i],
                          energy: 600 + ((i * 127) % 700),
                        }))
                      : rangeData
                  }
                  field={
                    period === "Idag" || period === "Senaste timmen"
                      ? "power"
                      : "energy"
                  }
                  bars={section === "statistik"}
                  label={
                    period === "Idag" || period === "Senaste timmen"
                      ? "kW"
                      : "kWh"
                  }
                />
              </Card>
              <div className="two-col">
                <Card title="Fördelning · uppskattade demovärden">
                  {[
                    ["Elbilsladdning", 40],
                    ["Poolvärmepump", 25],
                    ["Övrigt hushåll", 35],
                  ].map(([name, p]) => (
                    <div className="distribution" key={name}>
                      <span>{name}</span>
                      <b>{p} %</b>
                      <div>
                        <i style={{ width: `${p}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="muted">
                    Ingen separat mätkälla. Uppvärmning ingår i hushållets
                    uppskattning. Fasvärden är inte tillgängliga.
                  </p>
                </Card>
                <Card title="Kostnader och besparingar">
                  <Graph
                    data={metrics.savingsRows}
                    field="saving"
                    bars
                    label="kr"
                  />
                  <p className="muted">
                    Modellerad besparing från samma sex laddsessioner som
                    besparingssidan. Historiska jämförelser är simulerade.
                  </p>
                </Card>
              </div>
            </>
          )}
          {section === "kostnad" && (
            <>
              <div className="metrics">
                <Metric
                  label="Kostnad hittills"
                  value={money(metrics.spent)}
                  note="Simulerad, till 21 oktober kl. 14"
                />
                <Metric
                  label="Återstående månad"
                  value={money(prediction.remaining)}
                  note="Baserat på samma dygnstakt"
                />
                <Metric
                  label="Månadsprognos"
                  value={money(prediction.total)}
                  note={`${money(prediction.low)}–${money(prediction.high)}`}
                  accent
                />
                <Metric
                  label="Mot föregående månad"
                  value="−8"
                  unit="%"
                  note="Jämförelse mellan demoperioder"
                />
              </div>
              <div className="two-col">
                <Card title="Så fördelas kostnaden">
                  <Graph data={metrics.rows} field="cost" bars label="kr" />
                  <p>
                    Rörlig kostnad: <b>{money(total.energy)}</b> · Fasta
                    avgifter: <b>{money(total.fixed)}</b>
                  </p>
                </Card>
                <Card title="Så har vi räknat">
                  <p>
                    Prognosen använder {number(metrics.projectedEnergy, 0)} kWh
                    och ett förbrukningsvägt demospotpris på 62 öre/kWh för hela
                    månaden. Hittillsvärdet summeras från samma dygnsserie som
                    diagrammet.
                  </p>
                  <p>
                    Alla avgifter i inställningarna anges exklusive moms.
                    Energiskatt läggs till en gång och moms beräknas en gång på
                    summan.
                  </p>
                  <p>
                    Osäkerhetsintervallet är ett illustrativt ±15 %, inte ett
                    statistiskt konfidensintervall. Tidsberoende nätavgift är
                    ett manuellt vägt tillägg i denna demo.
                  </p>
                  <Link className="text-link" href="/installningar">
                    Ändra elavtal och avgifter <ChevronRight size={16} />
                  </Link>
                </Card>
              </div>
            </>
          )}
          {section === "elpriser" && (
            <>
              <div className="toolbar">
                <select
                  aria-label="Elområde"
                  value={home.region}
                  onChange={(e) => update({ region: e.target.value })}
                >
                  {["SE1", "SE2", "SE3", "SE4"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
              <PricePanel area={home.region as PriceArea} />
            </>
          )}
          {section === "pool" && (
            <>
              <div className="metrics">
                <Metric
                  label="Vattentemperatur"
                  value={number(home.pool.temperature)}
                  unit="°C"
                  note="Simulerad temperatur"
                  accent
                />
                <Metric
                  label="Önskad temperatur"
                  value={number(home.pool.target)}
                  unit="°C"
                  note="Lokalt sparat demobörvärde"
                />
                <Metric
                  label="Uppskattad energi idag"
                  value="8,2"
                  unit="kWh"
                  note="Modell: effekt × drifttid"
                />
                <Metric
                  label="Dagens elkostnad"
                  value={money(
                    cost(8.2, 62, home.contract, home.tariff, false).total,
                  )}
                  note="Uppskattad · Demo"
                />
              </div>
              <div className="two-col">
                <Card title="Poolens komfort">
                  <div className="pool-visual">
                    <Waves size={48} />
                    <strong>{number(home.pool.temperature)}°</strong>
                    <span>
                      {home.pool.length} × {home.pool.width} m ·{" "}
                      {home.pool.model}
                    </span>
                  </div>
                  <Field label={`Önskad temperatur: ${home.pool.target} °C`}>
                    <input
                      type="range"
                      min="20"
                      max="32"
                      step="0.5"
                      value={home.pool.target}
                      onChange={(e) =>
                        update({
                          pool: {
                            ...home.pool,
                            target: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Simulerat driftläge">
                    <select
                      value={poolMode}
                      onChange={(e) =>
                        update({
                          ...applySmartControl(
                            home,
                            changeSmartCategory(
                              smartControl,
                              "pool",
                              e.target.value === "Smart",
                            ),
                          ),
                          pool: { ...home.pool, mode: e.target.value },
                        })
                      }
                    >
                      {[
                        "Smart",
                        "Komfort",
                        "Sparläge",
                        "Manuellt",
                        "Paus",
                        "Semester",
                      ].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                </Card>
                <Card title="Planerad drift · Demo">
                  <p className="large-text">
                    {categoryActive(smartControl, "pool")
                      ? "10.00 – 14.00"
                      : "Smart simulering av"}
                  </p>
                  <p>
                    Temperaturintervall: 27–28 °C. Modellerad månadsenergi: 246
                    kWh. Månadskostnad:{" "}
                    {money(
                      cost(246, 62, home.contract, home.tariff, false).total,
                    )}
                    .
                  </p>
                  <p>
                    Besparing: modell ej validerad för värmebehov och komfort.
                    Ingen verifierad besparing visas.
                  </p>
                  <div className="warning">
                    WiFi-modul inte installerad. API, minsta drifttid och
                    mätstöd är inte verifierade.
                  </div>
                  <p className="muted">
                    Datakälla: uppskattning. Framtida stöd: egen kWh-avläsning
                    eller separat energimätare. Reglagen ändrar bara
                    demonstrationen.
                  </p>
                </Card>
              </div>
            </>
          )}
          {section === "laddning" && (
            <>
              <div className="metrics">
                <Metric
                  label="Zaptec · Demo"
                  value={home.charging ? "Laddar" : "Pausad"}
                  note="Ingen verklig anslutning"
                  accent
                />
                <Metric
                  label="Simulerad effekt"
                  value={home.charging ? "6,0" : "0,0"}
                  unit="kW"
                  note={home.charging ? "3 × 8,7 A · Demo" : "0 A · Demo"}
                />
                <Metric
                  label="Laddat i sessionen"
                  value="12,8"
                  unit="kWh"
                  note="Demohistorik"
                />
                <Metric
                  label="Laddkostnad"
                  value={money(
                    cost(12.8, 45, home.contract, home.tariff, false).total,
                  )}
                  note="Rörlig demokostnad"
                />
              </div>
              <div className="two-col">
                <Card
                  title={
                    categoryActive(smartControl, "charging")
                      ? "Smart laddning · Demo"
                      : "Laddplanering · Demo"
                  }
                >
                  <div className="car-heading">
                    <Car size={42} />
                    <div>
                      <h3>
                        {car ? `${car.brand} ${car.model}` : "Lägg till en bil"}
                      </h3>
                      <span className="muted">
                        Batterinivå anges manuellt, läses inte från Zaptec
                      </span>
                    </div>
                  </div>
                  <div className="form-grid">
                    <Field label="Batterinivå nu (%)">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={soc}
                        onChange={(e) =>
                          setSoc(
                            Math.max(0, Math.min(100, Number(e.target.value))),
                          )
                        }
                      />
                    </Field>
                    <Field label="Målnivå (%)">
                      <input
                        type="number"
                        min={soc}
                        max="100"
                        value={target}
                        onChange={(e) =>
                          setTarget(
                            Math.max(
                              soc,
                              Math.min(100, Number(e.target.value)),
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Klar senast (nästa demodygn)">
                      <input
                        type="time"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                      />
                    </Field>
                    <Field label="Max spotpris (öre/kWh)">
                      <input
                        type="number"
                        min="0"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(Number(e.target.value))}
                      />
                    </Field>
                  </div>
                  {plan && (
                    <div className="calculation">
                      <b>
                        {number(plan.needed)} kWh från elnätet · cirka{" "}
                        {number(plan.hours)} timmar
                      </b>
                      <p>
                        Spotkostnad: {money(plan.spotCost)} exkl. moms och
                        avgifter.{" "}
                        {plan.selected.length
                          ? `Första valda kvart: ${stockholm(plan.selected[0].timestamp)}`
                          : "Inga lämpliga kvartar."}
                      </p>
                      {plan.missing > 0.01 && (
                        <p className="error">
                          Målet kan inte nås inom vald tid/prisgräns:{" "}
                          {number(plan.missing)} kWh saknas.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="toolbar">
                    <Button
                      onClick={() => {
                        update({ charging: !home.charging });
                        setNotice(
                          "Laddstatus ändrad i demonstrationen. Inget kommando har skickats.",
                        );
                      }}
                    >
                      {home.charging ? "Pausa simulering" : "Starta simulering"}
                    </Button>
                    <Button
                      className="secondary"
                      onClick={() =>
                        update(
                          applySmartControl(
                            home,
                            changeSmartCategory(
                              smartControl,
                              "charging",
                              !categoryActive(smartControl, "charging"),
                            ),
                          ),
                        )
                      }
                    >
                      Smart simulering:{" "}
                      {categoryActive(smartControl, "charging") ? "på" : "av"}
                    </Button>
                  </div>
                  <p className="muted">
                    Ingen lastbalansering. Sense P1 är ej installerad och
                    KM-kompatibilitet är inte verifierad. Framtida styrning
                    måste utesluta konkurrerande schemaläggare.
                  </p>
                </Card>
                <Card title="Dina fordon">
                  <Button
                    className="secondary"
                    onClick={() => {
                      setEditId(null);
                      setDraft({
                        ...initialHousehold.vehicles[0],
                        id: "",
                        brand: "",
                        model: "",
                        variant: "",
                        nickname: "",
                        isDefault: false,
                      });
                      setVehicleOpen(true);
                    }}
                  >
                    <Plus size={16} /> Lägg till bil
                  </Button>
                  {home.vehicles.map((v) => (
                    <div className="vehicle-row" key={v.id}>
                      <div>
                        <b>{v.nickname || `${v.brand} ${v.model}`}</b>
                        <small>
                          {v.brand} {v.model} · {v.variant} · {v.year}
                        </small>
                        <small>
                          {v.battery} kWh · {v.ac} kW AC ·{" "}
                          {v.isDefault
                            ? "Standardbil"
                            : "Manuellt angivna specifikationer"}
                        </small>
                      </div>
                      <div className="toolbar">
                        <Button
                          className="subtle"
                          onClick={() => {
                            setDraft(v);
                            setEditId(v.id);
                            setVehicleOpen(true);
                          }}
                        >
                          Redigera
                        </Button>
                        <Button
                          className="subtle"
                          onClick={() =>
                            update({
                              vehicles: home.vehicles.map((a) => ({
                                ...a,
                                isDefault: a.id === v.id,
                              })),
                            })
                          }
                        >
                          Välj standard
                        </Button>
                        <Button
                          className="subtle"
                          onClick={() => {
                            const next = home.vehicles.filter(
                              (a) => a.id !== v.id,
                            );
                            if (next.length && !next.some((a) => a.isDefault))
                              next[0] = { ...next[0], isDefault: true };
                            update({ vehicles: next });
                          }}
                        >
                          Ta bort
                        </Button>
                      </div>
                    </div>
                  ))}
                  <p className="muted">
                    Tekniska specifikationer är manuella demoantaganden och
                    behöver kontrolleras för din bil.
                  </p>
                </Card>
              </div>
              <Card title="Laddhistorik · Demo">
                <table>
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Fordon</th>
                      <th>Energi</th>
                      <th>Kostnad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[20, 18, 16].map((d) => (
                      <tr key={d}>
                        <td>{d} oktober</td>
                        <td>
                          {car ? `${car.brand} ${car.model}` : "Okänt fordon"} ·
                          simulerad koppling
                        </td>
                        <td>25 kWh</td>
                        <td>
                          {money(
                            cost(25, 45, home.contract, home.tariff, false)
                              .total,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
          {section === "golvvarme" && (
            <>
              <div className="warning">
                Thermotech EC8 · Qvantum · Vattenburen golvvärme. Ingen
                integration eller styrning är aktiverad.
              </div>
              <div className="zone-grid">
                {zones.map((z) => (
                  <Card key={z}>
                    <div className="zone-icon">
                      <Flame size={24} />
                    </div>
                    <h2>{z}</h2>
                    <span className="badge neutral">Ej ansluten</span>
                    <div className="zone-details">
                      <span>
                        Rumstemperatur <b>– °C</b>
                      </span>
                      <span>
                        Börvärde <b>– °C</b>
                      </span>
                      <span>
                        Värmebehov <b>Okänt</b>
                      </span>
                    </div>
                    <Button disabled>Styrning inte tillgänglig</Button>
                  </Card>
                ))}
              </div>
              <Card title="Komfort och säker drift">
                <p>
                  Golvvärmen är husets enda uppvärmningskälla. Hårdvarans
                  kompatibilitet, reglerprinciper och säkerhetsgränser ska
                  undersökas innan någon styrintegration byggs.
                </p>
              </Card>
            </>
          )}
          {section === "besparing" && (
            <>
              <div className="metrics">
                <Metric
                  label="Idag"
                  value="0"
                  unit="kr"
                  note="Modellerad uppskattning"
                />
                <Metric
                  label="Denna månad"
                  value={number(save.amount, 0)}
                  unit="kr"
                  note="Samma laddenergi jämförs"
                  accent
                />
                <Metric
                  label="I år / sedan demostart"
                  value={number(save.amount, 0)}
                  unit="kr"
                  note="Demostart 1 oktober"
                />
                <Metric
                  label="Besparing laddning"
                  value={number(save.percent, 0)}
                  unit="%"
                  note="Modellerat · inte uppmätt"
                />
              </div>
              <div className="toolbar">
                <Button
                  className={scenario === "normal" ? "" : "secondary"}
                  onClick={() => setScenario("normal")}
                >
                  Normal drift
                </Button>
                <Button
                  className={scenario === "constant" ? "" : "secondary"}
                  onClick={() => setScenario("constant")}
                >
                  Konstant drift
                </Button>
              </div>
              <div className="two-col">
                <Card
                  title={
                    scenario === "normal"
                      ? "Samma behov, smartare timing"
                      : "Hypotetisk jämförelse – inte faktisk besparing"
                  }
                >
                  {scenario === "normal" ? (
                    <>
                      <p>
                        Sex laddsessioner med totalt 150 kWh från elnätet.
                        Normal drift startar direkt; smart drift flyttar samma
                        energi till billigare kvartar.
                      </p>
                      <div className="comparison">
                        <div>
                          <span>Normal drift</span>
                          <strong>{money(metrics.baseline)}</strong>
                        </div>
                        <div>
                          <span>Smart drift</span>
                          <strong>{money(metrics.optimized)}</strong>
                        </div>
                      </div>
                      <p className="muted">
                        Gemensamma avgifter ingår i båda scenarierna. Skillnaden
                        är {money(save.amount)}. Prognos för månaden:{" "}
                        {money((save.amount / metrics.elapsed) * 31)}.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        Poolens antagna eleffekt 2 kW × 24 h jämförs med 2 kW ×
                        4 h. Energibehoven skiljer sig och resultatet får inte
                        tolkas som faktisk besparing.
                      </p>
                      <p className="large-text">48 jämfört med 8 kWh/dygn</p>
                      <p className="muted">
                        Tar inte hänsyn till värmeförluster, utomhustemperatur,
                        COP eller komfort.
                      </p>
                    </>
                  )}
                  <details>
                    <summary>Så har vi räknat</summary>
                    <p>
                      Besparing = jämförelsekostnad − optimerad kostnad. Alla
                      värden är simulerade. Laddning: samma energi, avgifter och
                      jämförbara demoprisperioder. Pool: ingen verifierad
                      besparing; kräver en kalibrerad värmemodell. Golvvärme:
                      inga beräkningar ännu.
                    </p>
                  </details>
                </Card>
                <Card title="Besparing över tid · modellerad">
                  <div className="toolbar">
                    <select
                      aria-label="Besparingsperiod"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      {["Idag", "Vecka", "Månad"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <Graph
                    data={
                      period === "Idag"
                        ? metrics.savingsRows.slice(20, 21)
                        : period === "Vecka"
                          ? metrics.savingsRows.slice(14, 21)
                          : metrics.savingsRows
                    }
                    field="saving"
                    bars
                    label="kr"
                  />
                </Card>
              </div>
              <Card title="Fördelning per enhet">
                <div className="device-row">
                  <Car />
                  <b>Elbil</b>
                  <span className="push">
                    {money(save.amount)} · modellerat
                  </span>
                </div>
                <div className="device-row">
                  <Waves />
                  <b>Pool</b>
                  <span className="push">Ej verifierbar ännu</span>
                </div>
                <div className="device-row">
                  <Flame />
                  <b>Uppvärmning</b>
                  <span className="push">Ej ansluten</span>
                </div>
              </Card>
            </>
          )}
          {section === "installningar" && (
            <>
              <div className="two-col">
                <Card title="Ditt hushåll">
                  <div className="form-grid">
                    {(
                      [
                        ["name", "Hushållets namn"],
                        ["type", "Bostadstyp"],
                        ["area", "Boyta (m²)"],
                        ["floors", "Våningar"],
                        ["grid", "Elnätsbolag"],
                        ["supplier", "Elhandelsbolag"],
                        ["fuse", "Säkring (A)"],
                        ["heating", "Uppvärmningssystem"],
                        ["meter", "Elmätare och gränssnitt"],
                      ] as const
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <input
                          type={
                            typeof home[key] === "number" ? "number" : "text"
                          }
                          min="1"
                          value={home[key]}
                          onChange={(e) =>
                            update({
                              [key]:
                                typeof home[key] === "number"
                                  ? Math.max(1, Number(e.target.value))
                                  : e.target.value,
                            })
                          }
                        />
                      </Field>
                    ))}
                    <Field label="Elområde">
                      <select
                        value={home.region}
                        onChange={(e) => update({ region: e.target.value })}
                      >
                        {["SE1", "SE2", "SE3", "SE4"].map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </Field>
                    {(["length", "width", "depth"] as const).map((key, i) => (
                      <Field
                        key={key}
                        label={`Pool ${["längd", "bredd", "djup"][i]} (m)`}
                      >
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={home.pool[key]}
                          onChange={(e) =>
                            update({
                              pool: {
                                ...home.pool,
                                [key]: Math.max(0.1, Number(e.target.value)),
                              },
                            })
                          }
                        />
                      </Field>
                    ))}
                    <Field label="Poolvärmepump">
                      <input
                        value={home.pool.model}
                        onChange={(e) =>
                          update({
                            pool: { ...home.pool, model: e.target.value },
                          })
                        }
                      />
                    </Field>
                  </div>
                  <p className="muted">
                    Ändringar sparas automatiskt i denna webbläsare.
                  </p>
                </Card>
                <Card title="Elavtal och nätavgifter">
                  <p className="muted">
                    Kvartspris · alla belopp exkl. moms. Rörliga avgifter i
                    öre/kWh, fasta i kr/månad.
                  </p>
                  <div className="form-grid">
                    {(
                      [
                        ["markup", "Elhandelspåslag"],
                        ["monthly", "Fast elhandelsavgift"],
                        ["vat", "Moms (%)"],
                        ["discount", "Kampanjrabatt (kr/mån)"],
                      ] as const
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={home.contract[key]}
                          onChange={(e) =>
                            update({
                              contract: {
                                ...home.contract,
                                [key]: Math.max(0, Number(e.target.value)),
                              },
                            })
                          }
                        />
                      </Field>
                    ))}
                    {(
                      [
                        ["variable", "Rörlig nätavgift"],
                        ["tax", "Energiskatt"],
                        ["monthly", "Fast nätavgift"],
                        ["demand", "Effektavgift (kr/mån)"],
                        ["timeBased", "Tidsvägt nättillägg"],
                      ] as const
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={home.tariff[key]}
                          onChange={(e) =>
                            update({
                              tariff: {
                                ...home.tariff,
                                [key]: Math.max(0, Number(e.target.value)),
                              },
                            })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <p className="muted">
                    Effektavgiften är ett manuellt månadsbelopp, inte en
                    beräkning från effekttoppar.
                  </p>
                </Card>
              </div>
              <Card title="Anslutna enheter">
                <Button
                  className="secondary"
                  onClick={() => {
                    setWizard(1);
                    setTested(false);
                  }}
                >
                  <Plus size={16} /> Lägg till demoenhet
                </Button>
                {integrationStatus.map((d) => (
                  <div className="device-row" key={d.name}>
                    <span className="device-icon">
                      <Zap size={19} />
                    </span>
                    <div>
                      <b>{d.name}</b>
                      <small>{d.status}</small>
                      <small>
                        Datakälla: ingen verklig anslutning · senaste avläsning:
                        saknas
                      </small>
                    </div>
                  </div>
                ))}
                {home.devices.map((d) => (
                  <div className="device-row" key={d.id}>
                    <Check />
                    <div>
                      <b>{d.name}</b>
                      <small>
                        {d.manufacturer} · {d.model} · Demo · {d.status}
                      </small>
                      <small>
                        Simulerad avläsning och status · inga styrkommandon
                      </small>
                    </div>
                    <Button
                      className="subtle push"
                      onClick={() =>
                        update({
                          devices: home.devices.filter((a) => a.id !== d.id),
                        })
                      }
                    >
                      Ta bort
                    </Button>
                  </div>
                ))}
              </Card>
              <div className="two-col">
                <Card title="Hushåll och medlemmar · Demo">
                  <p className="muted">
                    Lokala demohushåll hålls åtskilda. Detta är ingen
                    autentisering eller säker fleranvändartjänst.
                  </p>
                  <div className="toolbar">
                    <input
                      aria-label="Nytt hushållsnamn"
                      placeholder="Nytt hushållsnamn"
                      value={houseName}
                      onChange={(e) => setHouseName(e.target.value)}
                    />
                    <Button
                      onClick={() => {
                        if (!houseName.trim()) return;
                        const id = crypto.randomUUID();
                        setHomes([
                          ...homes,
                          {
                            ...structuredClone(initialHousehold),
                            id,
                            name: houseName,
                            vehicles: [],
                            devices: [],
                            invitations: [],
                          },
                        ]);
                        setActive(id);
                        setHouseName("");
                      }}
                    >
                      Skapa hushåll
                    </Button>
                  </div>
                  <p>Du · Ägare (demo)</p>
                  <div className="toolbar">
                    <input
                      type="email"
                      aria-label="E-post för demoinbjudan"
                      placeholder="namn@exempel.se"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <select
                      aria-label="Roll"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      {["Administratör", "Medlem", "Läsbehörig"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <Button
                      onClick={() => {
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                          setNotice("Ange en giltig e-postadress.");
                          return;
                        }
                        update({
                          invitations: [
                            ...home.invitations,
                            {
                              id: crypto.randomUUID(),
                              householdId: home.id,
                              createdAt: new Date().toISOString(),
                              email,
                              role:
                                role === "Administratör"
                                  ? "admin"
                                  : role === "Läsbehörig"
                                    ? "viewer"
                                    : "member",
                              status: "pending",
                            },
                          ],
                        });
                        setEmail("");
                        setNotice(
                          "Demoinbjudan skapad lokalt. Ingen e-post skickades.",
                        );
                      }}
                    >
                      Simulera inbjudan
                    </Button>
                  </div>
                  {home.invitations.map((i) => (
                    <div className="device-row" key={i.id}>
                      <div>
                        <b>{i.email}</b>
                        <small>
                          {i.role === "admin"
                            ? "Administratör"
                            : i.role === "viewer"
                              ? "Läsbehörig"
                              : "Medlem"}{" "}
                          ·{" "}
                          {i.status === "pending"
                            ? "Väntar (demo)"
                            : "Accepterad (demo)"}
                        </small>
                      </div>
                      {i.status === "pending" && (
                        <Button
                          className="subtle"
                          onClick={() =>
                            update({
                              invitations: home.invitations.map((a) =>
                                a.id === i.id
                                  ? { ...a, status: "accepted" }
                                  : a,
                              ),
                            })
                          }
                        >
                          Simulera acceptans
                        </Button>
                      )}
                      <Button
                        className="subtle"
                        onClick={() =>
                          update({
                            invitations: home.invitations.filter(
                              (a) => a.id !== i.id,
                            ),
                          })
                        }
                      >
                        Ta bort
                      </Button>
                    </div>
                  ))}
                </Card>
                <Card title="Integritet och framtida anslutning">
                  <p>
                    Demodata lagras endast i webbläsarens localStorage. Skriv
                    inte in lösenord, API-nycklar eller andra hemligheter.
                  </p>
                  <p>
                    Supabase-autentisering och serverkontroller med Row Level
                    Security införs i fas 2 innan riktiga hushållsdata lagras.
                    Fjärråtkomst kräver säker driftsättning.
                  </p>
                  <Button
                    className="secondary"
                    onClick={() => {
                      if (window.confirm("Återställa all lokal demodata?")) {
                        setHomes([structuredClone(initialHousehold)]);
                        setActive(initialHousehold.id);
                      }
                    }}
                  >
                    Återställ demonstration
                  </Button>
                </Card>
              </div>
            </>
          )}
          <footer>
            Energihem <span>Lite smartare. Lite grönare.</span>
            <small>
              Hushållsdata: Demo · Elpriser: separat källa · Inga styrkommandon
            </small>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav">
        {[0, 3, 5, 8].map((i) => {
          const Icon = icons[i];
          return (
            <Link
              className={section === sections[i].id ? "active" : ""}
              key={i}
              href={i === 0 ? "/" : `/${sections[i].id}`}
            >
              <Icon size={20} />
              {
                ["Hem", "Elpriser", "Laddning", "Besparing"][
                  [0, 3, 5, 8].indexOf(i)
                ]
              }
            </Link>
          );
        })}
        <button onClick={() => setMenu(!menu)}>
          <Menu size={20} />
          Mer
        </button>
      </nav>
      {vehicleOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vehicle-title"
          >
            <div className="modal-heading">
              <h2 id="vehicle-title">
                {editId ? "Redigera fordon" : "Lägg till fordon"}
              </h2>
              <button
                aria-label="Stäng fordonsdialog"
                onClick={() => setVehicleOpen(false)}
              >
                <X />
              </button>
            </div>
            <Field label="Sök bilmärke eller modell">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sök t.ex. Volvo EX30"
                role="combobox"
                aria-expanded={search.length > 0}
                aria-controls="car-results"
              />
            </Field>
            {search && (
              <ul id="car-results" role="listbox" className="search-results">
                {Object.entries(catalog)
                  .flatMap(([brand, models]) =>
                    models.map((model) => ({ brand, model })),
                  )
                  .filter((v) =>
                    `${v.brand} ${v.model}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .slice(0, 12)
                  .map((v) => (
                    <li key={v.brand + v.model}>
                      <button
                        role="option"
                        aria-selected={
                          draft.brand === v.brand && draft.model === v.model
                        }
                        onClick={() => {
                          setDraft({ ...draft, ...v, variant: "" });
                          setSearch("");
                        }}
                      >
                        {v.brand} {v.model}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            <div className="form-grid">
              <Field label="Bilmärke">
                <input
                  list="brands"
                  value={draft.brand}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      brand: e.target.value,
                      model: "",
                      variant: "",
                    })
                  }
                />
                <datalist id="brands">
                  {Object.keys(catalog).map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </datalist>
              </Field>
              <Field label="Modell">
                <input
                  list="models"
                  value={draft.model}
                  onChange={(e) =>
                    setDraft({ ...draft, model: e.target.value, variant: "" })
                  }
                />
                <datalist id="models">
                  {(catalog[draft.brand] ?? []).map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </datalist>
              </Field>
              <Field label="Motorvariant / drivlina (manuell)">
                <input
                  list="variants"
                  value={draft.variant}
                  onChange={(e) =>
                    setDraft({ ...draft, variant: e.target.value })
                  }
                />
                <datalist id="variants">
                  {draft.brand === "Volvo" && draft.model === "EX30" && (
                    <option>Single Motor Extended Range</option>
                  )}
                </datalist>
              </Field>
              <Field label="Årsmodell (bekräfta själv)">
                <input
                  type="number"
                  min="1990"
                  max="2035"
                  value={draft.year}
                  onChange={(e) =>
                    setDraft({ ...draft, year: Number(e.target.value) })
                  }
                />
              </Field>
              {(
                [
                  ["battery", "Användbar batterikapacitet (kWh)"],
                  ["ac", "Maximal AC-laddeffekt (kW)"],
                  ["loss", "Uppskattad laddförlust (%)"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: Number(e.target.value) })
                    }
                  />
                </Field>
              ))}
              <Field label="Smeknamn">
                <input
                  value={draft.nickname}
                  onChange={(e) =>
                    setDraft({ ...draft, nickname: e.target.value })
                  }
                />
              </Field>
              <Field label="Registreringsnummer (frivilligt)">
                <input
                  value={draft.registration}
                  onChange={(e) =>
                    setDraft({ ...draft, registration: e.target.value })
                  }
                />
              </Field>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(e) =>
                  setDraft({ ...draft, isDefault: e.target.checked })
                }
              />
              Använd som standardbil
            </label>
            <p className="muted">
              Katalogen innehåller modellnamn. Variant, årsmodell och tekniska
              data måste anges och verifieras manuellt. Förifyllda siffror är
              demoantaganden, inte verifierade fordonsuppgifter.
            </p>
            <Button onClick={saveVehicle}>Spara fordon</Button>
          </section>
        </div>
      )}
      {wizard > 0 && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wizard-title"
          >
            <div className="modal-heading">
              <h2 id="wizard-title">Lägg till demoenhet</h2>
              <button
                aria-label="Stäng enhetsguide"
                onClick={() => setWizard(0)}
              >
                <X />
              </button>
            </div>
            <p className="eyebrow">STEG {wizard} AV 7 · ENDAST DEMONSTRATION</p>
            {wizard === 1 && (
              <Field label="Enhetstyp">
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value)}
                >
                  {["Elmätare", "Laddbox", "Poolvärmepump", "Annan enhet"].map(
                    (t) => (
                      <option key={t}>{t}</option>
                    ),
                  )}
                </select>
              </Field>
            )}
            {wizard === 2 && (
              <Field label="Tillverkare">
                <input
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </Field>
            )}
            {wizard === 3 && (
              <Field label="Modell">
                <input
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                />
              </Field>
            )}
            {wizard === 4 && (
              <Field label="Anslutningsmetod">
                <select
                  value={connection}
                  onChange={(e) => setConnection(e.target.value)}
                >
                  <option>Demonstration</option>
                </select>
              </Field>
            )}
            {wizard === 5 && (
              <Field label="Enhetens namn (inga hemligheter)">
                <input
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
              </Field>
            )}
            {wizard === 6 && (
              <>
                <p>
                  Testet kontrollerar endast att demoformuläret är ifyllt. Ingen
                  nätverksanslutning görs.
                </p>
                <Button
                  onClick={() => {
                    setTested(
                      Boolean(
                        deviceName.trim() &&
                        manufacturer.trim() &&
                        deviceModel.trim(),
                      ),
                    );
                    setNotice(
                      "Demotest utfört. Ingen riktig enhet har anslutits.",
                    );
                  }}
                >
                  Testa demonstration
                </Button>
                {tested && (
                  <p>
                    <Check size={18} /> Demokonfigurationen är komplett.
                  </p>
                )}
              </>
            )}
            {wizard === 7 && (
              <p>
                {deviceName} · {deviceType} · {manufacturer} · {deviceModel}.
                Sparas som demoenhet utan verklig anslutning.
              </p>
            )}
            <div className="toolbar">
              <Button
                className="secondary"
                disabled={wizard === 1}
                onClick={() => setWizard(wizard - 1)}
              >
                Tillbaka
              </Button>
              <Button
                disabled={
                  (wizard === 6 && !tested) ||
                  (wizard === 5 && !deviceName.trim())
                }
                onClick={() => {
                  if (wizard < 7) setWizard(wizard + 1);
                  else {
                    update({
                      devices: [
                        ...home.devices,
                        {
                          id: crypto.randomUUID(),
                          householdId: home.id,
                          createdAt: new Date().toISOString(),
                          name: deviceName,
                          manufacturer,
                          model: deviceModel,
                          source: "demo",
                          status: "Simulerad anslutning",
                        },
                      ],
                    });
                    setWizard(0);
                  }
                }}
              >
                {wizard === 7 ? "Slutför demo" : "Nästa"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
