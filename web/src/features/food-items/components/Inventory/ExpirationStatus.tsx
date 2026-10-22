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
      className={`${badge ? "inline-block rounded-control border px-1.5 py-0.5 text-xs font-medium leading-5 whitespace-nowrap max-[280px]:wrap-anywhere max-[280px]:whitespace-normal" : "text-sm"} ${styles[treatment]}`}
    >
      {text}
    </span>
  );
}
