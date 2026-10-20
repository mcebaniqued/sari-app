import type { FoodItem } from "@sari/contracts";
import {
  AllCommunityModule,
  type ColDef,
  type GetRowIdParams,
  ModuleRegistry,
  type RowClassParams,
  type RowSelectionOptions,
  themeQuartz,
} from "ag-grid-community";

import SelectPageHeader from "./SelectPageHeader";

export const FOOD_ITEMS_PAGE_SIZE = 20;
ModuleRegistry.registerModules([AllCommunityModule]);
export const foodItemsTheme = themeQuartz.withParams({
  accentColor: "var(--color-brand)",
  backgroundColor: "var(--color-surface)",
  foregroundColor: "var(--color-content)",
  borderColor: "var(--color-border-default)",
  headerBackgroundColor: "var(--color-surface-subtle)",
  headerTextColor: "var(--color-content-muted)",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  headerFontSize: 12,
  headerFontWeight: 600,
  rowHeight: 52,
  headerHeight: 44,
  wrapperBorderRadius: 0,
  wrapperBorder: false,
  selectedRowBackgroundColor: "var(--color-brand-subtle)",
  rowHoverColor: "var(--color-surface-hover)",
  cellHorizontalPadding: 16,
});
export const defaultColDef: ColDef<FoodItem> = {
  sortable: true,
  filter: true,
  resizable: true,
  suppressMovable: true,
  minWidth: 110,
  cellClass: "flex items-center",
  filterParams: { maxNumConditions: 1, debounceMs: 300 },
};
export const rowSelection: RowSelectionOptions<FoodItem> = {
  mode: "multiRow",
  headerCheckbox: false,
  enableClickSelection: false,
};
export const selectionColumnDef = {
  width: 48,
  minWidth: 48,
  pinned: "left" as const,
  lockPinned: true,
  resizable: false,
  headerComponent: SelectPageHeader,
};
export const getRowId = ({ data }: GetRowIdParams<FoodItem>) => data.id;

// Infinite scrolling needs a placeholder to trigger its first request. Keep it
// invisible until a real record arrives, including its checkbox and cell borders.
export const rowClassRules = {
  invisible: ({ data }: RowClassParams<FoodItem>) => !data,
};
