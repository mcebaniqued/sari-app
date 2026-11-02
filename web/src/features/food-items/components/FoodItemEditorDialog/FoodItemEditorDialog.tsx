import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import FoodItemEditor from "../FoodItemEditor/FoodItemEditor";

interface FoodItemEditorDialogProps {
  item: FoodItem | null;
  busy: boolean;
  onClose: () => void;
  onSave: (
    values: CreateFoodItem,
    expectedRevision: number | null,
  ) => Promise<void>;
  onKeepSavedAndClose: (item: FoodItem) => void;
  onRestoreFocusFallback?: () => void;
}

export default function FoodItemEditorDialog(props: FoodItemEditorDialogProps) {
  return <FoodItemEditor {...props} presentation="modal" />;
}
