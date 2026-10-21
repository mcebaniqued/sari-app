import { useEffect, useId, useRef, useState } from "react";
import { LuSearch, LuX } from "react-icons/lu";
import Input from "@/components/Input/Input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface SearchBarProps {
  label: string;
  placeholder?: string;
  maxLength?: number;
  onSearch: (value: string) => void;
  disabled?: boolean;
  delayMs?: number;
}

export default function SearchBar({
  label,
  placeholder = "Search…",
  maxLength,
  onSearch,
  disabled = false,
  delayMs = 300,
}: SearchBarProps) {
  const [value, setValue] = useState("");

  const submitted = useRef("");
  const id = useId();
  const debouncedValue = useDebouncedValue(value.trim(), delayMs);
  useEffect(() => {
    if (debouncedValue === submitted.current) {
      return;
    }

    submitted.current = debouncedValue;
    onSearch(debouncedValue);
  }, [debouncedValue, onSearch]);

  return (
    <div role="search" className="relative w-full min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <LuSearch
        aria-hidden="true"
        className="pointer-events-none absolute top-3 left-3 size-4 text-content-muted"
      />
      <Input
        id={id}
        type="search"
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        placeholder={placeholder}
        className="pr-10 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          disabled={disabled}
          onClick={() => {
            setValue("");
          }}
          className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand"
        >
          <LuX aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
