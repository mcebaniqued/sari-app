import { formatPackageDateLine, LoadState, PantryItem } from "@/lib/domain/pantry";

interface PantryListSectionProps {
  state: LoadState;
  withDate: PantryItem[];
  noDate: PantryItem[];
  searchQuery: string;
  onLoad: () => void;
  onDelete: (item: PantryItem) => Promise<void>;
}

export default function PantryListSection({
  state,
  withDate,
  noDate,
  searchQuery,
  onLoad,
  onDelete,
}: PantryListSectionProps) {
  const q = searchQuery.trim();

  const hasItems = state.status === "ready" && state.items.length > 0;
  const hasNoItems = state.status === "ready" && state.items.length === 0;
  const hasSearch = q !== "";
  const hasVisibleResults = withDate.length > 0 || noDate.length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Your pantry</h2>
      </div>

      {state.status === "loading" ? (
        <p className="text-sm text-[rgb(var(--muted-foreground))]">Loading…</p>
      ) : null}

      {state.status === "error" ? (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{state.message}</p>
          <button
            className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm"
            onClick={onLoad}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {hasNoItems ? (
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          No items yet. Add your first item above.
        </p>
      ) : null}

      {/* Only show the lists if we're ready and have items. This avoids showing "No items match your search" when we haven't loaded yet. */}
      {hasItems ?
        // If there's a search query but no results, show a message. Otherwise show the lists (withDate and noDate).
        hasSearch && !hasVisibleResults ? (
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            No items match your search.
          </p>
        ) : (
          <div className="space-y-4">
            {/* With package date */}
            {withDate.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[rgb(var(--muted-foreground))]">
                  Items with a package date
                </h3>

                <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
                  <PantryList items={withDate} onDelete={onDelete} />
                </div>
              </div>
            ) : null}

            {/* No package date */}
            {noDate.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[rgb(var(--muted-foreground))]">
                  No expiration date
                </h3>

                <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
                  <PantryList items={noDate} onDelete={onDelete} />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
    </section>
  )
}

interface PantryListProps {
  items: PantryItem[];
  onDelete: (item: PantryItem) => Promise<void>;
}

function PantryList({items, onDelete}: PantryListProps) {
  return (
    <ul className="divide-y divide-[rgb(var(--border))]">
      {items.map((i) => (
        <li key={i._id} className="p-3 flex items-center justify-between gap-4">
          <ItemInfo name={i.name} quantity={i.quantity} unit={i.unit} />

          <div className="flex items-end flex-col gap-1">
            <div className="text-sm whitespace-nowrap">{formatPackageDateLine(i)}</div>

            <DeleteButton onClickDelete={async () => {
                await onDelete(i);
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

interface ItemInfoProps {
  name: string;
  quantity: number;
  unit: string;
}

function ItemInfo({ name, quantity, unit}: ItemInfoProps) {
  return (
    <div className="min-w-0">
      <div className="font-medium truncate">{name}</div>
      <div className="text-sm text-[rgb(var(--muted-foreground))]">
        {quantity} {unit}
      </div>
    </div>
  )
}

interface DeleteButtonProps {
  onClickDelete?: () => void;
}

function DeleteButton({ onClickDelete }: DeleteButtonProps) {
  return (
    <button
      className="text-xs text-red-600 hover:underline"
      type="button"
      onClick={onClickDelete}
    >
      Delete
    </button>
  )
}
