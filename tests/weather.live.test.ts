import { it, expect } from "vitest";
import { parseLocation, parseForecast } from "../lib/weather/provider";
it.skipIf(process.env.RUN_LIVE_WEATHER_TESTS !== "1")(
  "verifies real Swedish postcode and live MET Norway forecast",
  async () => {
    const geo = await fetch("https://api.zippopotam.us/se/13230", {
      signal: AbortSignal.timeout(15000),
    });
    expect(geo.ok).toBe(true);
    const location = parseLocation(await geo.json(), "13230");
    const r = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${location.latitude}&lon=${location.longitude}`,
      {
        headers: {
          "User-Agent":
            "Energihem/1.0 https://github.com/zv6r87gysh-ops/energiapp",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    expect(r.ok).toBe(true);
    const data = parseForecast(
      await r.json(),
      location,
      Date.parse(
        r.headers.get("Expires") ??
          new Date(Date.now() + 1800000).toISOString(),
      ),
      Date.now(),
    );
    expect(data.source).toBe("MET Norway");
    expect(data.hours.length).toBeGreaterThan(24);
    expect(data.place).toBe("Saltsjö-Boo");
  },
  35000,
);
