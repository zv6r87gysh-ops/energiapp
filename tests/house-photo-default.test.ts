import { it, expect, vi, afterEach } from "vitest";
import { readBundledHousePhoto } from "../lib/house-photo";
afterEach(() => vi.unstubAllGlobals());
it("can load a project photo on a new preview origin without browser storage", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          householdId: "demo-home",
          url: "/images/house-photo.jpg",
        }),
      ),
  );
  expect(await readBundledHousePhoto("demo-home")).toBe(
    "/images/house-photo.jpg",
  );
  expect(await readBundledHousePhoto("other-home")).toBeNull();
});
it("does not substitute a fabricated photo or load foreign URLs when the asset is absent", async () => {
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  for (const url of [
    null,
    "https://unknown.example/photo.jpg",
    "//unknown.example/photo.jpg",
    "/../photo.jpg",
    "/photo.svg",
  ]) {
    f.mockResolvedValueOnce(Response.json({ householdId: "demo-home", url }));
    expect(await readBundledHousePhoto("demo-home")).toBeNull();
  }
});
