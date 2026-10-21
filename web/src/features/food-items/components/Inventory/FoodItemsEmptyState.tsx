interface FoodItemsEmptyStateProps {
  hasQuery: boolean;
  disabled: boolean;
  onAdd: () => void;
}

export default function FoodItemsEmptyState({
  hasQuery,
  disabled,
  onAdd,
}: FoodItemsEmptyStateProps) {
  return (
    <div
      role="region"
      aria-label="No items found"
      className="pointer-events-auto mx-auto max-w-sm px-6 py-8 text-center"
    >
      <p className="text-base font-semibold text-content">No items found.</p>
      <p className="mt-2 text-sm leading-6 text-content-muted">
        {hasQuery
          ? "Try a different search or filter, or add an item."
          : "Add your first item to start your pantry."}
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-content-inverse hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Add an item
      </button>
    </div>
  );
}
