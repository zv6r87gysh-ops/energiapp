import { z } from "zod";
import type { Device } from "./models";
export const deviceKindSchema = z.enum([
  "pool-wifi",
  "energy-meter",
  "charger",
  "other",
]);
export type DeviceKind = z.infer<typeof deviceKindSchema>;
export const deviceKinds = [
  {
    id: "pool-wifi",
    name: "WiFi-box till poolen",
    shortName: "Poolens WiFi-box",
    description: "Registrera modulen till poolvärmepumpen.",
    help: "Ange numret från WiFi-boxens etikett eller tillverkarens app. Värmepumpens nummer är inte alltid samma som WiFi-boxens.",
    next: "Tillverkarens app kan behövas för installation. Vi behöver verifiera exakt WiFi-modell innan temperatur eller drift kan läsas i Energihem.",
  },
  {
    id: "energy-meter",
    name: "Realtidsmätare för el",
    shortName: "Elmätning",
    description: "Energiläsare eller gateway till elmätaren.",
    help: "Ange läsarens eller gatewayens serienummer/enhets-ID. Det är inte elavtalets anläggnings-ID.",
    next: "Läsarens modell och elmätarens port (KM, P1 eller HAN) behöver kontrolleras. Ett serienummer bekräftar inte kompatibilitet eller tillgång till mätvärden.",
  },
  {
    id: "charger",
    name: "Billaddare",
    shortName: "Billaddare",
    description: "Exempelvis en laddbox från Zaptec.",
    help: "Hitta serienumret på laddboxen eller i tillverkarens app. Ange inte lösenord eller kontots API-token.",
    next: "En verifierad integration och säker inloggning hos tillverkaren behövs innan status kan läsas. Ingen laddning styrs genom denna registrering.",
  },
  {
    id: "other",
    name: "Annan enhet",
    shortName: "Annan enhet",
    description: "Registrera en modell som du vill ansluta senare.",
    help: "Ange serienummer eller enhets-ID från produktens etikett eller app.",
    next: "Integrationsmöjligheten behöver undersökas för exakt tillverkare och modell. Registrering aktiverar ingen styrning.",
  },
] as const;
export const deviceDetailsSchema = z.object({
  kind: deviceKindSchema,
  name: z
    .string()
    .trim()
    .min(1, "Ange ett namn på enheten.")
    .max(80, "Enhetens namn får ha högst 80 tecken."),
  manufacturer: z
    .string()
    .trim()
    .min(1, "Ange tillverkare.")
    .max(80, "Tillverkaren får ha högst 80 tecken."),
  model: z
    .string()
    .trim()
    .min(1, "Ange exakt modell.")
    .max(100, "Modellen får ha högst 100 tecken."),
  identifier: z
    .string()
    .trim()
    .min(3, "Ange minst tre tecken i serienummer eller enhets-ID.")
    .max(80, "Serienumret får ha högst 80 tecken.")
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9 .:_/-]*$/,
      "Använd bokstäver, siffror, blanksteg eller tecknen . : _ / - i enhetsnumret.",
    ),
});
export type DeviceDetails = z.infer<typeof deviceDetailsSchema>;
export const pendingDeviceStatus = "Förberedd – ej ansluten" as const;
const identity = (value: string) =>
  value.replace(/\s+/g, "").toLocaleUpperCase("sv-SE");
export function registerDevice(
  raw: unknown,
  householdId: string,
  existing: Device[],
  editingId?: string,
): Device {
  const details = deviceDetailsSchema.parse(raw);
  const previous = editingId
    ? existing.find(
        (d) =>
          d.id === editingId &&
          d.householdId === householdId &&
          d.source === "registered",
      )
    : undefined;
  if (editingId && !previous)
    throw Error("Enheten finns inte i det här hushållet.");
  if (
    existing.some(
      (d) =>
        d.id !== editingId &&
        d.householdId === householdId &&
        d.source === "registered" &&
        identity(d.manufacturer) === identity(details.manufacturer) &&
        identity(d.identifier ?? "") === identity(details.identifier),
    )
  )
    throw Error(
      "En enhet med samma tillverkare och enhetsnummer finns redan i hushållet.",
    );
  return {
    ...details,
    id: previous?.id ?? crypto.randomUUID(),
    householdId,
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    source: "registered",
    status: pendingDeviceStatus,
  };
}
