import type { FoodItem } from "@sari/contracts";
import { AgGridReact } from "ag-grid-react";
import { useFoodItemColumns } from "../../hooks/useFoodItemColumns";
import { useFoodItemsTable } from "../../hooks/useFoodItemsTable";
import type { FoodItemActions } from "../../types/foodItems";
import FoodItemsEmptyState from "./FoodItemsEmptyState";
import FoodItemsToolbar from "./FoodItemsToolbar";
import {
  defaultColDef,
  FOOD_ITEMS_PAGE_SIZE,
  foodItemsTheme,
  getRowId,
  rowClassRules,
  rowSelection,
  selectionColumnDef,
} from "./gridOptions";

interface FoodItemsTableProps extends FoodItemActions {
  revision: number;
  onAdd: () => void;
}

export default function FoodItemsTable({
  revision,
  disabled,
  onAdd,
  onEdit,
  onDelete,
}: FoodItemsTableProps) {
  const {
    gridRef,
    selected,
    filtered,
    hasQuery,
    setSelected,
    setFiltered,
    setSearch,
    error,
    loading,
    total,
    datasource,
    retryLoad,
  } = useFoodItemsTable(revision);
  const columnDefs = useFoodItemColumns({ disabled, onEdit, onDelete });

  return (
    <section
      aria-label="Food inventory"
      className="overflow-hidden rounded-panel border border-border-default bg-surface"
      inert={disabled}
    >
      <FoodItemsToolbar
        selectedCount={selected.length}
        hasFilters={filtered}
        disabled={disabled}
        onSearch={setSearch}
        onAdd={onAdd}
        onClearFilters={() => gridRef.current?.api.setFilterModel(null)}
        onClearSelection={() => gridRef.current?.api.deselectAll()}
        onDeleteSelected={() => {
          onDelete(selected);
        }}
      />
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-danger-subtle px-4 py-3 text-sm text-danger">
          <p>{error}</p>
          <button
            type="button"
            onClick={retryLoad}
            className="inline-flex items-center justify-center gap-2 rounded-control border border-border-default bg-surface px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Try again
          </button>
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {loading
          ? "Loading items…"
          : error
            ? "Items could not be loaded."
            : total !== null
              ? `${total} matching items.`
              : ""}
      </p>
      <div
        aria-busy={loading}
        className={`h-[calc(100dvh-260px)] min-h-90 w-full max-sm:[&_.ag-paging-page-size]:hidden max-sm:[&_.ag-paging-panel]:gap-2 max-sm:[&_.ag-paging-panel]:px-2 max-sm:[&_.ag-paging-row-summary-panel]:hidden ${loading || error || total === null ? "[&_.ag-paging-panel]:invisible" : ""}`}
      >
        <AgGridReact<FoodItem>
          ref={gridRef}
          theme={foodItemsTheme}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          rowClassRules={rowClassRules}
          rowModelType="infinite"
          datasource={datasource}
          cacheBlockSize={FOOD_ITEMS_PAGE_SIZE}
          maxBlocksInCache={3}
          maxConcurrentDatasourceRequests={1}
          rowSelection={rowSelection}
          selectionColumnDef={selectionColumnDef}
          loading={loading}
          activeOverlay={
            !loading && !error && total === 0 ? FoodItemsEmptyState : undefined
          }
          activeOverlayParams={{ hasQuery, disabled, onAdd }}
          animateRows={false}
          suppressRowVirtualisation
          suppressColumnVirtualisation
          ensureDomOrder
          pagination
          paginationPageSize={FOOD_ITEMS_PAGE_SIZE}
          paginationPageSizeSelector={false}
          onGridReady={({ api }) => {
            api.setGridAriaProperty("label", "Food inventory");
          }}
          onSelectionChanged={({ api }) => {
            setSelected(api.getSelectedRows());
          }}
          onFilterChanged={({ api }) => {
            api.deselectAll();
            setFiltered(Object.keys(api.getFilterModel()).length > 0);
          }}
          onSortChanged={({ api }) => {
            api.deselectAll();
          }}
          onPaginationChanged={({ api, newPage }) => {
            if (newPage) {
              api.deselectAll();
            }
          }}
        />
      </div>
    </section>
  );
}
