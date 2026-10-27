import type { Household } from "./models";
export const sections = [
  { id: "oversikt", name: "Översikt", icon: "home" },
  { id: "forbrukning", name: "Aktuell förbrukning", icon: "activity" },
  { id: "kostnad", name: "Uppskattad månadskostnad", icon: "wallet" },
  { id: "elpriser", name: "Elpriser", icon: "chart" },
  { id: "pool", name: "Pool", icon: "waves" },
  { id: "laddning", name: "Elbilsladdning", icon: "car" },
  { id: "golvvarme", name: "Golvvärme", icon: "heat" },
  { id: "belysning", name: "Belysning", icon: "lightbulb" },
  { id: "statistik", name: "Statistik", icon: "bars" },
  { id: "besparing", name: "Besparing", icon: "leaf" },
  {
    id: "installningar",
    name: "Inställningar & anslutna enheter",
    icon: "settings",
  },
];
export const initialHousehold: Household = {
  id: "demo-home",
  name: "Hemma hos oss",
  type: "Nybyggt parhus",
  area: 127,
  floors: 2,
  region: "SE3",
  grid: "Boo Energi",
  supplier: "Vattenfall",
  fuse: 20,
  heating: "Qvantum · Thermotech EC8 · vattenburen golvvärme",
  meter: "Kamstrup · KM-gränssnitt",
  pool: {
    temperature: 27.4,
    target: 28,
    mode: "Smart",
    length: 6,
    width: 3,
    depth: 1.5,
    model: "Pahlén Calidi VP",
    measurement: "estimated",
  },
  contract: { markup: 6, monthly: 49, vat: 25, discount: 0 },
  tariff: { variable: 28, tax: 43.9, monthly: 295, demand: 0, timeBased: 0 },
  vehicles: [
    {
      id: "demo-car",
      brand: "Volvo",
      model: "EX30",
      variant: "Single Motor Extended Range",
      year: 2026,
      battery: 64,
      ac: 11,
      loss: 10,
      nickname: "Vår Volvo",
      registration: "",
      isDefault: true,
    },
  ],
  devices: [],
  invitations: [],
  charging: false,
  smart: false,
  smartControl: {
    mode: "demo",
    enabled: false,
    categories: [],
    updatedAt: null,
  },
};
export const zones = [
  "Nedervåning",
  "Sovrum 1",
  "Sovrum 2",
  "Sovrum 3",
  "Kontor",
];
// Model names are catalog search entries, not verified technical specifications.
export const catalog: Record<string, string[]> = {
  Volvo: ["EX30", "EX40", "EX90", "XC60"],
  BMW: ["i4", "iX", "330e"],
  Tesla: ["Model 3", "Model Y"],
  Polestar: ["2", "3", "4"],
  Volkswagen: ["ID.3", "ID.4", "ID.7"],
  Audi: ["Q4 e-tron", "Q6 e-tron"],
  "Mercedes-Benz": ["EQA", "EQB", "EQE"],
  Porsche: ["Taycan", "Macan Electric"],
  Kia: ["EV3", "EV6", "Niro"],
  Hyundai: ["IONIQ 5", "IONIQ 6", "Kona"],
  Skoda: ["Enyaq", "Elroq"],
  Renault: ["Megane E-Tech", "Scenic E-Tech"],
  Cupra: ["Born", "Tavascan"],
  Nissan: ["Leaf", "Ariya"],
  Ford: ["Mustang Mach-E", "Explorer"],
  Peugeot: ["E-208", "E-3008"],
  Mini: ["Cooper Electric", "Countryman Electric"],
  BYD: ["Atto 3", "Seal", "Dolphin"],
};
export function demoSeries(count = 96, region = "SE3") {
  const factor =
    ({ SE1: 0.7, SE2: 0.8, SE3: 1, SE4: 1.15 } as Record<string, number>)[
      region
    ] ?? 1;
  return Array.from({ length: count }, (_, i) => {
    const hour = (i / count) * 24;
    const price = Math.round(
      (48 +
        26 * Math.sin(((hour - 6) / 24) * Math.PI * 2) +
        45 * Math.exp(-((hour - 18) ** 2) / 5)) *
        factor,
    );
    return {
      time: `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`,
      timestamp: new Date(Date.UTC(2026, 9, 20, 22, i * 15)).toISOString(),
      price,
      ore: price,
      power: +(
        1.1 +
        1.8 * Math.exp(-((hour - 7) ** 2) / 3) +
        2.6 * Math.exp(-((hour - 18) ** 2) / 8)
      ).toFixed(2),
      energy: +(18 + 8 * Math.sin(i * 0.8) + i * 0.3).toFixed(1),
    };
  });
}
export const daily = Array.from({ length: 31 }, (_, i) => ({
  time: String(i + 1),
  energy: 24 + ((i * 17) % 29),
  cost: 35 + ((i * 19) % 36),
  saving: 8 + ((i * 7) % 15),
}));
