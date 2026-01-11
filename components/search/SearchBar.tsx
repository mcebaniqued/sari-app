interface SearchBarProps {
  query: string;
  onQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function SearchBar({ query, onQueryChange }: SearchBarProps) {
  return (
    <>
      <label className="sr-only" htmlFor="pantry-search">
        Search pantry
      </label>
      <input
        id="pantry-search"
        placeholder="Search..."
        className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--ring))]"
        value={query}
        onChange={onQueryChange}
      />
    </>
  );
};
