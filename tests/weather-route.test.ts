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
  const r = await get("99999");
  expect(r.status).toBe(502);
  expect((await r.json()).data).toBeNull();
  await get("99999");
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
it("serves a labelled real-district forecast for 13250 when the exact postcode is absent", async () => {
  const f = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(Response.json(metFixture()));
  vi.stubGlobal("fetch", f);
  const r = await get("13250");
  expect(r.status).toBe(200);
  const body = await r.json();
  expect(body.data.postcode).toBe("13250");
  expect(body.data.place).toBe("Saltsjö-Boo");
  expect(body.data.locationPrecision).toBe("district");
  expect(body.data.locationArea).toBe("132xx");
  expect(body.data.locationSource).toBe("GeoNames");
  expect(f.mock.calls[1][0]).toContain("lat=59.3173&lon=18.255");
});
it("reports weather-service failure separately from missing postcode", async () => {
  const f = vi
    .fn()
    .mockResolvedValueOnce(Response.json(locationFixture))
    .mockResolvedValueOnce(new Response(null, { status: 403 }));
  vi.stubGlobal("fetch", f);
  expect((await (await get()).json()).code).toBe("forecast-unavailable");
});
it("does not guess an area for an unknown district", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
  );
  const r = await get("99999");
  expect((await r.json()).code).toBe("postcode-not-found");
  expect(r.headers.get("Retry-After")).toBe("60");
});
