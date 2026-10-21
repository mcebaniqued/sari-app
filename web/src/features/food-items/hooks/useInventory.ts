import type { FoodItem, FoodItemQuery } from "@sari/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notify } from "@/components/Toast/notifications";
import { useAccessDenied } from "@/hooks/useAccessDenied";
import { getApiErrorMessage } from "@/utils/apiError";
import { listFoodItems } from "../api/foodItemsApi";

const INVENTORY_BATCH_SIZE = 20;
export type AppliedQuery = Pick<FoodItemQuery, "search" | "sort" | "filters">;

/** One result set and one selection for both responsive presentations. */
export function useInventory() {
  const [query, setQuery] = useState<AppliedQuery>({
    search: "",
    sort: [],
    filters: {},
  });
  const [items, setItems] = useState<FoodItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [requestVersion, setRequestVersion] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const handleAccessDenied = useAccessDenied();

  const reset = useCallback(() => {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    setItems([]);
    setTotal(null);
    setOffset(0);
    setSelectedIds(new Set());
    setError("");
    setLoading(true);
    setRequestVersion((value) => value + 1);
  }, []);

  const applyQuery = useCallback(
    (next: AppliedQuery) => {
      if (JSON.stringify(next) === JSON.stringify(query)) {
        return;
      }
      setQuery(next);
      reset();
    },
    [query, reset],
  );

  useEffect(() => {
    const controller = new AbortController();
    const requestGeneration = generation.current;
    pending.current = controller;
    // StrictMode replays mount effects. Defer dispatch so its discarded pass
    // cannot send a duplicate initial request.
    queueMicrotask(() => {
      if (controller.signal.aborted) {
        return;
      }
      void listFoodItems(
        { ...query, start: 0, limit: INVENTORY_BATCH_SIZE },
        controller.signal,
      )
        .then((response) => {
          if (
            controller.signal.aborted ||
            requestGeneration !== generation.current
          ) {
            return;
          }
          setItems([
            ...new Map(response.items.map((item) => [item.id, item])).values(),
          ]);
          setOffset(response.items.length || response.total);
          setTotal(response.total);
        })
        .catch((cause: unknown) => {
          if (
            controller.signal.aborted ||
            requestGeneration !== generation.current
          ) {
            return;
          }
          if (!handleAccessDenied(cause)) {
            const message = getApiErrorMessage(
              cause,
              "Unable to load items. Please try again.",
            );
            setError(message);
            notify("error", message, "pantry-load-error");
          }
        })
        .finally(() => {
          if (pending.current === controller) {
            pending.current = null;
          }
          if (requestGeneration === generation.current) {
            setLoading(false);
          }
        });
    });

    return () => {
      controller.abort();
    };
  }, [query, requestVersion, handleAccessDenied]);

  const loadMore = useCallback(
    async (retryFailed = false) => {
      if (
        pending.current ||
        (!retryFailed && error) ||
        total === null ||
        offset >= total
      ) {
        return;
      }

      const controller = new AbortController();
      const requestGeneration = generation.current;
      pending.current = controller;
      setLoading(true);
      setError("");
      try {
        const response = await listFoodItems(
          { ...query, start: offset, limit: INVENTORY_BATCH_SIZE },
          controller.signal,
        );
        if (
          controller.signal.aborted ||
          requestGeneration !== generation.current
        ) {
          return;
        }
        setItems((previous) => {
          const seen = new Set(previous.map((item) => item.id));
          return [
            ...previous,
            ...response.items.filter((item) => {
              if (seen.has(item.id)) {
                return false;
              }
              seen.add(item.id);
              return true;
            }),
          ];
        });
        setOffset(
          response.items.length
            ? offset + response.items.length
            : response.total,
        );
        setTotal(response.total);
      } catch (cause) {
        if (
          controller.signal.aborted ||
          requestGeneration !== generation.current
        ) {
          return;
        }
        if (!handleAccessDenied(cause)) {
          const message = getApiErrorMessage(
            cause,
            "Unable to load items. Please try again.",
          );
          setError(message);
          notify("error", message, "pantry-load-error");
        }
      } finally {
        if (pending.current === controller) {
          pending.current = null;
        }
        if (requestGeneration === generation.current) {
          setLoading(false);
        }
      }
    },
    [error, handleAccessDenied, offset, query, total],
  );

  const selected = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  return {
    query,
    applyQuery,
    invalidate: reset,
    items,
    total,
    loading,
    error,
    hasMore: total !== null && offset < total,
    loadMore,
    retryLoad: () => {
      if (items.length) {
        void loadMore(true);
      } else {
        reset();
      }
    },
    selected,
    selectedIds,
    setSelectedIds,
    clearSelection: () => {
      setSelectedIds(new Set());
    },
  };
}
