import type { FoodItem } from "@sari/contracts";
import { formatDate, formatLocalTimestamp } from "@/utils/date";

interface ItemDetailsOverviewProps {
  item: FoodItem;
}

function quantity(item: FoodItem) {
  if (item.unit !== "item") {
    return `${item.quantity} ${item.unit}`;
  }

  return `${item.quantity} ${item.quantity === 1 ? "item" : "items"}`;
}

export default function ItemDetailsOverview({
  item,
}: ItemDetailsOverviewProps) {
  return (
    <dl
      aria-label="Item details"
      className="grid max-w-[30rem] grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3"
    >
      <dt className="text-sm text-content-muted">Quantity</dt>
      <dd className="min-w-0 wrap-anywhere text-right font-medium">
        {quantity(item)}
      </dd>

      <dt className="text-sm text-content-muted">Recorded date</dt>
      <dd className="min-w-0 wrap-anywhere text-right font-medium">
        {item.expiresOn ? (
          <time dateTime={item.expiresOn}>{formatDate(item.expiresOn)}</time>
        ) : (
          "No date"
        )}
      </dd>

      <dt className="text-sm text-content-muted">Added</dt>
      <dd className="min-w-0 wrap-anywhere text-right text-sm text-content-muted">
        <time dateTime={item.createdAt}>
          {formatLocalTimestamp(item.createdAt)}
        </time>
      </dd>

      <dt className="text-sm text-content-muted">Updated</dt>
      <dd className="min-w-0 wrap-anywhere text-right text-sm text-content-muted">
        <time dateTime={item.updatedAt}>
          {formatLocalTimestamp(item.updatedAt)}
        </time>
      </dd>
    </dl>
  );
}
