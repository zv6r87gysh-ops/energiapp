import type { Weather } from "./contracts";
import { dayBounds, priceTime } from "../prices/time";
export function weatherSymbol(symbol?: string) {
  if (!symbol)
    return {
      kind: "unknown",
      label: "Vädersymbol saknas",
      night: false,
    } as const;
  const night = symbol.endsWith("_night");
  const code = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (code.includes("thunder"))
    return { kind: "thunder", label: "Åska", night } as const;
  if (code.includes("sleet"))
    return { kind: "sleet", label: "Snöblandat regn", night } as const;
  if (code.includes("snow"))
    return { kind: "snow", label: "Snö", night } as const;
  if (code.includes("rain"))
    return {
      kind: "rain",
      label: code.includes("heavy")
        ? "Kraftigt regn"
        : code.includes("light")
          ? "Lätt regn"
          : "Regn",
      night,
    } as const;
  if (code === "fog") return { kind: "fog", label: "Dimma", night } as const;
  if (code === "cloudy")
    return { kind: "cloud", label: "Mulet", night } as const;
  if (code === "partlycloudy" || code === "fair")
    return {
      kind: "partly",
      label: code === "fair" ? "Lätt molnighet" : "Växlande molnighet",
      night,
    } as const;
  if (code === "clearsky")
    return { kind: "clear", label: night ? "Klart" : "Soligt", night } as const;
  return { kind: "unknown", label: "Okänd vädersymbol", night } as const;
}
export function threeHourlyWeather(weather: Weather, date: string) {
  const { start, end } = dayBounds(date);
  const slots = [];
  // Walk real hours, then select local 00, 03 … 21. This also handles Swedish DST days.
  for (let t = start; t < end; t += 3600000) {
    const time = priceTime(new Date(t).toISOString());
    if (Number(time.slice(0, 2)) % 3 !== 0) continue;
    const forecast =
      weather.hours.find((h) => Date.parse(h.time) === t) ?? null;
    slots.push({ time, timestamp: new Date(t).toISOString(), forecast });
  }
  return slots;
}
