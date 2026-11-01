import type { FoodItem } from "@sari/contracts";
import { formatDate, formatTimestamp } from "@/utils/date";
import ExpirationStatus from "../Inventory/ExpirationStatus";

interface ItemDetailsOverviewProps {
  item: FoodItem;
  now: Date;
}

function quantity(item: FoodItem) {
  if (item.unit !== "item") {
    return `${item.quantity} ${item.unit}`;
  }

  return `${item.quantity} ${item.quantity === 1 ? "item" : "items"}`;
}

export default function ItemDetailsOverview({
  item,
  now,
}: ItemDetailsOverviewProps) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="item-overview-heading">
        <h2
          id="item-overview-heading"
          className="text-sm font-semibold tracking-wide text-content-muted uppercase"
        >
          Overview
        </h2>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-content-muted">Recorded date</dt>
            <dd className="mt-1 font-medium">
              {item.expiresOn ? (
                <time dateTime={item.expiresOn}>
                  {formatDate(item.expiresOn)}
                </time>
              ) : (
                "No date"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-content-muted">Relative status</dt>
            <dd className="mt-1">
              <ExpirationStatus
                expiresOn={item.expiresOn}
                now={now}
                prominentLater
              />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-content-muted">Quantity</dt>
            <dd className="mt-1 font-medium">{quantity(item)}</dd>
          </div>
        </dl>
      </section>
      <section
        aria-labelledby="item-record-heading"
        className="border-t border-border-default pt-6"
      >
        <h2
          id="item-record-heading"
          className="text-sm font-semibold tracking-wide text-content-muted uppercase"
        >
          Record information
        </h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-content-muted">Created</dt>
            <dd className="mt-1">
              <time dateTime={item.createdAt}>
                {formatTimestamp(item.createdAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt className="text-content-muted">Last updated</dt>
            <dd className="mt-1">
              <time dateTime={item.updatedAt}>
                {formatTimestamp(item.updatedAt)}
              </time>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
