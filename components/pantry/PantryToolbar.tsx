import { PantrySortOption } from "@/lib/domain/pantry";
import SearchBar from "../search/SearchBar";
import PantrySortSelect from "./PantrySortSelect";

interface PantryToolbarProps {
  searchQuery: string;
  onSearchChange: (nextQuery: string) => void;
  sortOption: PantrySortOption;
  onSortChange: (nextOption: PantrySortOption) => void;
  openFilterModal: () => void;
  onAdd: () => void;
};

export default function PantryToolbar({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  openFilterModal,
  onAdd,
}: PantryToolbarProps) {
  return (
    <section className="space-y-2">
      {/* Mobile toolbar */}
      <div className="flex flex-col gap-2 md:hidden">
        <SearchBar query={searchQuery} onChangeQuery={onSearchChange} label="Search pantry" />
        <div className="flex items-center justify-end gap-2">
          <FilterButton title="Filter & Sort" onClick={openFilterModal} />
          <AddItemButton onClick={onAdd} />
        </div>
      </div>

      {/* Desktop toolbar */}
      <div className="hidden md:flex items-center gap-3">
        {/* Search Bar */}
        <div className="flex-1">
          <SearchBar query={searchQuery} onChangeQuery={onSearchChange} label="Search pantry" />
        </div>
        {/* Sort Dropdown */}
        <PantrySortSelect
          value={sortOption}
          onChange={onSortChange}
        />
        <FilterButton title="Filter" onClick={openFilterModal} />
        <AddItemButton onClick={onAdd} />
      </div>
    </section>
  )
}

interface FilterButtonProps {
  title: string;
  onClick: () => void;
}

function FilterButton({title, onClick}: FilterButtonProps) {
  return (
    <button
      type="button"
      className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm"
      onClick={onClick}
    >
      {title}
    </button>
  )
}

interface AddItemButtonProps {
  onClick: () => void;
}

function AddItemButton({ onClick }: AddItemButtonProps) {
  return (
    <button
      type="button"
      className="rounded-md bg-[rgb(var(--foreground))] text-[rgb(var(--background))] px-3 py-2 text-sm"
      onClick={() => onClick()}
    >
      Add item
    </button>
  )
}
