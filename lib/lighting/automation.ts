import { categoryActive, type SmartControl } from "../smart-control";
import type { OutdoorLighting } from "./contracts";
// Standard apparent sunrise/sunset: solar centre 0.833° below the horizon (disc + refraction).
export function lightingPower(
  lighting: OutdoorLighting,
  control: SmartControl,
  group: "outdoor" | "pool",
  altitude: number | null,
) {
  const category = group === "pool" ? "pool-lighting" : "outdoor-lighting";
  if (categoryActive(control, category)) {
    if (altitude === null)
      return {
        on: false,
        mode: "waiting-location" as const,
        label: "Solstyrning inväntar postnummer och plats.",
      };
    return {
      on: altitude < -0.833,
      mode: "solar" as const,
      label: "Solstyrning · tänd vid solnedgång, släckt vid soluppgång.",
    };
  }
  if (control.categories.includes(category))
    return {
      on: false,
      mode: "paused" as const,
      label: "Smart ljusstyrning är pausad.",
    };
  return {
    on:
      group === "pool" ? (lighting.poolPreviewOn ?? false) : lighting.previewOn,
    mode: "manual" as const,
    label: "Manuell förhandsvisning.",
  };
}
