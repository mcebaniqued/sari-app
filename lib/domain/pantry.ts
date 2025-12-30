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

export const DATE_LABEL_TYPES = [
  "best_if_used_by",
  "best_before",
  "use_by",
  "sell_by",
  "expiration_date",
  "not_sure",
] as const;

export type DateLabelType = (typeof DATE_LABEL_TYPES)[number];

export function isDateLabelType(v: unknown): v is DateLabelType {
  return typeof v === "string" && (DATE_LABEL_TYPES as readonly string[]).includes(v);
}

export const DATE_LABEL_TYPE_LABELS: Record<DateLabelType, string> = {
  best_if_used_by: "Best if used by",
  best_before: "Best before",
  use_by: "Use by",
  sell_by: "Sell by",
  expiration_date: "Expiration date",
  not_sure: "Not sure",
};