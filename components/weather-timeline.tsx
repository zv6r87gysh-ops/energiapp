import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CircleHelp,
} from "lucide-react";
import type { Weather } from "@/lib/weather/contracts";
import { threeHourlyWeather, weatherSymbol } from "@/lib/weather/timeline";
import { number } from "@/lib/energy";
export function WeatherTimeline({
  weather,
  date,
  label,
  overview = false,
}: {
  weather: Weather;
  date: string;
  label?: string;
  overview?: boolean;
}) {
  const slots = threeHourlyWeather(weather, date);
  return (
    <>
      <div
        className="weather-timeline"
        role="region"
        aria-label={label ?? `Väder var tredje timme ${date}`}
        tabIndex={0}
      >
        <ol>
          {slots.map((slot) => {
            const condition = weatherSymbol(slot.forecast?.symbol);
            const Icon =
              condition.kind === "clear"
                ? condition.night
                  ? Moon
                  : Sun
                : condition.kind === "partly"
                  ? condition.night
                    ? CloudMoon
                    : CloudSun
                  : condition.kind === "cloud"
                    ? Cloud
                    : condition.kind === "rain" || condition.kind === "sleet"
                      ? CloudRain
                      : condition.kind === "snow"
                        ? CloudSnow
                        : condition.kind === "thunder"
                          ? CloudLightning
                          : condition.kind === "fog"
                            ? CloudFog
                            : CircleHelp;
            return (
              <li
                key={slot.timestamp}
                className={!slot.forecast ? "weather-slot-missing" : ""}
              >
                <time dateTime={slot.timestamp}>{slot.time}</time>
                {slot.forecast ? (
                  <Icon
                    className={`forecast-icon forecast-${condition.kind}`}
                    size={31}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="forecast-missing-icon" aria-hidden="true">
                    —
                  </span>
                )}
                <strong>
                  {slot.forecast
                    ? `${number(slot.forecast.temperature, 1)}°`
                    : "—"}
                </strong>
                <span className="forecast-condition">
                  {slot.forecast ? condition.label : "Saknas"}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="weather-timeline-note">
        00–21 i tretimmarssteg · svensk tid · prognos vid respektive klockslag.
        Passerade eller saknade prognostimmar fylls inte i.{" "}
        {overview ? "Hela dygnet visas ovan." : "Svep för att se hela dygnet."}
      </p>
    </>
  );
}
