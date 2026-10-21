import { LuLayoutGrid } from "react-icons/lu";
import DeleteFoodItemsDialog from "../components/DeleteFoodItemsDialog/DeleteFoodItemsDialog";
import FoodItemEditorDialog from "../components/FoodItemEditorDialog/FoodItemEditorDialog";
import FoodItemsTable from "../components/FoodItemsTable/FoodItemsTable";
import { usePantryItems } from "../hooks/usePantryItems";

export default function PantryPage() {
  const pantry = usePantryItems();

  return (
    <div>
      <h1 className="mb-6 flex items-center gap-3 text-2xl font-semibold tracking-tight">
        <LuLayoutGrid
          aria-hidden="true"
          className="size-6 shrink-0 text-brand"
        />
        My Pantry
      </h1>
      <FoodItemsTable
        revision={pantry.revision}
        disabled={pantry.busy}
        onAdd={pantry.startAdd}
        onEdit={pantry.startEdit}
        onDelete={pantry.startDelete}
      />
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
