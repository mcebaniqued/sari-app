export type ExpirationTreatment =
  "none" | "past" | "soon" | "upcoming" | "later";

export function expirationStatus(
  expiresOn: string | null,
  now: Date,
): { text: string; treatment: ExpirationTreatment } {
  if (!expiresOn) {
    return { text: "No date", treatment: "none" };
  }

  const year = Number(expiresOn.slice(0, 4));
  const month = Number(expiresOn.slice(5, 7));
  const day = Number(expiresOn.slice(8, 10));
  // Date.UTC gives each calendar date a stable day number across DST changes.
  const targetDay = Date.UTC(year, month - 1, day);
  const localDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const difference = Math.round((targetDay - localDay) / 86_400_000);

  if (difference < 0) {
    const daysPast = -difference;
    return {
      text: `${daysPast} ${daysPast === 1 ? "day" : "days"} past date`,
      treatment: "past",
    };
  }
  if (difference === 0) {
    return { text: "Today", treatment: "soon" };
  }
  if (difference === 1) {
    return { text: "Tomorrow", treatment: "soon" };
  }
  return {
    text: `In ${difference} days`,
    treatment: difference <= 7 ? "upcoming" : "later",
  };
}
