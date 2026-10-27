import type { EnergyReading, ElectricityPrice } from "./models";
export interface EnergyAdapter {
  readonly mode: "demo" | "connected";
  read(householdId: string): Promise<EnergyReading[]>;
}
export interface PriceAdapter {
  prices(area: string, date: string): Promise<ElectricityPrice[]>;
}
export const integrationStatus = [
  {
    name: "Svenska kvartspriser",
    status: "Elprisetjustnu.se · offentlig serverbaserad prisadapter",
  },
  { name: "Zaptec", status: "Inte ansluten – officiellt API ska verifieras" },
  {
    name: "Boo Energi Power Hub KM / Bitvis",
    status: "Planerad – protokoll och lokal gateway behöver verifieras",
  },
  {
    name: "Pahlén Calidi VP",
    status: "WiFi planerad – API och energimätning ej verifierade",
  },
  {
    name: "Plejd · Utebelysning",
    status: "Förberedd – ej ansluten; endast förhandsvisning på husbilden",
  },
  { name: "Thermotech EC8", status: "Ej ansluten – ingen styrintegration" },
  {
    name: "Zaptec Sense P1",
    status: "Ej installerad – KM-kompatibilitet ej verifierad",
  },
];
// Public prices are read-only. No hardware command implementation is provided.
export function hardwareCommand(): never {
  throw new Error("Verklig hårdvarustyrning är inte tillgänglig i fas 1");
}
