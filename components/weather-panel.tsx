"use client";
import Link from "next/link";
import { useState } from "react";
import { CloudSun, Thermometer, Wind } from "lucide-react";
import { WeatherTimeline } from "./weather-timeline";
import { Button } from "./ui/button";
import { number } from "@/lib/energy";
import { addDate, priceTime, swedishDate } from "@/lib/prices/time";
import {
  postcodeSchema,
  thermalSettingsSchema,
  weatherHour,
  type Weather,
  type ThermalSettings,
} from "@/lib/weather/contracts";
import { summarizeWeather, type HeatingPlan } from "@/lib/weather/planner";
import type { Household } from "@/lib/models";
export function WeatherPanel({
  home,
  weather,
  plan,
  message,
  now,
  onPostcode,
}: {
  home: Household;
  weather: Weather | null;
  plan: HeatingPlan | null;
  message: string;
  now: number | null;
  onPostcode: (postcode: string) => void;
}) {
  const [postcode, setPostcode] = useState(home.postcode ?? "");
  const [error, setError] = useState("");
  const [day, setDay] = useState(0);
  const current = weather && now !== null ? weatherHour(weather, now) : null;
  const date = now === null ? "" : addDate(swedishDate(new Date(now)), day);
  const summary =
    weather && now !== null ? summarizeWeather(weather, date, now) : null;
  return (
    <details className="card weather-widget" open>
      <summary>
        <CloudSun size={20} />
        <strong>Väder & värme</strong>
        <span>
          {current
            ? `${number(current.temperature, 1)} °C ute · prognos`
            : "Lokal väderprognos"}
        </span>
      </summary>
      <form
        className="weather-postcode"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = postcodeSchema.safeParse(postcode);
          if (!parsed.success) {
            setError("Ange fem siffror, exempelvis 132 30.");
            return;
          }
          setError("");
          onPostcode(parsed.data);
        }}
      >
        <label>
          Postnummer
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="Ditt postnummer"
            maxLength={6}
            required
          />
        </label>
        <Button type="submit" className="secondary">
          Visa väder
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {!weather && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
      {weather && (
        <>
          <div className="weather-tabs" role="tablist" aria-label="Prognosdag">
            {["Idag", "Imorgon"].map((label, i) => (
              <button
                key={label}
                role="tab"
                type="button"
                id={`weather-tab-${i}`}
                aria-selected={day === i}
                aria-controls="weather-day"
                onClick={() => setDay(i)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="weather-day"
            aria-labelledby={`weather-tab-${day}`}
          >
            <p>
              <strong>
                {weather.place} · {weather.postcode}
              </strong>
              <span className="muted"> · {date} · svensk tid</span>
            </p>
            {summary ? (
              <div className="weather-values">
                <span>
                  <Thermometer size={17} />
                  {number(summary.low, 1)}–{number(summary.high, 1)} °C
                </span>
                <span>
                  <Wind size={17} />
                  Upp till {number(summary.wind, 1)} m/s
                </span>
              </div>
            ) : (
              <p>Prognos för denna dag saknas. Inga värden fylls i.</p>
            )}
            <WeatherTimeline weather={weather} date={date} />
            {weather.locationPrecision === "district" && (
              <p className="muted" role="status">
                Områdesprognos för {weather.place} ({weather.locationArea}).
                Exakt punkt för {weather.postcode} saknas i postnummerlistan.
              </p>
            )}
            <p className="muted">
              {day === 0
                ? "Temperaturspann för återstående prognostimmar idag."
                : "Temperaturspann för tillgängliga prognostimmar imorgon."}{" "}
              {summary ? `${summary.hours} timvärden.` : ""} Prognostemperatur
              är inte en avläsning från en utomhusgivare.
            </p>
          </div>
          <WeatherHeatingSummary plan={plan} />
          <p className="weather-source">
            Prognos:{" "}
            <a href="https://www.yr.no/" target="_blank" rel="noreferrer">
              Yr / MET Norway
            </a>{" "}
            ·{" "}
            <a href="https://api.met.no/" target="_blank" rel="noreferrer">
              MET:s API
            </a>{" "}
            ·{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0
            </a>
            . Temperaturspann och värmeberäkningar är bearbetningar. Utfärdad{" "}
            {swedishDate(new Date(weather.issuedAt))} kl.{" "}
            {priceTime(weather.issuedAt)}, hämtad kl.{" "}
            {priceTime(weather.fetchedAt)}. Plats:{" "}
            <a
              href={
                weather.locationSource === "GeoNames"
                  ? "https://github.com/zauberware/postal-codes-json-xml-csv"
                  : `https://api.zippopotam.us/se/${weather.postcode}`
              }
              target="_blank"
              rel="noreferrer"
            >
              {weather.locationSource ?? "Zippopotam.us / GeoNames"}
            </a>
            ,{" "}
            {weather.locationPrecision === "district"
              ? "ungefärlig områdespunkt"
              : "ungefärlig postnummerpunkt"}
            .
          </p>
        </>
      )}
      <Link className="text-link" href="/installningar#weather-settings">
        Väderinställningar och värmeunderlag →
      </Link>
    </details>
  );
}
export function WeatherHeatingSummary({ plan }: { plan: HeatingPlan | null }) {
  if (!plan) return null;
  if (!plan.available) return <p className="muted">{plan.reason}</p>;
  const first = plan.steps[0];
  return (
    <details className="weather-heat">
      <summary>
        Väderbaserad värmeplan · {plan.smart ? first.action : "ej aktiverad"}
      </summary>
      <p>
        <strong>{first.action}</strong> · {first.reason}
      </p>
      <p className="muted">
        Framåtblickande styrförslag, inte en uppmätt temperatur eller ett
        skickat styrkommando. Det påverkar inte den separata dagsgrafens
        modellhistorik. Både smart Pool och väderhänsyn måste vara aktiva. Dina
        prisgränser och poolens driftfönster respekteras.
      </p>
      <dl className="weather-estimates">
        <div>
          <dt>Senast avlästa pooltemperatur</dt>
          <dd>
            {number(plan.model.water, 1)} °C{" "}
            <small>avläst {priceTime(plan.model.sampledAt)}</small>
          </dd>
        </div>
        <div>
          <dt>Utan värme i {plan.settings.pauseHours} timmar</dt>
          <dd>
            {plan.coolingTemperature === null
              ? "Prognosunderlag saknas"
              : `${number(plan.coolingTemperature, 1)} °C (${number(plan.model.water - plan.coolingTemperature, 2)} °C temperaturtapp)`}
          </dd>
        </div>
        <div>
          <dt>Poolens planerade el till värme</dt>
          <dd>
            {plan.poolKwh === null
              ? "Inväntar effektmätning"
              : `${number(plan.poolKwh, 1)} kWh`}
          </dd>
        </div>
        <div>
          <dt>Poolens lägsta planerade temperatur</dt>
          <dd>{number(plan.minimum, 1)} °C</dd>
        </div>
      </dl>
      <p className="muted">
        Beräkningshorisont: {number(plan.coveredHours, 1)} av kommande 24
        timmar. Poolens värmebalans lärs automatiskt från riktiga avläsningar;
        uppskattningen är {plan.model.confidence}. Solinstrålning, badande och
        varierande COP ingår inte. Vind visas i prognosen men används inte
        separat i den förenklade värmebalansen. Husets uppvärmningsbehov kräver
        separat mätunderlag och beräknas inte från poolens beteende.
      </p>
      {plan.extrapolated && (
        <p className="muted">
          Prognosen ligger utanför tidigare observerade utetemperaturer.
          Temperaturuppskattningen är mer osäker.
        </p>
      )}
      {plan.comfortRisk && (
        <p className="warning" role="status">
          Risk för temperatur under din komfortgräns. Prisregeln, drifttiden
          eller värmepumpens kapacitet räcker inte för att hålla temperaturen
          enligt modellen.
        </p>
      )}
      <div className="weather-plan-list">
        {plan.steps
          .filter(
            (step, i) => i === 0 || step.action !== plan.steps[i - 1].action,
          )
          .map((step) => (
            <div key={step.time}>
              <span>
                {swedishDate(new Date(step.time))} {priceTime(step.time)}
              </span>
              <strong>{step.action}</strong>
              <span>
                {number(step.temperature, 1)} °C ·{" "}
                {step.heating ? "värme föreslås" : "värme pausad"}
              </span>
            </div>
          ))}
      </div>
    </details>
  );
}
const fields = [
  ["tolerance", "Tillåtet temperaturtapp under mål (°C)", 0.1, 5, 0.1],
  ["preheat", "Tillåten förvärmning över mål (°C)", 0, 3, 0.1],
  ["pauseHours", "Visa temperaturtapp vid paus (timmar)", 1, 12, 1],
] as const;
export function WeatherSettings({
  home,
  onSave,
}: {
  home: Household;
  onSave: (settings: ThermalSettings) => void;
}) {
  const parsed = thermalSettingsSchema.safeParse(home.thermalSettings);
  const existing = parsed.success
    ? parsed.data
    : { enabled: false, tolerance: 0.5, preheat: 0.5, pauseHours: 4 };
  const [enabled, setEnabled] = useState(existing.enabled);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(([key]) => [key, String(existing[key])])),
  );
  const [message, setMessage] = useState("");
  return (
    <section className="card" id="weather-settings">
      <h2>Väder och självlärande poolplanering</h2>
      <p className="muted">
        Du behöver inte fylla i värmeförlust, COP eller andra tekniska värden.
        Med en verifierad anslutning lär sig appen av verklig pooltemperatur,
        utetemperatur och värmepumpens drift. Vanliga viloperioder används;
        värmen stängs inte av extra för att samla data.
      </p>
      <p className="muted">
        Pahlén Calidi VP:s WiFi-box har ingen verifierad anslutning ännu.
        Registrerade boxar levererar därför inga mätningar eller inlärda värden
        här. Cirkulationspump på/av räcker inte: faktisk värmedrift måste kunna
        avläsas.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const result = thermalSettingsSchema.safeParse({
            ...Object.fromEntries(
              fields.map(([key]) => [
                key,
                values[key]?.trim() ? Number(values[key]) : NaN,
              ]),
            ),
            enabled,
          });
          if (!result.success) {
            setMessage("Kontrollera temperaturgränserna och paustiden.");
            return;
          }
          onSave(result.data);
          setMessage("Dina önskemål har sparats.");
        }}
      >
        <label className="weather-enable">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Ta hänsyn till väder i poolens smarta styrförslag
        </label>
        <div className="form-grid">
          {fields.map(([key, label, min, max, step]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                required
                value={values[key]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [key]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <p className="muted">
          Detta är dina komfortönskemål. Planen inväntar minst ett dygns riktig
          historik med både uppvärmning och avsvalning. Väderprognosen är
          verklig, framtida pooltemperatur en uppskattning. Ändrat poolskydd,
          badande och sol kan påverka träffsäkerheten. Husets värmebehov kräver
          egna mätningar.
        </p>
        <Button type="submit">Spara väderinställningar</Button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
