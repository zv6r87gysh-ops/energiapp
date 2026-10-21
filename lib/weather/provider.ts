import { z } from "zod";
import { postcodeSchema, weatherSchema, type Weather } from "./contracts";
const locationSchema = z.object({
  "country abbreviation": z.literal("SE"),
  "post code": postcodeSchema,
  places: z
    .array(
      z.object({
        "place name": z.string().min(1),
        latitude: z.string().transform(Number).pipe(z.number().min(55).max(70)),
        longitude: z
          .string()
          .transform(Number)
          .pipe(z.number().min(10).max(25)),
      }),
    )
    .min(1),
});
const metSchema = z.object({
  properties: z.object({
    meta: z.object({
      updated_at: z.iso.datetime(),
      units: z.object({
        air_temperature: z.literal("celsius"),
        wind_speed: z.literal("m/s"),
      }),
    }),
    timeseries: z
      .array(
        z.object({
          time: z.iso.datetime(),
          data: z.object({
            instant: z.object({
              details: z.object({
                air_temperature: z.number().min(-65).max(60),
                wind_speed: z.number().min(0).max(100),
              }),
            }),
            next_1_hours: z
              .object({ summary: z.object({ symbol_code: z.string() }) })
              .optional(),
          }),
        }),
      )
      .min(1),
  }),
});
export function parseLocation(raw: unknown, postcode: string) {
  const data = locationSchema.parse(raw);
  if (data["post code"] !== postcode)
    throw Error("Fel postnummer från geokodning");
  const p = data.places[0];
  return {
    postcode,
    place: p["place name"],
    latitude: Math.trunc(p.latitude * 10000) / 10000,
    longitude: Math.trunc(p.longitude * 10000) / 10000,
  };
}
export function parseForecast(
  raw: unknown,
  location: ReturnType<typeof parseLocation>,
  expiresAt: number,
  now: number,
): Weather {
  const { properties: data } = metSchema.parse(raw);
  const hours = data.timeseries.map((h) => ({
    time: h.time,
    temperature: h.data.instant.details.air_temperature,
    wind: h.data.instant.details.wind_speed,
    symbol: h.data.next_1_hours?.summary.symbol_code,
  }));
  for (let i = 1; i < hours.length; i++)
    if (Date.parse(hours[i].time) <= Date.parse(hours[i - 1].time))
      throw Error("Osorterad prognos");
  if (
    now - Date.parse(data.meta.updated_at) > 6 * 3600000 ||
    Date.parse(data.meta.updated_at) > now + 300000
  )
    throw Error("Inaktuell prognos");
  if (
    !hours.some(
      (h) => Date.parse(h.time) <= now && Date.parse(h.time) + 3600000 > now,
    )
  )
    throw Error("Aktuell prognostimme saknas");
  return weatherSchema.parse({
    ...location,
    source: "MET Norway",
    issuedAt: data.meta.updated_at,
    fetchedAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    hours,
  });
}
