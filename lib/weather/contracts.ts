import { z } from "zod";
export const postcodeSchema = z
  .string()
  .transform((s) => s.replace(/\s/g, ""))
  .pipe(z.string().regex(/^[1-9]\d{4}$/));
export const weatherSchema = z.object({
  postcode: postcodeSchema,
  place: z.string().min(1),
  latitude: z.number().min(55).max(70),
  longitude: z.number().min(10).max(25),
  source: z.literal("MET Norway"),
  issuedAt: z.iso.datetime(),
  fetchedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  hours: z
    .array(
      z.object({
        time: z.iso.datetime(),
        temperature: z.number().min(-65).max(60),
        wind: z.number().min(0).max(100),
        symbol: z.string().optional(),
      }),
    )
    .min(1)
    .max(300),
});
export type Weather = z.infer<typeof weatherSchema>;
export const thermalSettingsSchema = z.object({
  enabled: z.boolean(),
  tolerance: z.number().min(0.1).max(5),
  preheat: z.number().min(0).max(3),
  pauseHours: z.number().int().min(1).max(12),
});
export type ThermalSettings = z.infer<typeof thermalSettingsSchema>;
export function forecastFresh(weather: Weather, now: number) {
  return (
    Date.parse(weather.issuedAt) <= now + 300000 &&
    now - Date.parse(weather.issuedAt) <= 6 * 3600000 &&
    now < Date.parse(weather.expiresAt) &&
    Date.parse(weather.fetchedAt) <= now + 300000
  );
}
export function weatherHour(weather: Weather, now: number) {
  return (
    weather.hours.find(
      (h) => Date.parse(h.time) <= now && Date.parse(h.time) + 3600000 > now,
    ) ?? null
  );
}
