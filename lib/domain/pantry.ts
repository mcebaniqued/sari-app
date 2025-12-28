export const PANTRY_UNITS = ["count", "g", "oz", "ml"] as const;
export type PantryUnit = (typeof PANTRY_UNITS)[number];

export const PANTRY_STATUSES = ["ACTIVE", "CONSUMED", "DISCARDED"] as const;
export type PantryStatus = (typeof PANTRY_STATUSES)[number];

export function isPantryUnit(v: unknown): v is PantryUnit {
  return typeof v === "string" && (PANTRY_UNITS as readonly string[]).includes(v);
}

export function isPantryStatus(v: unknown): v is PantryStatus {
  return typeof v === "string" && (PANTRY_STATUSES as readonly string[]).includes(v);
}
