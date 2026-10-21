import { z } from "zod";
import type { Household } from "./models";
export const smartCategorySchema = z.enum(["pool", "charging"]);
export type SmartCategory = z.infer<typeof smartCategorySchema>;
export const smartControlSchema = z
  .object({
    mode: z.literal("demo"),
    enabled: z.boolean(),
    categories: z.array(smartCategorySchema).max(2),
    updatedAt: z.iso.datetime().nullable(),
  })
  .refine(
    (c) => new Set(c.categories).size === c.categories.length,
    "Kategorier får inte upprepas",
  )
  .refine(
    (c) => !c.enabled || c.categories.length > 0,
    "Välj minst en kategori",
  );
export type SmartControl = z.infer<typeof smartControlSchema>;
export function defaultSmartControl(): SmartControl {
  return { mode: "demo", enabled: false, categories: [], updatedAt: null };
}
// Older local demos never made an explicit house-wide category selection.
export function readSmartControl(home: {
  smartControl?: unknown;
}): SmartControl {
  const result = smartControlSchema.safeParse(home.smartControl);
  return result.success ? result.data : defaultSmartControl();
}
export function categoryActive(control: SmartControl, category: SmartCategory) {
  return control.enabled && control.categories.includes(category);
}
export function changeSmartCategory(
  control: SmartControl,
  category: SmartCategory,
  active: boolean,
): SmartControl {
  const categories = active
    ? Array.from(new Set([...control.categories, category]))
    : control.categories.filter((c) => c !== category);
  return {
    mode: "demo",
    enabled: active || (control.enabled && categories.length > 0),
    categories,
    updatedAt: new Date().toISOString(),
  };
}
export function applySmartControl(
  home: Household,
  input: SmartControl,
): Household {
  const control = smartControlSchema.parse(input);
  return {
    ...home,
    smartControl: control,
    smart: categoryActive(control, "charging"),
    pool: {
      ...home.pool,
      mode: categoryActive(control, "pool")
        ? "Smart"
        : home.pool.mode === "Smart"
          ? "Manuellt"
          : home.pool.mode,
    },
  };
}
