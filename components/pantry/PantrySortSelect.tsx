export function PantrySortSelect() {
  const sortOptions = [
    {value: 'packageDateNewest', label: 'Package Date: Newest'},
    {value: 'packageDateOldest', label: 'Package Date: Oldest'},
    {value: 'addedDateNewest', label: 'Added Date: Newest'},
    {value: 'addedDateOldest', label: 'Added Date: Oldest'},
    {value: 'nameAZ', label: 'Name: A-Z'},
    {value: 'nameZA', label: 'Name: Z-A'},
  ];

  return (
    <select
      className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm"
    >
      {sortOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
