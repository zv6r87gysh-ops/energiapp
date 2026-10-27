import { it, expect, vi, afterEach } from "vitest";
import { readBundledHousePhoto } from "../lib/house-photo";
afterEach(() => vi.unstubAllGlobals());
it("can load a project photo on a new preview origin without browser storage", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
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
it("maps the wider original photo and the earlier crop to the same real features", async () => {
  const { housePhotoLayout, photoPoint } =
    await import("../lib/house-photo-layout");
  const original = housePhotoLayout(1448, 1086);
  const roof = photoPoint([247 / 15.96, 354 / 14.22], original);
  expect(roof[0] * 14.48).toBeCloseTo(375.111, 2);
  expect(roof[1] * 10.86).toBeCloseTo(273.402, 2);
  expect(photoPoint([50, 50], housePhotoLayout(1596, 1422))).toEqual([50, 50]);
});
