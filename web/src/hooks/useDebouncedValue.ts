import { useEffect, useState } from "react";

/** Publish the latest value once updates have settled for the requested delay. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
