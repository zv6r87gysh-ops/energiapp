import { z } from "zod";
export const areaSchema = z.enum(["SE1", "SE2", "SE3", "SE4"]);
export type PriceArea = z.infer<typeof areaSchema>;
export const intervalSchema = z.object({
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  ore: z.number().finite(),
});
export const priceDaySchema = z.object({
  area: areaSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.literal("Elprisetjustnu.se"),
  sourceUrl: z.literal("https://www.elprisetjustnu.se/elpris-api"),
  fetchedAt: z.iso.datetime(),
  intervals: z.array(intervalSchema).min(92).max(100),
});
export type PriceDay = z.infer<typeof priceDaySchema>;
export interface PricesResponse {
  status: "available" | "unpublished" | "unavailable" | "not-configured";
  area: PriceArea;
  date: string;
  data: PriceDay | null;
  message: string;
}
