import { describe, it, expect } from "vitest";
import {
  evaluateRule,
  simulateHousehold,
  defaultSimulationSettings,
  familyPower,
  type PriceInterval,
} from "../lib/simulation/engine";
import { initialHousehold } from "../lib/demo";
import {
  applySmartControl,
  changeSmartCategory,
  defaultSmartControl,
} from "../lib/smart-control";
import { dayBounds } from "../lib/prices/time";
function prices(date = "2026-10-21", days = 2): PriceInterval[] {
  const { start } = dayBounds(date);
  return Array.from({ length: 96 * days }, (_, i) => ({
    start: new Date(start + i * 900000).toISOString(),
    end: new Date(start + (i + 1) * 900000).toISOString(),
    ore: i % 96 === 60 ? 200 : 100,
  }));
}
const now = Date.parse("2026-10-21T06:00:00Z"); // 08:00 Stockholm, pool's window.
describe("Prisregel med faktiska kvartintervall", () => {
  it("pausar vid exakt 70 procent av högsta kommande 24-timmarspris", () => {
    const rows = prices();
    const index = 32;
    rows[index].ore = 140;
    const d = evaluateRule({ type: "percent", value: 70 }, rows, now);
    expect(d.highest).toBe(200);
    expect(d.threshold).toBe(140);
    expect(d.status).toBe("price-paused");
    rows[index].ore = 139;
    expect(evaluateRule({ type: "percent", value: 70 }, rows, now).status).toBe(
      "running",
    );
  });
  it("använder framtida 24 timmar och ignorerar dagens passerade pristopp", () => {
    const rows = prices();
    rows[0].ore = 1000;
    expect(
      evaluateRule({ type: "percent", value: 70 }, rows, now).highest,
    ).toBe(200);
  });
  it("gissar inte en full 24-timmarsperiod när morgondagen saknas", () => {
    const d = evaluateRule(
      { type: "percent", value: 70 },
      prices().slice(0, 96),
      now,
    );
    expect(d.status).toBe("waiting-prices");
    expect(d.coverageHours).toBe(16);
  });
  it("en fast gräns fungerar med dagens priser men kräver aktuellt pris", () => {
    expect(
      evaluateRule({ type: "fixed", value: 90 }, prices().slice(0, 96), now)
        .status,
    ).toBe("price-paused");
    expect(evaluateRule({ type: "fixed", value: 90 }, [], now).status).toBe(
      "waiting-prices",
    );
  });
  it("hittar luckor och respekterar exakt 24 förflutna timmar vid DST", () => {
    const { start } = dayBounds("2026-10-25");
    const rows = Array.from({ length: 196 }, (_, i) => ({
      start: new Date(start + i * 900000).toISOString(),
      end: new Date(start + (i + 1) * 900000).toISOString(),
      ore: 100,
    }));
    expect(
      evaluateRule({ type: "percent", value: 70 }, rows, start + 3600000)
        .coverageHours,
    ).toBe(24);
    expect(
      evaluateRule(
        { type: "percent", value: 70 },
        rows.filter((_, i) => i !== 8),
        start + 3600000,
      ).status,
    ).toBe("waiting-prices");
  });
  it("undviker onödig positiv prispaus när alla framtida priser är negativa", () => {
    const d = evaluateRule(
      { type: "percent", value: 70 },
      prices().map((p) => ({ ...p, ore: -20 })),
      now,
    );
    expect(d.status).toBe("running");
    expect(d.threshold).toBeNull();
  });
});
describe("Levande modell för två vuxna och två barn", () => {
  it("är deterministisk men förändras med klockan", () => {
    expect(familyPower(now, 2, 2)).toBe(familyPower(now, 2, 2));
    expect(familyPower(now + 5000, 2, 2)).not.toBe(familyPower(now, 2, 2));
    expect(defaultSimulationSettings.adults).toBe(2);
    expect(defaultSimulationSettings.children).toBe(2);
  });
  it("smart pool med fast prisgräns påverkar effekt och energi direkt", () => {
    const home = {
      ...structuredClone(initialHousehold),
      simulationSettings: {
        ...defaultSimulationSettings,
        poolKwh: 40,
        poolRule: { type: "fixed" as const, value: 90 },
      },
    };
    const normal = simulateHousehold(home, prices(), now);
    const smart = applySmartControl(
      home,
      changeSmartCategory(defaultSmartControl(), "pool", true),
    );
    const optimized = simulateHousehold(smart, prices(), now);
    expect(normal.devices.pool.power).toBe(2);
    expect(optimized.devices.pool.power).toBe(0);
    expect(optimized.devices.pool.decision.status).toBe("price-paused");
    expect(optimized.energy).toBeLessThan(normal.energy);
    expect(optimized.devices.pool.remaining).toBe(40);
    expect(optimized.matchedDifference).toBe(0);
  });
  it("utebliven leverans räknas inte som besparing", () => {
    const smart = applySmartControl(
      {
        ...initialHousehold,
        simulationSettings: {
          ...defaultSimulationSettings,
          poolRule: { type: "fixed", value: 0 },
        },
      },
      changeSmartCategory(defaultSmartControl(), "pool", true),
    );
    const result = simulateHousehold(smart, prices(), now);
    expect(result.devices.pool.energy).toBe(0);
    expect(result.devices.pool.remaining).toBeGreaterThan(0);
    expect(result.matchedDifference).toBe(0);
  });
  it("saknade verkliga priser ger okänd kostnad, ingen demo-fallback", () => {
    const r = simulateHousehold(initialHousehold, [], now);
    expect(r.cost).toBeNull();
    expect(r.matchedDifference).toBeNull();
    expect(r.priceAvailable).toBe(false);
    expect(r.power).toBeGreaterThan(0);
  });
  it("beräknar skatt och moms en gång och har samma grundlast i jämförelsen", () => {
    const home = {
      ...initialHousehold,
      simulationSettings: {
        ...defaultSimulationSettings,
        poolKwh: 0,
        chargingKwh: 0,
      },
    };
    const rows = prices().map((p) => ({ ...p, ore: 100 }));
    const r = simulateHousehold(home, rows, now);
    const perKwh =
      ((100 +
        home.contract.markup +
        home.tariff.variable +
        home.tariff.tax +
        home.tariff.timeBased) /
        100) *
      (1 + home.contract.vat / 100);
    expect(r.cost).toBeCloseTo(r.energy * perKwh);
    expect(r.matchedDifference).toBeCloseTo(0);
  });
  it("begränsar flexibla laster efter säkring och behåller hushållets grundlast", () => {
    const r = simulateHousehold(
      {
        ...initialHousehold,
        fuse: 4,
        simulationSettings: {
          ...defaultSimulationSettings,
          poolKwh: 40,
          chargingKwh: 80,
        },
        charging: true,
      },
      prices(),
      now,
    );
    expect(r.devices.pool.power + r.devices.charging.power).toBeLessThanOrEqual(
      Math.max(0, (4 * 230 * 3) / 1000 - r.housePower) + 0.001,
    );
  });
});

it("modellens energiräknare går framåt även när momentan effekt sjunker", () => {
  const home = {
    ...initialHousehold,
    simulationSettings: {
      ...defaultSimulationSettings,
      poolKwh: 0,
      chargingKwh: 0,
    },
  };
  let previous = 0;
  for (let i = 0; i < 30; i++) {
    const r = simulateHousehold(home, prices(), now + i * 5000);
    expect(r.energy).toBeGreaterThanOrEqual(previous);
    previous = r.energy;
  }
});

describe("Hypotetisk besparing mot ständig drift", () => {
  it("jämför full effekt från svensk midnatt med kategoriens modellkostnad", () => {
    const home = structuredClone(initialHousehold);
    const rows = prices().map((p) => ({ ...p, ore: 100 }));
    const s = simulateHousehold(home, rows, Date.parse("2026-10-21T12:00:00Z"));
    // 14 Swedish hours × 2 kW, minus 8 kWh delivered by the pool model.
    expect(s.continuousComparison.pool).toBeCloseTo(
      (20 * (100 + 6 + 28 + 43.9) * 1.25) / 100,
      5,
    );
    // Charger reference: 14 h × 6 kW, minus the modeled 14 kWh daily requirement.
    expect(s.continuousComparison.charging).toBeCloseTo(
      (70 * (100 + 6 + 28 + 43.9) * 1.25) / 100,
      5,
    );
    expect(s.continuousComparison.house).toBe(0);
    expect(s.continuousComparison.floor).toBeNull();
  });
  it("visar inget belopp vid prisluckor eller saknad bil och behåller negativa skillnader", () => {
    const home = structuredClone(initialHousehold);
    const instant = Date.parse("2026-10-21T12:00:00Z");
    expect(
      simulateHousehold(
        home,
        prices().filter((_, i) => i !== 2),
        instant,
      ).continuousComparison.pool,
    ).toBeNull();
    home.vehicles = [];
    expect(
      simulateHousehold(home, prices(), instant).continuousComparison.charging,
    ).toBeNull();
    expect(
      simulateHousehold(
        home,
        prices().map((p) => ({ ...p, ore: -300 })),
        instant,
      ).continuousComparison.pool,
    ).toBeLessThan(0);
  });
});
