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
