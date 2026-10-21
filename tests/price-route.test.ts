import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { dayBounds } from "../lib/prices/time";
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  vi.stubEnv("ELECTRICITY_PRICES_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function get(query = "area=SE3&day=today") {
  const { GET } = await import("../app/api/electricity-prices/route");
  return GET(new Request(`http://localhost/api/electricity-prices?${query}`));
}
function rows() {
  const { start, end } = dayBounds("2026-10-21");
  return Array.from({ length: (end - start) / 900000 }, (_, i) => ({
    SEK_per_kWh: 0.42,
    time_start: new Date(start + i * 900000).toISOString(),
    time_end: new Date(start + (i + 1) * 900000).toISOString(),
  }));
}
it("hämtar inte när priskällan uttryckligen stängts av", async () => {
  vi.stubEnv("ELECTRICITY_PRICES_ENABLED", "false");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const r = await get();
  expect(r.status).toBe(503);
  expect((await r.json()).status).toBe("not-configured");
  expect(fetcher).not.toHaveBeenCalled();
});
it("avvisar manipulerat område och datum", async () => {
  expect((await get("area=https://evil.example&day=today")).status).toBe(400);
  expect((await get("area=SE3&day=2020-01-01")).status).toBe(400);
});
it("returnerar validerade spotpriser och återanvänder kort servercache", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(rows()), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const response = await get();
  const payload = await response.json();
  expect(payload.status).toBe("available");
  expect(payload.data.intervals[0].ore).toBe(42);
  expect(payload.data.date).toBe("2026-10-21");
  await get();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("visar opublicerad morgondag separat från tekniska fel", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
  );
  expect((await (await get("area=SE3&day=tomorrow")).json()).status).toBe(
    "unpublished",
  );
  expect((await get()).status).toBe(502);
});
it("ersätter aldrig trasig data med demopriser", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([{ SEK_per_kWh: 100 }]), { status: 200 }),
      ),
  );
  const r = await get();
  expect(r.status).toBe(502);
  expect((await r.json()).data).toBeNull();
});
it("hanterar timeout utan att läcka internt fel", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("sensitive upstream detail")),
  );
  const r = await get();
  expect(r.status).toBe(502);
  expect(await r.text()).not.toContain("sensitive");
});

it("är aktiv utan Vercel-miljövariabler", async () => {
  vi.stubEnv("ELECTRICITY_PRICES_ENABLED", undefined);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(rows()), { status: 200 })),
  );
  expect((await (await get()).json()).status).toBe("available");
});
