import { it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  locationFixture,
  metFixture,
  weatherNow as now,
} from "./fixtures/weather";
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function get(code = "13230") {
  const { GET } = await import("../app/api/weather/route");
  return GET(
    new Request(
      `http://localhost/api/weather?postcode=${encodeURIComponent(code)}`,
    ),
  );
}
function provider() {
  return vi
    .fn()
    .mockResolvedValueOnce(Response.json(locationFixture))
    .mockResolvedValueOnce(
      Response.json(metFixture(), {
        headers: {
          Expires: new Date(now + 1800000).toUTCString(),
          "Last-Modified": new Date(now - 1800000).toUTCString(),
        },
      }),
    );
}
it("rejects invalid postcodes without making upstream requests", async () => {
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  expect((await get("https://evil.example/")).status).toBe(400);
  expect((await get("00000")).status).toBe(400);
  expect(f).not.toHaveBeenCalled();
});
it("returns real-source parsed data, identifies the app and reuses the upstream cache", async () => {
  const f = provider();
  vi.stubGlobal("fetch", f);
  const r = await get("132 30");
  expect(r.status).toBe(200);
  const data = await r.json();
  expect(data.data.source).toBe("MET Norway");
  expect(data.data.place).toBe("Saltsjö-Boo");
  expect(f.mock.calls[1][1].headers["User-Agent"]).toContain(
    "github.com/zv6r87gysh-ops/energiapp",
  );
  await get();
  expect(f).toHaveBeenCalledTimes(2);
});
it("coalesces simultaneous requests and conditionally refreshes only after Expires", async () => {
  const f = provider();
  vi.stubGlobal("fetch", f);
  await Promise.all([get(), get()]);
  expect(f).toHaveBeenCalledTimes(2);
  vi.setSystemTime(now + 1800001);
  f.mockResolvedValueOnce(
    new Response(null, {
      status: 304,
      headers: { Expires: new Date(now + 3600000).toUTCString() },
    }),
  );
  expect((await get()).status).toBe(200);
  expect(f).toHaveBeenCalledTimes(3);
  expect(f.mock.calls[2][1].headers["If-Modified-Since"]).toBe(
    new Date(now - 1800000).toUTCString(),
  );
});
it("returns an unavailable state for missing, corrupt or blocked providers and backs off", async () => {
  const f = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", f);
  const r = await get();
  expect(r.status).toBe(502);
  expect((await r.json()).data).toBeNull();
  await get();
  expect(f).toHaveBeenCalledTimes(1);
});
it("rejects wrong weather units and never serves fabricated forecast", async () => {
  const bad = metFixture();
  bad.properties.meta.units.air_temperature = "fahrenheit";
  const f = vi
    .fn()
    .mockResolvedValueOnce(Response.json(locationFixture))
    .mockResolvedValueOnce(Response.json(bad));
  vi.stubGlobal("fetch", f);
  expect((await (await get()).json()).status).toBe("unavailable");
});
