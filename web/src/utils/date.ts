const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** ISO calendar dates and timestamps are displayed in UTC until timezone settings exist. */
export function formatDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return `${months[date.getUTCMonth()] ?? ""} ${String(date.getUTCDate()).padStart(2, "0")}, ${String(date.getUTCFullYear()).padStart(4, "0")}`;
}

/** Timestamps use UTC until Sari has a user timezone preference. */
export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
  }).format(date);
}

/** Timestamps display in the browser's local timezone without changing date-only values. */
export function formatLocalTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZoneName: "short",
    year: "numeric",
  }).format(date);
}
