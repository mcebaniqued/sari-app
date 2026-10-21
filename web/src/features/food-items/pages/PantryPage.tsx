import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LuArrowUp, LuLayoutGrid, LuTrash2 } from "react-icons/lu";
import DeleteFoodItemsDialog from "../components/DeleteFoodItemsDialog/DeleteFoodItemsDialog";
import FoodItemEditorDialog from "../components/FoodItemEditorDialog/FoodItemEditorDialog";
import AppliedFilters from "../components/Inventory/AppliedFilters";
import FilterDialog from "../components/Inventory/FilterDialog";
import {
  type LogicalFilterField,
  removeLogicalFilter,
} from "../components/Inventory/filterModel";
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
  const [filterEditor, setFilterEditor] = useState<{
    focusField?: LogicalFilterField;
  } | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const desktopScroll = useRef<HTMLDivElement>(null);
  const desktopEnd = useRef<HTMLDivElement>(null);
  const mobileEnd = useRef<HTMLDivElement>(null);
  const mobileInventory = useRef<HTMLElement>(null);
  const mobileAddButton = useRef<HTMLButtonElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const pendingMobileActionFocus = useRef<{
    kind: "edit" | "delete";
    id: string;
    index: number;
  } | null>(null);
  const queryKey = JSON.stringify([inventory.query, pantry.revision]);
  const { hasMore, loading, error, loadMore } = inventory;

  function restoreDialogFocusFallback() {
    if (pendingMobileActionFocus.current) {
      mobileAddButton.current?.focus();
    } else {
      filterButton.current?.focus();
    }
  }

  useEffect(() => {
    const pending = pendingMobileActionFocus.current;
    if (
      !pending ||
      (pending.kind === "edit" ? pantry.editor : pantry.deleteTargets)
    ) {
      return;
    }
    if (inventory.loading) {
      mobileAddButton.current?.focus();
      return;
    }
    const actions = Array.from(
      mobileInventory.current?.querySelectorAll<HTMLButtonElement>(
        "[data-row-action]",
      ) ?? [],
    );
    const sameItem =
      pending.kind === "edit"
        ? actions.find((action) => action.dataset.itemId === pending.id)
        : undefined;
    (
      sameItem ??
      actions[pending.index] ??
      actions[pending.index - 1] ??
      mobileAddButton.current
    )?.focus();
    pendingMobileActionFocus.current = null;
  }, [inventory.items, inventory.loading, pantry.deleteTargets, pantry.editor]);

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
  const mobileSelecting = selecting || inventory.selected.length > 0;

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
          disabled={pantry.busy}
          onSearch={(search) => {
            inventory.applyQuery({ ...inventory.query, search });
          }}
          onSort={(sort) => {
            inventory.applyQuery({ ...inventory.query, sort });
          }}
          filterOpen={filterEditor !== null}
          filterButtonRef={filterButton}
          mobileAddButtonRef={mobileAddButton}
          onOpenFilters={() => {
            setFilterEditor({});
          }}
          onAdd={pantry.startAdd}
          onClearSelection={inventory.clearSelection}
          onDeleteSelected={() => {
            pantry.startDelete(inventory.selected);
          }}
        />
      </div>
      <AppliedFilters
        filters={inventory.query.filters}
        disabled={pantry.busy}
        onEdit={(field) => {
          setFilterEditor({ focusField: field });
        }}
        onRemove={(field) => {
          const filters = removeLogicalFilter(inventory.query.filters, field);
          inventory.applyQuery({ ...inventory.query, filters });
        }}
        onClear={() => {
          inventory.applyQuery({ ...inventory.query, filters: {} });
        }}
        onFocusFallback={() => {
          filterButton.current?.focus();
        }}
      />
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
      {filterEditor && (
        <FilterDialog
          filters={inventory.query.filters}
          focusField={filterEditor.focusField}
          onClose={() => {
            setFilterEditor(null);
          }}
          onRestoreFocusFallback={() => {
            filterButton.current?.focus();
          }}
          onApply={(filters) => {
            inventory.applyQuery({ ...inventory.query, filters });
            setFilterEditor(null);
          }}
        />
      )}
      <section
        ref={mobileInventory}
        aria-label="Food inventory"
        className={`${mobileSelecting ? "pb-[calc(env(safe-area-inset-bottom)+6rem)]" : "pb-12"} md:hidden`}
      >
        <div className="flex min-h-11 items-center justify-between gap-3 text-sm">
          <p className="text-content-muted" aria-live="polite">
            {mobileSelecting
              ? `${inventory.selected.length} selected`
              : inventory.total === null
                ? "Loading items…"
                : `${inventory.total} ${inventory.total === 1 ? "item" : "items"}`}
          </p>
          {(inventory.items.length > 0 || mobileSelecting) && (
            <button
              type="button"
              onClick={() => {
                if (mobileSelecting) {
                  inventory.clearSelection();
                  setSelecting(false);
                } else {
                  setSelecting(true);
                }
              }}
              className="min-h-11 rounded-control px-2 text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand"
            >
              {mobileSelecting ? "Done selecting" : "Select"}
            </button>
          )}
        </div>
        {inventory.items.length > 0 && (
          <InventoryList
            items={inventory.items}
            selecting={mobileSelecting}
            selectedIds={inventory.selectedIds}
            onSelectionChange={inventory.setSelectedIds}
            {...actions}
            onEdit={(item) => {
              pendingMobileActionFocus.current = {
                kind: "edit",
                id: item.id,
                index: inventory.items.findIndex(
                  (entry) => entry.id === item.id,
                ),
              };
              pantry.startEdit(item);
            }}
            onDelete={(targets) => {
              const target = targets[0];
              if (target) {
                pendingMobileActionFocus.current = {
                  kind: "delete",
                  id: target.id,
                  index: inventory.items.findIndex(
                    (item) => item.id === target.id,
                  ),
                };
              }
              pantry.startDelete(targets);
            }}
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
      {mobileSelecting && (
        <div
          role="toolbar"
          aria-label="Selected items"
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 border-t border-border-default bg-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-modal md:hidden"
        >
          <button
            type="button"
            disabled={pantry.busy || inventory.items.length === 0}
            onClick={() => {
              inventory.setSelectedIds(
                new Set(inventory.items.map((item) => item.id)),
              );
            }}
            className="min-h-11 rounded-control px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
          >
            Select all
          </button>
          <button
            type="button"
            disabled={pantry.busy || inventory.selected.length === 0}
            onClick={inventory.clearSelection}
            className="min-h-11 rounded-control px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={pantry.busy || inventory.selected.length === 0}
            onClick={() => {
              pantry.startDelete(inventory.selected);
            }}
            className="inline-flex min-h-11 items-center gap-1 rounded-control border border-danger-border px-3 text-sm font-medium text-danger hover:bg-danger-subtle focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
          >
            <LuTrash2 aria-hidden="true" /> Delete ({inventory.selected.length})
          </button>
        </div>
      )}
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
          className={`fixed right-4 z-20 inline-flex size-12 items-center justify-center rounded-full bg-brand text-content-inverse shadow-modal focus-visible:outline-2 focus-visible:outline-brand md:hidden ${mobileSelecting ? "bottom-[calc(env(safe-area-inset-bottom)+6rem)]" : "bottom-[calc(env(safe-area-inset-bottom)+1rem)]"}`}
        >
          <LuArrowUp aria-hidden="true" />
        </button>
      )}
      {pantry.editor && (
        <FoodItemEditorDialog
          item={pantry.editor.item}
          busy={pantry.busy}
          onSave={pantry.saveItem}
          onClose={() => {
            pendingMobileActionFocus.current = null;
            pantry.closeEditor();
          }}
          onRestoreFocusFallback={restoreDialogFocusFallback}
        />
      )}
      {pantry.deleteTargets && (
        <DeleteFoodItemsDialog
          items={pantry.deleteTargets}
          error={pantry.deleteError}
          busy={pantry.busy}
          onConfirm={pantry.deleteItems}
          onClose={() => {
            pendingMobileActionFocus.current = null;
            pantry.closeDelete();
          }}
          onRestoreFocusFallback={restoreDialogFocusFallback}
        />
      )}
    </div>
  );
}
