import { forecastFresh, weatherHour, type Weather } from "../weather/contracts";
import { weatherSymbol } from "../weather/timeline";
import { swedishDate } from "../prices/time";
export type SceneLocation = { latitude: number; longitude: number };
// Astronomical solar altitude in degrees (J2000 solar coordinates, SunCalc equations).
// Calculated daylight, not a weather observation; handles polar night and Swedish DST without fixed schedules.
export function solarPosition(now: number, location: SceneLocation) {
  const rad = Math.PI / 180,
    d = now / 86400000 - 10957.5;
  const mean = rad * (357.5291 + 0.98560028 * d);
  const center =
    rad *
    (1.9148 * Math.sin(mean) +
      0.02 * Math.sin(2 * mean) +
      0.0003 * Math.sin(3 * mean));
  const longitude = mean + center + rad * 102.9372 + Math.PI;
  const obliquity = rad * 23.4397;
  const declination = Math.asin(Math.sin(longitude) * Math.sin(obliquity));
  const rightAscension = Math.atan2(
    Math.sin(longitude) * Math.cos(obliquity),
    Math.cos(longitude),
  );
  const hourAngle =
    rad * (280.16 + 360.9856235 * d + location.longitude) - rightAscension;
  const lat = location.latitude * rad;
  const altitude =
    Math.asin(
      Math.sin(lat) * Math.sin(declination) +
        Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
    ) / rad;
  const azimuth =
    (Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(lat) -
        Math.tan(declination) * Math.cos(lat),
    ) /
      rad +
      180 +
      360) %
    360;
  return { altitude, azimuth };
}
export function solarAltitude(now: number, location: SceneLocation) {
  return solarPosition(now, location).altitude;
}
export function houseAtmosphere(
  now: number,
  weather: Weather | null,
  location: SceneLocation | null,
) {
  const date = swedishDate(new Date(now));
  const month = Number(date.slice(5, 7));
  const season =
    month <= 2 || month === 12
      ? "winter"
      : month <= 5
        ? "spring"
        : month <= 8
          ? "summer"
          : "autumn";
  const seasonLabel = {
    winter: "Vinter",
    spring: "Vår",
    summer: "Sommar",
    autumn: "Höst",
  }[season];
  const fresh = weather && forecastFresh(weather, now) ? weather : null;
  const hour = fresh ? weatherHour(fresh, now) : null;
  const condition = weatherSymbol(hour?.symbol);
  const coordinates =
    location ??
    (fresh ? { latitude: fresh.latitude, longitude: fresh.longitude } : null);
  const sun = coordinates ? solarPosition(now, coordinates) : null;
  const altitude = sun?.altitude ?? null;
  // Reference photo: the pool faces due west. West projects toward the lower-left foreground.
  const bearing = ((sun?.azimuth ?? 0) * Math.PI) / 180;
  const sunX = Math.max(
    0,
    Math.min(
      100,
      50 + 65 * (-0.89 * Math.cos(bearing) + 0.45 * Math.sin(bearing)),
    ),
  );
  const sunY = Math.max(
    0,
    Math.min(
      100,
      50 + 65 * (-0.45 * Math.cos(bearing) - 0.89 * Math.sin(bearing)),
    ),
  );
  const phase =
    altitude === null
      ? "unknown"
      : altitude < -6
        ? "night"
        : altitude < 0
          ? "twilight"
          : altitude < 8
            ? "low-sun"
            : "day";
  const phaseLabel = {
    unknown: "Plats saknas för dagsljus",
    night: "Natt",
    twilight: "Skymningsljus",
    "low-sun": "Låg sol",
    day: "Dagsljus",
  }[phase];
  const daylight =
    altitude === null
      ? 1
      : altitude < -6
        ? 0.16
        : altitude < 0
          ? 0.16 + (0.24 * (altitude + 6)) / 6
          : 0.4 + 0.58 * Math.pow(Math.min(1, altitude / 15), 0.6);
  const cloud = ["cloud", "rain", "sleet", "snow", "thunder", "fog"].includes(
    condition.kind,
  );
  const brightness =
    daylight * (cloud ? 0.82 : condition.kind === "partly" ? 0.93 : 1);
  const sunny =
    hour !== null &&
    altitude !== null &&
    altitude > 0 &&
    ["clear", "partly"].includes(condition.kind);
  return {
    now,
    date,
    season,
    seasonLabel,
    phase,
    phaseLabel,
    altitude,
    sunAzimuth: sun?.azimuth ?? null,
    sunX,
    sunY,
    brightness,
    sunny,
    condition: condition.kind,
    conditionLabel: hour ? condition.label : "Väderprognos saknas",
    temperature: hour?.temperature ?? null,
    wind: hour?.wind ?? null,
    hasWeather: !!hour,
    precipitation:
      condition.kind === "snow"
        ? "snow"
        : condition.kind === "sleet"
          ? "sleet"
          : condition.kind === "rain" || condition.kind === "thunder"
            ? "rain"
            : "none",
  };
}
export type HouseAtmosphere = ReturnType<typeof houseAtmosphere>;
