/**
 * Representation of the pantry item as returned from the API.
 * Dates are serialized as ISO strings by `NextResponse`.
 */
export type PantryItem = {
  _id: string;
  name: string;
  quantity: number;
  unit: PantryUnit;
  dateLabelType?: DateLabelType;
  dateOnPackage?: string; // ISO date string
  createdAt?: string; // ISO date string
};

/**
 * Local load state for async data fetching.
 */
export type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: PantryItem[] };

/**
 * Format an ISO date string for display.
 * Returns `-` for missing or invalid values.
 *
 * @param iso - optional ISO date string
 */
export function formatDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

/**
 * Format the package date line for a pantry item.
 * @param i - pantry item
 * @returns formatted line like `Best if used by · 01/01/2024` or `-` if no date
 */
export function formatPackageDateLine(i: PantryItem) {
  if (!i.dateOnPackage) return "-";
  const label = i.dateLabelType ? DATE_LABEL_TYPE_LABELS[i.dateLabelType] : "Date on package";
  return `${label} ${formatDate(i.dateOnPackage)}`;
}

export const COUNT_UNITS = ["count"] as const;
export const WEIGHT_UNITS = ["oz", "lb", "g", "kg"] as const;
export const VOLUME_UNITS = ["fl oz", "cup", "ml", "l"] as const;

export const PANTRY_UNITS = [...COUNT_UNITS, ...WEIGHT_UNITS, ...VOLUME_UNITS] as const;
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

export const PANTRY_SORT_OPTIONS = [
  "expirationDateSoonest",
  "expirationDateLatest",
  "addedDateNewest",
  "addedDateOldest",
  "nameAZ",
  "nameZA",
] as const;

export const DEFAULT_PANTRY_SORT: PantrySortOption = PANTRY_SORT_OPTIONS[0];

export type PantrySortOption = (typeof PANTRY_SORT_OPTIONS)[number];

export const PANTRY_SORT_OPTION_LABELS: Record<PantrySortOption, string> = {
  expirationDateSoonest: "Expiration: Soonest",
  expirationDateLatest: "Expiration: Latest",
  addedDateNewest: "Added Date: Newest",
  addedDateOldest: "Added Date: Oldest",
  nameAZ: "Name: A-Z",
  nameZA: "Name: Z-A",
};

export function isPantrySortOption(v: unknown): v is PantrySortOption {
  return typeof v === "string" && (PANTRY_SORT_OPTIONS as readonly PantrySortOption[]).includes(v as PantrySortOption);
}