import type { FoodItem } from "@sari/contracts";
import ItemDetailsOverview from "./ItemDetailsOverview";

interface ItemDetailsContentProps {
  initialError: string;
  invalid: boolean;
  item: FoodItem | null;
  loading: boolean;
  now: Date;
  onRetry: () => void;
  unavailable: boolean;
  verificationError: string;
  verifying: boolean;
}

export default function ItemDetailsContent({
  initialError,
  invalid,
  item,
  loading,
  now,
  onRetry,
  unavailable,
  verificationError,
  verifying,
}: ItemDetailsContentProps) {
  if (invalid) {
    return (
      <div role="alert" className="rounded-panel bg-surface-subtle p-4">
        <p className="font-medium">This item link is invalid.</p>
        <p className="mt-1 text-sm text-content-muted">
          Check the address or return to your pantry.
        </p>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div role="alert" className="rounded-panel bg-surface-subtle p-4">
        <p className="font-medium">Item unavailable</p>
        <p className="mt-1 text-sm text-content-muted">
          It may have been deleted or is not available in this pantry.
        </p>
      </div>
    );
  }

  if (loading && !item) {
    return <p role="status">Loading item details…</p>;
  }

  if (initialError && !item) {
    return (
      <div
        role="alert"
        className="rounded-panel border border-danger-border p-4"
      >
        <p className="text-danger">{initialError}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 rounded-control border border-border-default px-4 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <>
      {verifying && (
        <p role="status" className="mb-4 text-sm text-content-muted">
          Checking for updates…
        </p>
      )}
      {verificationError && (
        <div
          role="alert"
          className="mb-5 rounded-panel border border-warning-border bg-warning-subtle p-4"
        >
          <p className="text-sm text-warning">
            Showing saved Pantry data. {verificationError}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 min-h-11 rounded-control border border-border-default bg-surface px-4 font-medium"
          >
            Retry verification
          </button>
        </div>
      )}
      <ItemDetailsOverview item={item} now={now} />
    </>
  );
}
