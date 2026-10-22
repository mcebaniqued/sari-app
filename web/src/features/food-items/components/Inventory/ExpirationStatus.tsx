import { expirationStatus } from "../../utils/expirationStatus";

interface ExpirationStatusProps {
  expiresOn: string | null;
  now: Date;
}

export default function ExpirationStatus({
  expiresOn,
  now,
}: ExpirationStatusProps) {
  const { text, treatment } = expirationStatus(expiresOn, now);
  const styles = {
    none: "text-content-muted",
    past: "border-danger-border bg-danger-subtle text-danger",
    soon: "border-warning-border bg-warning-subtle text-warning",
    upcoming: "border-border-default bg-surface-subtle text-content",
    later: "text-content-muted",
  };
  const badge =
    treatment === "past" || treatment === "soon" || treatment === "upcoming";

  return (
    <span
      className={`${badge ? "inline-block wrap-anywhere rounded-control border px-2 py-0.5 text-xs font-medium leading-5" : "text-sm"} ${styles[treatment]}`}
    >
      {text}
    </span>
  );
}
