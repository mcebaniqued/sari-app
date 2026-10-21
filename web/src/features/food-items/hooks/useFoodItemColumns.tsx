import type { FoodItem } from "@sari/contracts";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { useMemo } from "react";
import { formatDate } from "@/utils/date";
import FoodItemRowActions from "../components/FoodItemsTable/FoodItemRowActions";
import type { FoodItemActions } from "../types/foodItems";

const dateFilterParams = {
  browserDatePicker: true,
  maxNumConditions: 1,
  debounceMs: 300,
  inRangeInclusive: true,
  minValidYear: 1,
  maxValidYear: 9999,
};

export function useFoodItemColumns({
  disabled,
  onEdit,
  onDelete,
}: FoodItemActions) {
  return useMemo<ColDef<FoodItem>[]>(
    () => [
      {
        field: "name",
        headerName: "Food item",
        flex: 2,
        minWidth: 220,
        filter: "agTextColumnFilter",
        cellClass: "flex items-center font-medium",
      },
      {
        field: "quantity",
        headerName: "Quantity",
        width: 125,
        filter: "agNumberColumnFilter",
        cellClass: "flex items-center justify-end",
      },
      {
        field: "unit",
        headerName: "Unit",
        width: 110,
        filter: "agTextColumnFilter",
        valueFormatter: ({ value }: { value: unknown }) =>
          value === "item" ? "Items" : typeof value === "string" ? value : "",
      },
      {
        field: "expiresOn",
        headerName: "Expiration date",
        width: 180,
        cellDataType: "dateString",
        filter: "agDateColumnFilter",
        filterParams: dateFilterParams,
        valueFormatter: ({ value, data }) =>
          !data
            ? ""
            : typeof value === "string"
              ? formatDate(value)
              : "No expiration date",
      },
      {
        field: "createdAt",
        headerName: "Date added",
        width: 160,
        cellDataType: "dateTimeString",
        filter: "agDateColumnFilter",
        filterParams: dateFilterParams,
        valueFormatter: ({ value }: { value: unknown }) =>
          typeof value === "string" ? formatDate(value) : "",
      },
      {
        colId: "actions",
        headerName: "Actions",
        pinned: "right",
        lockPinned: true,
        width: 112,
        minWidth: 112,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: ({
          data,
        }: ICellRendererParams<FoodItem, unknown, unknown>) =>
          data ? (
            <FoodItemRowActions
              item={data}
              disabled={disabled}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : null,
      },
    ],
    [disabled, onEdit, onDelete],
  );
}
