import { describe, it, expect } from "vitest";
import {
  energyTotals,
  readLedger,
  recordEnergy,
} from "../lib/simulation/totals";
describe("accumulated modeled consumption", () => {
  it("replaces today's replay without double counting and retains previous days", () => {
    const first = recordEnergy([], Date.parse("2026-10-20T12:00:00Z"), 12);
    const second = recordEnergy(first, Date.parse("2026-10-20T13:00:00Z"), 15);
    const total = energyTotals(second, Date.parse("2026-10-21T10:00:00Z"), 9);
    expect(total.month).toBe(24);
    expect(total.days).toBe(2);
    expect(total.expectedDays).toBe(21);
    expect(total.partialDays).toBe(1);
  });
  it("uses Swedish midnight and resets at the new month", () => {
    const ledger = recordEnergy([], Date.parse("2026-10-31T22:00:00Z"), 20);
    const total = energyTotals(
      ledger,
      Date.parse("2026-10-31T23:00:01Z"),
      0.001,
    );
    expect(total.month).toBe(0.001);
    expect(total.expectedDays).toBe(1);
  });
  it("round trips saved data and safely rejects corrupted storage", () => {
    const ledger = recordEnergy([], Date.parse("2026-10-25T02:30:00Z"), 8);
    expect(readLedger(JSON.stringify(ledger))).toEqual(ledger);
    expect(readLedger("{broken")).toEqual([]);
    expect(readLedger('[{"energy":-10}]')).toEqual([]);
  });
});
