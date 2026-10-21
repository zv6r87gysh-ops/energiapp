import { describe, it, expect } from "vitest";
import {
  deviceDetailsSchema,
  registerDevice,
  pendingDeviceStatus,
} from "../lib/devices";
const details = {
  kind: "pool-wifi",
  name: "Poolens WiFi-box",
  manufacturer: "Pahlén",
  model: "Min modul",
  identifier: "BOX-12345",
};
describe("Registrering av egna enheter", () => {
  it("kräver modell och identifierare och rensar yttre blanksteg", () => {
    expect(
      deviceDetailsSchema.safeParse({ ...details, model: "" }).success,
    ).toBe(false);
    expect(
      deviceDetailsSchema.safeParse({ ...details, identifier: "12" }).success,
    ).toBe(false);
    expect(
      deviceDetailsSchema.parse({ ...details, name: " Poolen " }).name,
    ).toBe("Poolen");
  });
  it("avvisar webbadresser och orimligt långa ID-fält", () => {
    expect(
      deviceDetailsSchema.safeParse({
        ...details,
        identifier: "https://example.com?q=secret",
      }).success,
    ).toBe(false);
    expect(
      deviceDetailsSchema.safeParse({ ...details, identifier: "a".repeat(81) })
        .success,
    ).toBe(false);
  });
  it("registrerar endast en förberedd, frånkopplad enhet", () => {
    const d = registerDevice(details, "house-a", []);
    expect(d.source).toBe("registered");
    expect(d.status).toBe(pendingDeviceStatus);
    expect(d.householdId).toBe("house-a");
    expect(d.identifier).toBe(details.identifier);
    expect(d.id).toMatch(/^[a-f0-9-]{36}$/);
  });
  it("förhindrar dubbletter även vid skillnad i skiftläge och blanksteg", () => {
    const d = registerDevice(details, "house-a", []);
    expect(() =>
      registerDevice(
        { ...details, manufacturer: "PAHLÉN", identifier: "box-12345 " },
        "house-a",
        [d],
      ),
    ).toThrow("finns redan");
  });
  it("håller hushållens identiteter åtskilda", () => {
    const d = registerDevice(details, "house-a", []);
    expect(registerDevice(details, "house-b", [d]).householdId).toBe("house-b");
    expect(() => registerDevice(details, "house-b", [d], d.id)).toThrow(
      "inte i det här hushållet",
    );
  });
  it("redigerar metadata utan att ändra identitet, registreringstid eller anslutningsstatus", () => {
    const d = registerDevice(details, "house-a", []);
    const edited = registerDevice(
      { ...details, name: "Nytt namn" },
      "house-a",
      [d],
      d.id,
    );
    expect(edited.id).toBe(d.id);
    expect(edited.createdAt).toBe(d.createdAt);
    expect(edited.name).toBe("Nytt namn");
    expect(edited.status).toBe(pendingDeviceStatus);
    expect(d.name).toBe(details.name);
  });
});
