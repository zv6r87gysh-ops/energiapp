import { z } from "zod";
const reference = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    /^[\p{L}\p{N} ._:/-]+$/u,
    "Använd namn eller enhetsreferens, inte hemligheter.",
  );
export const indoorGroupSchema = z.enum([
  "large-left",
  "large-right",
  "above-table",
  "behind-table",
]);
export type IndoorGroup = z.infer<typeof indoorGroupSchema>;
export const outdoorLightingSchema = z.object({
  previewOn: z.boolean(),
  poolPreviewOn: z.boolean().optional(),
  indoorPreview: z.partialRecord(indoorGroupSchema, z.boolean()).optional(),
  indoorBinding: z
    .object({
      bridgeType: z.enum([
        "unknown",
        "bluetooth",
        "home-assistant",
        "plejd-gateway",
        "other",
      ]),
      groups: z.partialRecord(indoorGroupSchema, reference),
    })
    .optional(),
  provider: z.literal("plejd"),
  binding: z
    .object({ bridgeReference: reference, groupReference: reference })
    .optional(),
});
export type OutdoorLighting = z.infer<typeof outdoorLightingSchema>;
export function readOutdoorLighting(home: {
  outdoorLighting?: unknown;
}): OutdoorLighting {
  const parsed = outdoorLightingSchema.safeParse(home.outdoorLighting);
  return parsed.success ? parsed.data : { provider: "plejd", previewOn: false };
}
export const lightingCommandSchema = z.object({
  householdId: z.string().min(1).max(100),
  groupReference: reference,
  requestId: z.string().uuid(),
  power: z.enum(["on", "off"]),
});
export type LightingCommand = z.infer<typeof lightingCommandSchema>;
export type LightingState = {
  provider: "plejd";
  connection: "not-configured" | "unavailable" | "connected";
  power: "on" | "off" | "unknown";
  observedAt: string | null;
};
export type LightingCommandResult =
  | { ok: false; code: "not-configured" | "unavailable" | "unconfirmed" }
  | {
      ok: true;
      state: LightingState & {
        connection: "connected";
        power: "on" | "off";
        observedAt: string;
      };
    };
