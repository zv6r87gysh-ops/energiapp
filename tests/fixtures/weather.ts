import type { PoolTelemetry } from "../../lib/pool/learning";
import type { Weather, ThermalSettings } from "../../lib/weather/contracts";
import { initialHousehold } from "../../lib/demo";
import {
  defaultSimulationSettings,
  type PriceInterval,
} from "../../lib/simulation/engine";
import type { Household } from "../../lib/models";
export const weatherNow = Date.parse("2026-10-21T10:00:00Z");
export function weatherFixture(temperature = 10, now = weatherNow): Weather {
  return {
    postcode: "13230",
    place: "Saltsjö-Boo",
    latitude: 59.3173,
    longitude: 18.255,
    source: "MET Norway",
    issuedAt: new Date(now - 1800000).toISOString(),
    fetchedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 1800000).toISOString(),
    hours: Array.from({ length: 48 }, (_, i) => ({
      time: new Date(
        Math.floor(now / 3600000) * 3600000 + i * 3600000,
      ).toISOString(),
      temperature,
      wind: 3,
      symbol: "cloudy",
    })),
  };
}
export function metFixture(now = weatherNow) {
  return {
    properties: {
      meta: {
        updated_at: new Date(now - 1800000).toISOString(),
        units: { air_temperature: "celsius", wind_speed: "m/s" },
      },
      timeseries: weatherFixture(10, now).hours.map((h) => ({
        time: h.time,
        data: {
          instant: {
            details: { air_temperature: h.temperature, wind_speed: h.wind },
          },
          next_1_hours: { summary: { symbol_code: h.symbol } },
        },
      })),
    },
  };
}
export const locationFixture = {
  "country abbreviation": "SE",
  "post code": "13230",
  places: [
    { "place name": "Saltsjö-Boo", latitude: "59.3173", longitude: "18.2550" },
  ],
};
export const thermalFixture: ThermalSettings = {
  enabled: true,
  tolerance: 0.5,
  preheat: 0.5,
  pauseHours: 4,
};
export function thermalHome(): Household {
  return {
    ...structuredClone(initialHousehold),
    postcode: "13230",
    thermalSettings: structuredClone(thermalFixture),
    smartControl: {
      mode: "demo",
      enabled: true,
      categories: ["pool"],
      updatedAt: new Date(weatherNow).toISOString(),
    },
    simulationSettings: {
      ...defaultSimulationSettings,
      poolRule: { type: "fixed", value: 100 },
    },
  };
}
export function thermalPrices(ore = 50): PriceInterval[] {
  return Array.from({ length: 192 }, (_, i) => ({
    start: new Date(weatherNow + i * 900000).toISOString(),
    end: new Date(weatherNow + (i + 1) * 900000).toISOString(),
    ore,
  }));
}

// Synthetic fixtures are restricted to tests; the application never creates telemetry.
export function telemetryFixture(): PoolTelemetry {
  const k = 0.01,
    gain = 0.7;
  let water = 28;
  let since = weatherNow - 49 * 3600000;
  const readings = [];
  for (let i = 0; i <= 96; i++) {
    const at = weatherNow - 48 * 3600000 + i * 0.5 * 3600000;
    const heating = i % 16 >= 8;
    if (i > 0 && heating !== (i - 1) % 16 >= 8) since = at;
    readings.push({
      at: new Date(at).toISOString(),
      water,
      outdoor: 10,
      heating,
      heatingStateSince: new Date(since).toISOString(),
      cover: "closed" as const,
      electricalKw: heating ? 2 : 0,
    });
    const equilibrium = 10 + (heating ? gain / k : 0);
    water = equilibrium + (water - equilibrium) * Math.exp(-k * 0.5);
  }
  return {
    householdId: "demo-home",
    deviceId: "test-pool-box",
    verified: true as const,
    readings,
  };
}
