import { PantrySortOption } from "@/lib/domain/pantry";
import PantrySortSelect from "./PantrySortSelect";

type PantryFilterSortFormProps = {
  draftSortOption: PantrySortOption;
  onDraftSortChange: (option: PantrySortOption) => void;
};

export default function PantryFilterSortForm(
  {
    draftSortOption,
    onDraftSortChange,
  }: PantryFilterSortFormProps
) {
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-2 md:hidden'>
        <PantrySortSelect
          value={draftSortOption}
          onChange={onDraftSortChange}
        />
      </div>
    </div>
  )
}