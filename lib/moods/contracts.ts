import { z } from "zod";
import { indoorGroupSchema } from "../lighting/contracts";
export const moodIds = ["children", "lounge", "ambience"] as const;
export const moodIdSchema = z.enum(moodIds);
export type MoodId = z.infer<typeof moodIdSchema>;
export const moodStyleSchema = z.object({
  query: z.string().trim().min(2).max(100),
  volume: z.number().int().min(0).max(100),
  brightness: z.number().int().min(0).max(100),
  lights: z
    .array(indoorGroupSchema)
    .max(5)
    .refine((v) => new Set(v).size === v.length),
});
export type MoodStyle = z.infer<typeof moodStyleSchema>;
export const moodSettingsSchema = z.object({
  styles: z.object({
    children: moodStyleSchema,
    lounge: moodStyleSchema,
    ambience: moodStyleSchema,
  }),
  room: z.string().max(200).optional(),
  device: z.string().max(200).optional(),
});
export type MoodSettings = z.infer<typeof moodSettingsSchema>;
const lights = indoorGroupSchema.options.slice();
export const defaultMoods: MoodSettings = {
  styles: {
    children: {
      query: "barnmusik svenska",
      volume: 25,
      brightness: 80,
      lights,
    },
    lounge: { query: "lounge chill", volume: 18, brightness: 20, lights },
    ambience: { query: "soul jazz", volume: 22, brightness: 35, lights },
  },
};
export const moodLabels: Record<MoodId, string> = {
  children: "Barn",
  lounge: "Lounge/chill",
  ambience: "Stämning",
};
export function readMoods(raw: unknown): MoodSettings {
  const result = moodSettingsSchema.safeParse(raw);
  return result.success ? result.data : structuredClone(defaultMoods);
}
export const activationSchema = z.object({
  householdId: z.string().min(1).max(100),
  mood: moodIdSchema,
  style: moodStyleSchema,
  room: z.string().min(1).max(200),
  device: z.string().min(1).max(200),
  requestId: z.string().uuid(),
});
export type Activation = z.infer<typeof activationSchema>;
export type MoodResult = {
  mood: MoodId;
  playlist: { name: string; url: string };
  music: { status: "requested" | "playing"; message: string };
  lights: { status: "preview"; message: string };
};
export type CloudStatus = {
  sonos: { configured: boolean; connected: boolean };
  spotify: { configured: boolean; connected: boolean };
  rooms: { id: string; name: string }[];
  devices: { id: string; name: string; restricted: boolean }[];
  message?: string;
};
