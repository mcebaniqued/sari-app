import { useId } from "react";
import { FaXmark } from "react-icons/fa6";

interface SearchBarProps {
  query: string;
  onChangeQuery: (nextQuery: string) => void;
  label?: string;
  placeholder?: string;
}

export default function SearchBar({ query, onChangeQuery, label, placeholder }: SearchBarProps) {
  const searchBarId = useId(); // Generate a unique ID for the search bar

  return (
    <div className="relative">
      <label className="sr-only" htmlFor={searchBarId}>
        {label || "Search"}
      </label>
      <input
        id={searchBarId}
        type="text"
        placeholder={placeholder || "Search..."}
        className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--ring))]"
        value={query}
        onChange={(e) => onChangeQuery(e.currentTarget.value)}
      />
      {query.trim() !== "" && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[rgb(var(--foreground))] hover:text-[rgb(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ring))]"
          onClick={() => onChangeQuery("")}
        >
          <span className="sr-only">Clear search</span>
          <FaXmark className="text-lg" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
