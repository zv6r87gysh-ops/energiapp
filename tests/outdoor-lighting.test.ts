import { it, expect, vi, afterEach } from "vitest";
import {
  readOutdoorLighting,
  outdoorLightingSchema,
} from "../lib/lighting/contracts";
import { UnconfiguredPlejdAdapter } from "../lib/lighting/adapter";
afterEach(() => vi.unstubAllGlobals());
it("starts off for existing households and does not infer a connection from saved references", () => {
  expect(readOutdoorLighting({})).toEqual({
    provider: "plejd",
    previewOn: false,
  });
  const value = readOutdoorLighting({
    outdoorLighting: {
      provider: "plejd",
      previewOn: true,
      binding: { bridgeReference: " Brygga ", groupReference: " Ute " },
    },
  });
  expect(value.binding).toEqual({
    bridgeReference: "Brygga",
    groupReference: "Ute",
  });
  expect(value.previewOn).toBe(true);
  expect(value).not.toHaveProperty("connected");
  expect(
    outdoorLightingSchema.safeParse({
      provider: "plejd",
      previewOn: true,
      binding: { bridgeReference: "test" },
    }).success,
  ).toBe(false);
});
it("cannot send hardware commands or report lights on while no Plejd adapter is configured", async () => {
  const network = vi.fn();
  vi.stubGlobal("fetch", network);
  const adapter = new UnconfiguredPlejdAdapter();
  expect(await adapter.read()).toMatchObject({
    connection: "not-configured",
    power: "unknown",
    observedAt: null,
  });
  expect(
    await adapter.setPower({
      householdId: "home",
      groupReference: "outside",
      requestId: "4a9c5f8b-51d0-46c9-9b14-c1dc8dd34f55",
      power: "on",
    }),
  ).toEqual({ ok: false, code: "not-configured" });
  expect(network).not.toHaveBeenCalled();
});
