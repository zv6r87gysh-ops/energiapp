"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { Clock3, Sunrise, Sunset } from "lucide-react";
import {
  houseAtmosphere,
  type HouseAtmosphere,
  type SceneLocation,
} from "@/lib/scene/atmosphere";
import type { Weather } from "@/lib/weather/contracts";
import { sunTimes } from "@/lib/scene/sun-times";
import { priceTime } from "@/lib/prices/time";
import { postcodeSchema } from "@/lib/weather/contracts";
import { WeatherTimeline } from "./weather-timeline";
import { number } from "@/lib/energy";
export function useHouseAtmosphere(
  weather: Weather | null,
  location: SceneLocation | null,
) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setNow(Date.now());
    };
    queueMicrotask(tick);
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now === null ? null : houseAtmosphere(now, weather, location);
}
export function HouseClock({
  scene,
  location,
  weather,
  message,
  postcode,
  onPostcode,
}: {
  scene: HouseAtmosphere | null;
  location: SceneLocation | null;
  weather: Weather | null;
  message: string;
  postcode: string;
  onPostcode: (code: string) => void;
}) {
  const [code, setCode] = useState(postcode);
  const [error, setError] = useState("");
  const date = scene?.date;
  const latitude = location?.latitude,
    longitude = location?.longitude;
  const sun = useMemo(
    () =>
      date && latitude !== undefined && longitude !== undefined
        ? sunTimes(date, { latitude, longitude })
        : null,
    [date, latitude, longitude],
  );
  return (
    <div className="house-scene-info">
      <div className="house-clock">
        <Clock3 size={15} />
        <time
          dateTime={scene ? new Date(scene.now).toISOString() : undefined}
          aria-label="Klocka svensk tid"
        >
          {scene
            ? new Intl.DateTimeFormat("sv-SE", {
                timeZone: "Europe/Stockholm",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23",
              }).format(scene.now)
            : "––:––:––"}
        </time>
        <small>Svensk tid</small>
      </div>
      <div className="house-sun-times" aria-label="Soltider idag">
        <span>
          <Sunrise size={18} /> Soluppgång{" "}
          <b>
            {sun?.sunrise != null
              ? priceTime(new Date(sun.sunrise).toISOString())
              : "—"}
          </b>
        </span>
        <span>
          <Sunset size={18} /> Solnedgång{" "}
          <b>
            {sun?.sunset != null
              ? priceTime(new Date(sun.sunset).toISOString())
              : "—"}
          </b>
        </span>
        {sun && sun.sunrise === null && sun.sunset === null && (
          <small>{sun.polarDay ? "Midnattssol" : "Polarnatt"}</small>
        )}
        {!sun && <small>Ange postnummer för soltider</small>}
      </div>
      <span>
        {scene
          ? `${scene.seasonLabel} · ${scene.phaseLabel} · ${scene.conditionLabel}${scene.temperature === null ? "" : ` · ${number(scene.temperature, 1)} °C`}`
          : "Förbereder bildvisualisering…"}
      </span>
      <div className="house-day-forecast">
        <div className="house-forecast-heading">
          <strong>
            Väder kommande 24 timmar{weather ? ` · ${weather.place}` : ""}
          </strong>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = postcodeSchema.safeParse(code);
              if (!parsed.success) {
                setError("Ange ett svenskt postnummer med fem siffror.");
                return;
              }
              setError("");
              onPostcode(parsed.data);
            }}
          >
            <input
              aria-label="Postnummer för husbildens väder"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="Postnummer"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit" className="button secondary">
              {weather ? "Uppdatera väder" : "Hämta väder"}
            </button>
          </form>
        </div>
        {error && <p role="alert">{error}</p>}
        {weather && scene ? (
          <>
            <WeatherTimeline
              weather={weather}
              date={scene.date}
              label="Väder vid huset kommande 24 timmar"
              now={scene.now}
              overview
            />
            <small>
              Yr / MET Norway · CC BY 4.0 · uppdaterad{" "}
              {priceTime(weather.issuedAt)}
              {weather.locationPrecision === "district"
                ? ` · områdesprognos ${weather.locationArea}`
                : ""}
            </small>
          </>
        ) : (
          <p role="status">{message}</p>
        )}
      </div>
      <small>
        Bildvisualisering · pool i väster · höger fasad i söder · väder enligt
        MET-prognos · dagsljus beräknat för platsen
      </small>
    </div>
  );
}
export function HouseWeatherEffects({
  scene,
}: {
  scene: HouseAtmosphere | null;
}) {
  const id = useId().replace(/:/g, "");
  if (!scene) return null;
  return (
    <div
      className={`house-atmosphere scene-${scene.condition} phase-${scene.phase} season-${scene.season}`}
      data-testid="house-atmosphere"
      data-weather={scene.condition}
      data-phase={scene.phase}
      data-season={scene.season}
      aria-hidden="true"
    >
      {scene.phase === "night" || scene.phase === "twilight" ? (
        <div className="house-night-wash" />
      ) : null}
      {scene.sunny && (
        <div
          className="house-sun-wash"
          style={{
            background: `radial-gradient(ellipse at ${scene.sunX}% ${scene.sunY}%, #fff1bb42, transparent 65%)`,
          }}
        />
      )}
      {["cloud", "partly", "rain", "snow", "sleet", "thunder"].includes(
        scene.condition,
      ) && <div className="house-cloud-wash" />}
      {scene.condition === "fog" && <div className="house-fog-wash" />}
      {scene.precipitation !== "none" && (
        <svg
          className="house-precipitation"
          viewBox="0 0 1000 750"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id={`${id}-rain`}
              width="83"
              height="110"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M18 5l-8 26 M60 57l-8 26"
                fill="none"
                stroke="#d7ecfa"
                strokeOpacity=".65"
                strokeWidth="1.4"
              />
            </pattern>
            <pattern
              id={`${id}-snow`}
              width="117"
              height="100"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="12" cy="17" r="2.5" fill="white" opacity=".85" />
              <circle cx="68" cy="63" r="1.7" fill="white" opacity=".7" />
              <circle cx="103" cy="28" r="3" fill="white" opacity=".8" />
            </pattern>
          </defs>
          {scene.precipitation !== "snow" && (
            <rect
              className="house-rain-field"
              x="-120"
              y="-120"
              width="1300"
              height="1050"
              fill={`url(#${id}-rain)`}
            />
          )}{" "}
          {scene.precipitation !== "rain" && (
            <rect
              className="house-snow-field"
              x="-120"
              y="-120"
              width="1300"
              height="1050"
              fill={`url(#${id}-snow)`}
            />
          )}
        </svg>
      )}
    </div>
  );
}
