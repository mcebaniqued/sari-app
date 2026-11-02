import { type FoodItem, foodItemSchema } from "@sari/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/api/apiFetch";
import { getApiErrorMessage } from "@/utils/apiError";
import { getFoodItem } from "../api/foodItemsApi";

const objectIdPattern = /^[\da-f]{24}$/i;

function newerItem(current: FoodItem | null, incoming: FoodItem) {
  if (!current || incoming.revision > current.revision) {
    return incoming;
  }
  if (
    incoming.revision === current.revision &&
    Date.parse(incoming.updatedAt) >= Date.parse(current.updatedAt)
  ) {
    return incoming;
  }

  return current;
}

interface ItemDetailsOptions {
  verifySeed?: boolean;
}

export function useItemDetails(
  itemId: string,
  seedItem?: FoodItem,
  handleAccessDenied?: (error: unknown) => boolean,
  { verifySeed = true }: ItemDetailsOptions = {},
) {
  const trustedSeed = useMemo(() => {
    if (!seedItem || typeof seedItem.revision !== "number") {
      return null;
    }
    const result = foodItemSchema.safeParse(seedItem);

    return result.success && result.data.id === itemId ? result.data : null;
  }, [itemId, seedItem]);
  const [item, setItem] = useState<FoodItem | null>(trustedSeed);
  const [loading, setLoading] = useState(!trustedSeed);
  const [verifying, setVerifying] = useState(
    Boolean(trustedSeed && verifySeed),
  );
  const [initialError, setInitialError] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const generation = useRef(0);
  const activeItemId = useRef(itemId);
  const valid = objectIdPattern.test(itemId);

  useEffect(() => {
    const requestGeneration = ++generation.current;
    const controller = new AbortController();
    const seed = trustedSeed;
    const itemChanged = activeItemId.current !== itemId;
    activeItemId.current = itemId;

    setItem((current) => (itemChanged ? seed : (current ?? seed)));
    setInitialError("");
    setVerificationError("");
    setUnavailable(false);
    if (!valid) {
      setLoading(false);
      setVerifying(false);

      return () => {
        controller.abort();
      };
    }

    if (seed && !verifySeed) {
      setLoading(false);
      setVerifying(false);

      return () => {
        controller.abort();
      };
    }

    setLoading(!seed);
    setVerifying(Boolean(seed));
    void getFoodItem(itemId, controller.signal)
      .then((verified) => {
        if (
          controller.signal.aborted ||
          requestGeneration !== generation.current
        ) {
          return;
        }
        setItem((current) => newerItem(current, verified));
      })
      .catch((cause: unknown) => {
        if (
          controller.signal.aborted ||
          requestGeneration !== generation.current
        ) {
          return;
        }
        if (cause instanceof ApiError && cause.status === 404) {
          setItem(null);
          setUnavailable(true);

          return;
        }
        if (handleAccessDenied?.(cause)) {
          return;
        }

        const message = getApiErrorMessage(
          cause,
          "Unable to load this item. Please try again.",
        );
        if (seed) {
          setVerificationError(message);
        } else {
          setInitialError(message);
        }
      })
      .finally(() => {
        if (
          controller.signal.aborted ||
          requestGeneration !== generation.current
        ) {
          return;
        }
        setLoading(false);
        setVerifying(false);
      });

    return () => {
      controller.abort();
    };
  }, [
    handleAccessDenied,
    itemId,
    retryVersion,
    trustedSeed,
    valid,
    verifySeed,
  ]);

  return {
    item,
    loading,
    verifying,
    initialError,
    verificationError,
    invalid: !valid,
    unavailable,
    retry: () => {
      setRetryVersion((version) => version + 1);
    },
  };
}
