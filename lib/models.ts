import { z } from "zod";
export type DataMode = "demo" | "connected";
export type Role = "owner" | "admin" | "member" | "viewer";
export interface HouseholdEntity {
  id: string;
  householdId: string;
  createdAt: string;
}
export interface UserProfile {
  id: string;
  displayName: string;
}
export interface HouseholdMembership extends HouseholdEntity {
  userId: string;
  role: Role;
}
export interface HouseholdInvitation extends HouseholdEntity {
  email: string;
  role: Role;
  status: "pending" | "accepted";
}
export interface Device extends HouseholdEntity {
  name: string;
  manufacturer: string;
  model: string;
  source: "demo";
  status: string;
}
export interface DeviceConnection extends HouseholdEntity {
  deviceId: string;
  provider: string;
  lastSeenAt: string | null;
}
export interface EnergyReading extends HouseholdEntity {
  deviceId: string | null;
  timestamp: string;
  kw: number;
  kwh: number;
  source: "demo" | "measured" | "estimated";
}
export interface ElectricityPrice {
  timestamp: string;
  ore: number;
  area: string;
  source: "demo" | "verified";
}
export interface ElectricityContract {
  markup: number;
  monthly: number;
  vat: number;
  discount: number;
}
export interface GridTariff {
  variable: number;
  tax: number;
  monthly: number;
  demand: number;
  timeBased: number;
}
export const vehicleSchema = z.object({
  id: z.string(),
  brand: z.string().min(1),
  model: z.string().min(1),
  variant: z.string(),
  year: z.number().int().min(1990).max(2035),
  battery: z.number().positive(),
  ac: z.number().positive(),
  loss: z.number().min(0).max(40),
  nickname: z.string(),
  registration: z.string(),
  isDefault: z.boolean(),
});
export type Vehicle = z.infer<typeof vehicleSchema>;
export interface ChargingSession extends HouseholdEntity {
  vehicleId: string;
  kwh: number;
  cost: number;
  startAt: string;
  endAt: string;
}
export interface PoolConfiguration {
  temperature: number;
  target: number;
  mode: string;
  length: number;
  width: number;
  depth: number;
  model: string;
  measurement: "estimated";
}
export interface HeatingZone extends HouseholdEntity {
  name: string;
  status: "Ej ansluten";
}
export interface AutomationRule extends HouseholdEntity {
  mode: "off" | "manual" | "smart" | "holiday";
  deviceId: string;
  simulated: true;
}
export interface AutomationExecution extends HouseholdEntity {
  ruleId: string;
  simulated: true;
  result: string;
}
export interface SavingsEstimate extends HouseholdEntity {
  baseline: number;
  optimized: number;
  method: "modelled" | "hypothetical";
}
export interface Notification extends HouseholdEntity {
  message: string;
  read: boolean;
}
export interface AuditLog extends HouseholdEntity {
  actorId: string;
  action: string;
  simulated: boolean;
}
export interface Household {
  id: string;
  name: string;
  type: string;
  area: number;
  floors: number;
  region: string;
  grid: string;
  supplier: string;
  fuse: number;
  heating: string;
  meter: string;
  pool: PoolConfiguration;
  contract: ElectricityContract;
  tariff: GridTariff;
  vehicles: Vehicle[];
  devices: Device[];
  invitations: HouseholdInvitation[];
  charging: boolean;
  smart: boolean;
}
