import { describe, it, expect } from "vitest";
import {
  applySmartControl,
  categoryActive,
  changeSmartCategory,
  defaultSmartControl,
  readSmartControl,
  smartControlSchema,
} from "../lib/smart-control";
import { initialHousehold } from "../lib/demo";
describe("Smart styrning per demohushåll", () => {
  it("startar avstängd även för äldre sparade hushåll", () => {
    const legacy = {
      ...initialHousehold,
      smart: true,
      smartControl: undefined,
    };
    expect(defaultSmartControl().enabled).toBe(false);
    expect(readSmartControl(legacy)).toEqual(defaultSmartControl());
  });
  it("kräver ett val och tillåter aldrig ansluten styrning eller golvvärme", () => {
    const base = { mode: "demo", enabled: true, updatedAt: null };
    expect(
      smartControlSchema.safeParse({ ...base, categories: [] }).success,
    ).toBe(false);
    expect(
      smartControlSchema.safeParse({ ...base, categories: ["heating"] })
        .success,
    ).toBe(false);
    expect(
      smartControlSchema.safeParse({ ...base, categories: ["pool", "pool"] })
        .success,
    ).toBe(false);
    expect(
      smartControlSchema.safeParse({
        ...base,
        mode: "connected",
        categories: ["pool"],
      }).success,
    ).toBe(false);
  });
  it("ändrar bara valda simulerade kategorier och bevarar manuella värden", () => {
    const home = {
      ...structuredClone(initialHousehold),
      charging: true,
      pool: { ...initialHousehold.pool, target: 29, mode: "Komfort" },
    };
    const next = applySmartControl(
      home,
      changeSmartCategory(defaultSmartControl(), "charging", true),
    );
    expect(next.smart).toBe(true);
    expect(next.pool).toEqual(home.pool);
    expect(next.charging).toBe(true);
    expect(home.smartControl?.enabled).toBe(false);
  });
  it("pausar utan att glömma valen och kan återuppta", () => {
    const active = changeSmartCategory(
      changeSmartCategory(defaultSmartControl(), "pool", true),
      "charging",
      true,
    );
    const home = applySmartControl(initialHousehold, active);
    const paused = applySmartControl(home, { ...active, enabled: false });
    expect(paused.smart).toBe(false);
    expect(paused.pool.mode).toBe("Manuellt");
    expect(paused.smartControl?.categories).toEqual(["pool", "charging"]);
    const resumed = applySmartControl(paused, { ...active, enabled: true });
    expect(resumed.pool.mode).toBe("Smart");
    expect(resumed.smart).toBe(true);
  });
  it("laddningens knapp bevarar poolens val", () => {
    const control = changeSmartCategory(
      changeSmartCategory(defaultSmartControl(), "pool", true),
      "charging",
      true,
    );
    const next = changeSmartCategory(control, "charging", false);
    expect(categoryActive(next, "pool")).toBe(true);
    expect(categoryActive(next, "charging")).toBe(false);
  });
  it("stänger av huvudläget när sista kategorin tas bort", () => {
    const control = changeSmartCategory(defaultSmartControl(), "pool", true);
    expect(changeSmartCategory(control, "pool", false).enabled).toBe(false);
  });
  it("avvisar manipulerade sparade inställningar", () =>
    expect(
      readSmartControl({
        smartControl: {
          mode: "connected",
          enabled: true,
          categories: ["heating"],
        },
      }),
    ).toEqual(defaultSmartControl()));
  it("läcker inga val mellan hushåll", () => {
    const one = structuredClone(initialHousehold),
      two = { ...structuredClone(initialHousehold), id: "other" };
    const changed = applySmartControl(
      one,
      changeSmartCategory(defaultSmartControl(), "pool", true),
    );
    expect(readSmartControl(changed).enabled).toBe(true);
    expect(readSmartControl(two).enabled).toBe(false);
  });
});
