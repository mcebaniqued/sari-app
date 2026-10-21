import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LuArrowUp, LuLayoutGrid } from "react-icons/lu";
import DeleteFoodItemsDialog from "../components/DeleteFoodItemsDialog/DeleteFoodItemsDialog";
import FoodItemEditorDialog from "../components/FoodItemEditorDialog/FoodItemEditorDialog";
import FoodItemsEmptyState from "../components/Inventory/FoodItemsEmptyState";
import InventoryList from "../components/Inventory/InventoryList";
import InventoryTable from "../components/Inventory/InventoryTable";
import PantryToolbar from "../components/Inventory/PantryToolbar";
import { useInventory } from "../hooks/useInventory";
import { usePantryItems } from "../hooks/usePantryItems";

export default function PantryPage() {
  const inventory = useInventory();
  const pantry = usePantryItems(inventory.invalidate);
  const [selecting, setSelecting] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const desktopScroll = useRef<HTMLDivElement>(null);
  const desktopEnd = useRef<HTMLDivElement>(null);
  const mobileEnd = useRef<HTMLDivElement>(null);
  const queryKey = JSON.stringify([inventory.query, pantry.revision]);
  const { hasMore, loading, error, loadMore } = inventory;

  useLayoutEffect(() => {
    if (desktopScroll.current) {
      desktopScroll.current.scrollTop = 0;
    }
    if (window.matchMedia("(max-width: 767px)").matches) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [queryKey]);

  useEffect(() => {
    if (!hasMore || loading || error) {
      return;
    }
    const desktop = desktopEnd.current;
    const mobile = mobileEnd.current;
    const onIntersect: IntersectionObserverCallback = (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore();
      }
    };
    const desktopObserver = new IntersectionObserver(onIntersect, {
      root: desktopScroll.current,
      rootMargin: "0px 0px 240px 0px",
    });
    const mobileObserver = new IntersectionObserver(onIntersect, {
      rootMargin: "0px 0px 360px 0px",
    });
    if (desktop) {
      desktopObserver.observe(desktop);
    }
    if (mobile) {
      mobileObserver.observe(mobile);
    }

    return () => {
      desktopObserver.disconnect();
      mobileObserver.disconnect();
    };
  }, [hasMore, loading, error, loadMore]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY >= window.innerHeight * 2);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  function stateAndFallback() {
    return (
      <div className="px-4 py-4 text-center text-sm text-content-muted">
        {inventory.loading && (
          <p role="status">
            {inventory.items.length ? "Loading more items…" : "Loading items…"}
          </p>
        )}
        {inventory.error && (
          <div role="alert" className="space-y-2 text-danger">
            <p>{inventory.error}</p>
            <button
              type="button"
              onClick={inventory.retryLoad}
              className="min-h-11 rounded-control border border-border-default px-3 text-content"
            >
              Try again
            </button>
          </div>
        )}
        {!inventory.loading && !inventory.error && inventory.hasMore && (
          <button
            type="button"
            onClick={() => void inventory.loadMore()}
            className="min-h-11 rounded-control border border-border-default bg-surface px-4 text-content"
          >
            Load more
          </button>
        )}
        {!inventory.loading &&
          !inventory.error &&
          !inventory.hasMore &&
          inventory.items.length > 0 && <p>End of results</p>}
      </div>
    );
  }

  const actions = {
    disabled: pantry.busy,
    onEdit: pantry.startEdit,
    onDelete: pantry.startDelete,
  };
  const empty = inventory.total === 0 && !inventory.loading && !inventory.error;

  return (
    <div className="flex min-h-0 flex-col md:h-full">
      <div className="sticky top-[var(--pantry-header-offset,0px)] z-20 -mx-4 bg-page px-4 pb-3 pt-4 transition-[top] duration-200 motion-reduce:transition-none md:static md:mx-0 md:px-0 md:pb-4 md:pt-0">
        <h1 className="mb-3 flex items-center gap-3 text-2xl font-semibold tracking-tight md:mb-5">
          <LuLayoutGrid
            aria-hidden="true"
            className="size-6 shrink-0 text-brand"
          />
          My Pantry
        </h1>
        <PantryToolbar
          query={inventory.query}
          selectedCount={inventory.selected.length}
          loadedCount={inventory.items.length}
          selecting={selecting}
          disabled={pantry.busy}
          onSearch={(search) => {
            inventory.applyQuery({ ...inventory.query, search });
          }}
          onSort={(sort) => {
            inventory.applyQuery({ ...inventory.query, sort });
          }}
          onFilters={(filters, sort) => {
            inventory.applyQuery({ ...inventory.query, filters, sort });
          }}
          onRemoveFilter={(field) => {
            const filters = Object.fromEntries(
              Object.entries(inventory.query.filters).filter(
                ([name]) => name !== field,
              ),
            );
            inventory.applyQuery({ ...inventory.query, filters });
          }}
          onAdd={pantry.startAdd}
          onSelectMode={() => {
            setSelecting((value) => !value);
            inventory.clearSelection();
          }}
          onSelectAll={() => {
            inventory.setSelectedIds(
              new Set(inventory.items.map((item) => item.id)),
            );
          }}
          onClearSelection={inventory.clearSelection}
          onDeleteSelected={() => {
            pantry.startDelete(inventory.selected);
          }}
        />
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {inventory.loading
          ? "Loading items…"
          : inventory.total === null
            ? ""
            : `${inventory.total} matching items.`}
      </p>
      <section
        aria-label="Food inventory"
        className="hidden min-h-0 flex-1 overflow-hidden rounded-panel border border-border-default bg-surface md:flex md:flex-col"
      >
        <div
          ref={desktopScroll}
          data-testid="desktop-inventory-scroll"
          aria-busy={inventory.loading}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <InventoryTable
            items={inventory.items}
            selectedIds={inventory.selectedIds}
            onSelectionChange={inventory.setSelectedIds}
            {...actions}
          />
          {empty && (
            <FoodItemsEmptyState
              hasQuery={Boolean(
                inventory.query.search ||
                Object.keys(inventory.query.filters).length,
              )}
              disabled={pantry.busy}
              onAdd={pantry.startAdd}
            />
          )}
          <div ref={desktopEnd} aria-hidden="true" />
          {stateAndFallback()}
        </div>
      </section>
      <section aria-label="Food inventory" className="pb-12 md:hidden">
        {inventory.items.length > 0 && (
          <InventoryList
            items={inventory.items}
            selecting={selecting}
            selectedIds={inventory.selectedIds}
            onSelectionChange={inventory.setSelectedIds}
            {...actions}
          />
        )}
        {empty && (
          <FoodItemsEmptyState
            hasQuery={Boolean(
              inventory.query.search ||
              Object.keys(inventory.query.filters).length,
            )}
            disabled={pantry.busy}
            onAdd={pantry.startAdd}
          />
        )}
        <div ref={mobileEnd} aria-hidden="true" />
        {stateAndFallback()}
      </section>
      {showBackToTop && (
        <button
          type="button"
          aria-label="Back to top"
          onClick={() => {
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
            });
          }}
          className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-20 inline-flex size-12 items-center justify-center rounded-full bg-brand text-content-inverse shadow-modal focus-visible:outline-2 focus-visible:outline-brand md:hidden"
        >
          <LuArrowUp aria-hidden="true" />
        </button>
      )}
      {pantry.editor && (
        <FoodItemEditorDialog
          item={pantry.editor.item}
          busy={pantry.busy}
          onSave={pantry.saveItem}
          onClose={pantry.closeEditor}
        />
      )}
      {pantry.deleteTargets && (
        <DeleteFoodItemsDialog
          items={pantry.deleteTargets}
          error={pantry.deleteError}
          busy={pantry.busy}
          onConfirm={pantry.deleteItems}
          onClose={pantry.closeDelete}
        />
      )}
    </div>
  );
}
