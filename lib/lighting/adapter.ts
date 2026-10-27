import {
  lightingCommandSchema,
  type LightingCommand,
  type LightingCommandResult,
  type LightingState,
} from "./contracts";
// Implement with an authenticated server-side bridge when actual Plejd hardware is available.
// A successful command requires device read-back, not the browser's preview setting.
export interface OutdoorLightingAdapter {
  read(householdId: string, groupReference: string): Promise<LightingState>;
  setPower(command: LightingCommand): Promise<LightingCommandResult>;
}
export class UnconfiguredPlejdAdapter implements OutdoorLightingAdapter {
  async read(): Promise<LightingState> {
    return {
      provider: "plejd",
      connection: "not-configured",
      power: "unknown",
      observedAt: null,
    };
  }
  async setPower(command: LightingCommand): Promise<LightingCommandResult> {
    lightingCommandSchema.parse(command);
    return { ok: false, code: "not-configured" };
  }
}
