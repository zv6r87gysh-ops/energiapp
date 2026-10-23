import { z } from "zod";
// Only a server-side, authenticated device connector may supply this envelope.
// Device registration, demo values and weather forecasts alone are never telemetry.
export const poolTelemetrySchema = z.object({
  householdId: z.string().min(1),
  deviceId: z.string().min(1),
  verified: z.literal(true),
  readings: z
    .array(
      z.object({
        at: z.iso.datetime(),
        water: z.number().min(1).max(40),
        outdoor: z.number().min(-50).max(50),
        heating: z.boolean(),
        heatingStateSince: z.iso.datetime(),
        cover: z.enum(["open", "closed", "unknown"]),
        electricalKw: z.number().min(0).max(30).optional(),
      }),
    )
    .max(10000),
});
export type PoolTelemetry = z.infer<typeof poolTelemetrySchema>;
export interface LearnedPool {
  deviceId: string;
  water: number;
  sampledAt: string;
  coolingPerHour: number;
  heatingDegreesPerHour: number;
  electricalKw: number | null;
  coolingWindows: number;
  heatingWindows: number;
  observedHours: number;
  confidence: "preliminär" | "stabilare";
  cover: "open" | "closed" | "unknown";
  outdoorMin: number;
  outdoorMax: number;
}
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};
function robust(values: number[]) {
  if (!values.length) return [];
  const center = median(values),
    mad = median(values.map((v) => Math.abs(v - center)));
  return values.filter(
    (v) => Math.abs(v - center) <= Math.max(Math.abs(center) * 0.25, mad * 3),
  );
}
export function learnPoolBehavior(
  raw: unknown,
  householdId: string,
  now: number,
) {
  const parsed = poolTelemetrySchema.safeParse(raw);
  if (!parsed.success || parsed.data.householdId !== householdId)
    return {
      status: "not-connected" as const,
      model: null,
      message:
        "Inväntar riktig pooltemperatur och värmedrift från en ansluten WiFi-box. Registrering av en box är inte en verifierad anslutning.",
    };
  const { readings, deviceId } = parsed.data;
  const last = readings.at(-1);
  if (
    !last ||
    now - Date.parse(last.at) > 1800000 ||
    Date.parse(last.at) > now + 300000
  )
    return {
      status: "stale" as const,
      model: null,
      message:
        "Aktuella poolmätningar saknas. Väderstyrförslaget väntar på en ny avläsning.",
    };
  for (let i = 0; i < readings.length; i++) {
    if (
      Date.parse(readings[i].heatingStateSince) > Date.parse(readings[i].at) ||
      (i && Date.parse(readings[i].at) <= Date.parse(readings[i - 1].at))
    )
      return {
        status: "invalid" as const,
        model: null,
        message:
          "Mätserien har fel tidsordning eller ogiltig driftstatus. Inga värden lärs in.",
      };
  }
  // Use non-overlapping windows of at least 30 minutes, only within confirmed unchanged heating state.
  const windows: {
    rate: number;
    delta: number;
    hours: number;
    heating: boolean;
    outside: number;
    power?: number;
  }[] = [];
  let start = 0;
  for (let i = 1; i < readings.length; i++) {
    const a = readings[start],
      b = readings[i];
    const hours = (Date.parse(b.at) - Date.parse(a.at)) / 3600000;
    if (
      b.heating !== a.heating ||
      b.heatingStateSince !== a.heatingStateSince ||
      b.cover !== a.cover ||
      b.cover !== last.cover ||
      Date.parse(a.at) - Date.parse(a.heatingStateSince) < 600000 ||
      hours > 2 ||
      Math.abs(a.outdoor - b.outdoor) > 3
    ) {
      start = i;
      continue;
    }
    if (hours < 0.5) continue;
    const outside = (a.outdoor + b.outdoor) / 2;
    const delta = (a.water + b.water) / 2 - outside;
    if (delta >= 3)
      windows.push({
        rate: (b.water - a.water) / hours,
        delta,
        hours,
        heating: b.heating,
        outside,
        power: b.electricalKw,
      });
    start = i;
  }
  const cooling = robust(
    windows
      .filter((w) => !w.heating && w.rate < -0.02)
      .map((w) => -w.rate / w.delta)
      .filter((k) => k > 0.0001 && k < 0.2),
  );
  const observedHours =
    (Date.parse(last.at) - Date.parse(readings[0].at)) / 3600000;
  const waiting = {
    status: "learning" as const,
    model: null,
    message: `Lär känna poolen · ${cooling.length} användbara avsvalningsperioder. Behöver minst 3 avsvalningsperioder, 3 uppvärmningsperioder och ett dygns historik. Ingen extra avstängning görs för inlärningen.`,
  };
  if (cooling.length < 3 || observedHours < 24) return waiting;
  const k = median(cooling);
  const heating = robust(
    windows
      .filter((w) => w.heating)
      .map((w) => w.rate + k * w.delta)
      .filter((q) => q > 0.01 && q < 5),
  );
  if (heating.length < 3) return waiting;
  const powers = windows
    .filter((w) => w.heating && w.power !== undefined && w.power > 0)
    .map((w) => w.power!);
  const model: LearnedPool = {
    deviceId,
    water: last.water,
    sampledAt: last.at,
    coolingPerHour: k,
    heatingDegreesPerHour: median(heating),
    electricalKw: powers.length >= 3 ? median(powers) : null,
    coolingWindows: cooling.length,
    heatingWindows: heating.length,
    observedHours,
    confidence:
      observedHours >= 168 && cooling.length >= 20 && heating.length >= 20
        ? "stabilare"
        : "preliminär",
    cover: last.cover,
    outdoorMin: Math.min(...windows.map((w) => w.outside)),
    outdoorMax: Math.max(...windows.map((w) => w.outside)),
  };
  return {
    status: "ready" as const,
    model,
    message: `Inlärd värmebalans · ${model.confidence} uppskattning. ${model.coolingWindows} avsvalningsperioder och ${model.heatingWindows} uppvärmningsperioder. Ändrat poolskydd eller andra driftförhållanden kräver ny inlärning.`,
  };
}
export type PoolLearning = ReturnType<typeof learnPoolBehavior>;
export function learnedTemperatureAfter(
  water: number,
  outdoor: number,
  hours: number,
  model: LearnedPool,
  heating: boolean,
) {
  const equilibrium =
    outdoor +
    (heating ? model.heatingDegreesPerHour / model.coolingPerHour : 0);
  return (
    equilibrium +
    (water - equilibrium) * Math.exp(-model.coolingPerHour * hours)
  );
}
