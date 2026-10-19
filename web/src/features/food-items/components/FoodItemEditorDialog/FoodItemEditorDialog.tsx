import type { CreateFoodItem, FoodItem } from "@sari/contracts";

import Modal from "@/components/Modal/Modal";

import FoodItemForm from "../FoodItemForm/FoodItemForm";

interface FoodItemEditorDialogProps {
  item: FoodItem | null;
  busy: boolean;
  onClose: () => void;
  onSave: (values: CreateFoodItem) => Promise<void>;
}
export default function FoodItemEditorDialog({
  item,
  busy,
  onClose,
  onSave,
}: FoodItemEditorDialogProps) {
  return (
    <Modal
      title={item ? "Edit item" : "Add item"}
      description={
        item
          ? "Update the details of your pantry item."
          : "Add something you have on hand."
      }
      onClose={onClose}
      dismissible={!busy}
    >
      <FoodItemForm
        item={item}
        disabled={busy}
        onSave={onSave}
        onCancel={onClose}
      />
    </Modal>
  );
}
