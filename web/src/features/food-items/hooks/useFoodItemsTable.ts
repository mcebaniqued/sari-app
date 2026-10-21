import type { FoodItem } from "@sari/contracts";
import type { AgGridReact } from "ag-grid-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { notify } from "@/components/Toast/notifications";
import { useAccessDenied } from "@/hooks/useAccessDenied";
import { getApiErrorMessage } from "@/utils/apiError";

import { createFoodItemsDatasource } from "../utils/createFoodItemsDatasource";

export function useFoodItemsTable(revision: number) {
  const gridRef = useRef<AgGridReact<FoodItem>>(null);
  const handleAccessDenied = useAccessDenied();
  const [selected, setSelected] = useState<FoodItem[]>([]);
  const [filtered, setFiltered] = useState(false);
  const [search, setSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState<number | null>(null);

  const onError = useCallback(
    (cause: unknown) => {
      if (handleAccessDenied(cause)) {
        return;
      }

      const message = getApiErrorMessage(
        cause,
        "Unable to load items. Please try again.",
      );
      notify("error", message, "pantry-load-error");
      setError(message);
    },
    [handleAccessDenied],
  );

  // Rebuilding resets paging and cancels obsolete requests after edits or retries.
  const datasource = useMemo(
    () =>
      createFoodItemsDatasource(
        { search, revision, retry },
        { setLoading, setError, setTotal, onError },
      ),
    [search, revision, retry, onError],
  );

  const retryLoad = useCallback(() => {
    setRetry((value) => value + 1);
  }, []);

  return {
    gridRef,
    selected,
    filtered,
    hasQuery: Boolean(search) || filtered,
    setSelected,
    setFiltered,
    setSearch,
    error,
    loading,
    total,
    datasource,
    retryLoad,
  };
}
