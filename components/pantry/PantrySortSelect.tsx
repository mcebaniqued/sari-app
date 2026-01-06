import { PANTRY_SORT_OPTION_LABELS, PantrySortOption } from "@/lib/domain/pantry";

type PantrySortSelectProps = {
  value: PantrySortOption;
  onChange: (value: PantrySortOption) => void;
};

export function PantrySortSelect({ value, onChange }: PantrySortSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PantrySortOption)}
      className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm"
    >
      {Object.entries(PANTRY_SORT_OPTION_LABELS).map(([opt, label]) => (
        <option key={opt} value={opt as PantrySortOption}>
          {label}
        </option>
      ))}
    </select>
  );
}
