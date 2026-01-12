import { PantrySortOption } from "@/lib/domain/pantry";
import PantrySortSelect from "./PantrySortSelect";

type PantryFilterSortFormProps = {
  draftSortOption: PantrySortOption;
  onDraftSortChange: (option: PantrySortOption) => void;
  onCancel: () => void;
  onApply: () => void;
};

export default function PantryFilterSortForm(
  {
    draftSortOption,
    onDraftSortChange,
    onCancel,
    onApply
  }: PantryFilterSortFormProps
) {
  return (
    <>
      <div className='flex flex-col md:hidden gap-4'>
        <PantrySortSelect
          value={draftSortOption}
          onChange={onDraftSortChange}
        />
      </div>

      <div className="flex items-center justify-end gap-3 mt-4">
        <button
          type="button"
          className="h-10 w-24 rounded-lg border border-[rgb(var(--border))] text-sm font-medium text-[rgb(var(--foreground))] shadow-sm"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="h-10 w-24 rounded-lg bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] shadow-sm disabled:opacity-60"
          onClick={onApply}
        >
          Apply
        </button>
      </div>
    </>
  )
}