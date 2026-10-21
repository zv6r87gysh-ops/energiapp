import { demoMetrics } from "../lib/demo-metrics";
import { describe, it, expect } from "vitest";
import {
  cost,
  forecast,
  planCharging,
  quarterSlots,
  savings,
  stockholm,
} from "../lib/energy";
import { initialHousehold, demoSeries } from "../lib/demo";
import { hardwareCommand } from "../lib/adapters";
import { vehicleSchema } from "../lib/models";
describe("Elkostnad", () => {
  it("lägger till skatt och moms exakt en gång", () => {
    expect(
      cost(
        100,
        100,
        { markup: 10, monthly: 20, vat: 25, discount: 5 },
        { variable: 20, tax: 40, monthly: 30, demand: 10, timeBased: 5 },
      ),
    ).toEqual({ energy: 218.75, fixed: 68.75, total: 287.5 });
  });
  it("kan utesluta fasta avgifter för laddsessioner", () =>
    expect(
      cost(
        10,
        0,
        { markup: 0, monthly: 50, vat: 25, discount: 0 },
        { variable: 0, tax: 40, monthly: 100, demand: 0, timeBased: 0 },
        false,
      ).total,
    ).toBe(5));
  it("prognos och osäkerhet", () =>
    expect(forecast(210, 21, 31)).toEqual({
      total: 310,
      low: 263.5,
      high: 356.5,
      remaining: 100,
    }));
  it("bevarar negativ besparing", () =>
    expect(savings(100, 120).amount).toBe(-20));
});
describe("Kvartar och svensk tid", () => {
  it("sommartidsdygnet har 92 kvartar", () =>
    expect(
      quarterSlots("2026-03-28T23:00:00Z", "2026-03-29T22:00:00Z"),
    ).toHaveLength(92));
  it("vintertidsdygnet har 100 kvartar", () =>
    expect(
      quarterSlots("2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z"),
    ).toHaveLength(100));
  it("konverterar UTC till svensk sommartid", () =>
    expect(stockholm("2026-07-01T12:00:00Z")).toBe("14:00"));
  it("konverterar vintertid", () =>
    expect(stockholm("2026-12-01T12:00:00Z")).toBe("13:00"));
});
describe("Laddplan", () => {
  it("väljer billiga kvartar och behåller samma energi", () => {
    const p = planCharging(
      [
        { timestamp: "2026-10-21T01:00:00Z", ore: 200 },
        { timestamp: "2026-10-21T02:00:00Z", ore: 20 },
      ],
      10,
      0,
      10,
      4,
      0,
    );
    expect(p.needed).toBe(1);
    expect(p.selected[0].ore).toBe(20);
    expect(p.spotCost).toBe(0.2);
    expect(p.missing).toBe(0);
  });
  it("rapporterar otillräcklig laddtid", () =>
    expect(planCharging([], 60, 20, 80, 11, 10).missing).toBeGreaterThan(0));
  it("begränsar maxpris", () =>
    expect(
      planCharging(demoSeries(), 60, 20, 80, 11, 10, 0).selected,
    ).toHaveLength(0));
});
describe("Säkra demolägen", () => {
  it("förbjuder hårdvarukommandon", () =>
    expect(() => hardwareCommand()).toThrow());
  it("validerar manuella fordonsdata", () => {
    expect(vehicleSchema.safeParse(initialHousehold.vehicles[0]).success).toBe(
      true,
    );
    expect(
      vehicleSchema.safeParse({ ...initialHousehold.vehicles[0], battery: -1 })
        .success,
    ).toBe(false);
  });
});

describe("Samstämmiga demoaggregat", () => {
  it("summerar samma månadskostnad och energi som diagrammen", () => {
    const m = demoMetrics(initialHousehold);
    expect(m.rows.reduce((s, r) => s + r.energy, 0)).toBe(m.monthEnergy);
    expect(m.rows.reduce((s, r) => s + r.cost, 0)).toBe(m.spent);
    expect(m.savingsRows.reduce((s, r) => s + r.saving, 0)).toBeCloseTo(
      m.saving.amount,
    );
  });
  it("gemensamma avgifter påverkar båda jämförelsescenarier lika", () => {
    const a = demoMetrics(initialHousehold);
    const b = demoMetrics({
      ...initialHousehold,
      tariff: { ...initialHousehold.tariff, tax: 80 },
    });
    expect(a.saving.amount).toBeCloseTo(b.saving.amount);
    expect(b.baseline).toBeGreaterThan(a.baseline);
  });
});
