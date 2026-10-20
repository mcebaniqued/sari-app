import type { FoodItem } from "@sari/contracts";

export interface FoodItemActions {
  disabled: boolean;
  onEdit: (item: FoodItem) => void;
  onDelete: (items: FoodItem[]) => void;
}
export interface FoodItemEditorState {
  item: FoodItem | null;
}
