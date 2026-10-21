import { type FoodItem, type FoodProduct } from "@sari/contracts";
import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/api/apiFetch";

import { getFoodProduct, lookupBarcode } from "../api/foodProductsApi";
import type { useFoodItemDraft } from "./useFoodItemDraft";

function lookupErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === "INVALID_BARCODE") {
    return "Invalid barcode. Enter the item details manually.";
  }

  if (error instanceof ApiError && error.code === "PRODUCT_NOT_FOUND") {
    return "Barcode not found. Enter the item details manually.";
  }

  return "Could not look up the barcode. Enter the item details manually.";
}

/** Only an active lookup may change product links or apply suggestions to the draft. */
export function useBarcodeProduct(
  item: FoodItem | null,
  draft: ReturnType<typeof useFoodItemDraft>,
) {
  const [productId, setProductId] = useState(item?.productId ?? null);
  const [barcode, setBarcode] = useState(item?.barcode ?? null);
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [replacement, setReplacement] = useState<FoodProduct | null>(null);

  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (item?.productId) {
      void getFoodProduct(item.productId, controller.signal)
        .then((product) => {
          if (!controller.signal.aborted) {
            setProduct(product);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setMessage(
              "Product details are unavailable. Your saved entries have been kept.",
            );
          }
        });
    }

    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [item?.productId]);

  function cancelLookup() {
    request.current?.abort();
    request.current = null;
    setLoading(false);
  }

  function resetSearch(keepValues = false) {
    cancelLookup();
    draft.resetSuggestions(keepValues);
    setReplacement(null);
    setProduct(null);
    setProductId(null);
    setBarcode(null);
    setMessage("");
  }

  function apply(suggestion: FoodProduct, overwrite: boolean) {
    const conflict = draft.applyProduct(suggestion, overwrite);
    setReplacement(conflict && !overwrite ? suggestion : null);
  }

  async function lookup(value: string) {
    if (barcode && barcode !== value) {
      resetSearch();
    } else {
      cancelLookup();
    }
    // Aborting the previous request prevents late results from replacing a newer draft.
    const controller = new AbortController();
    request.current = controller;
    setProduct(null);
    setProductId(null);
    setBarcode(value);
    setLoading(true);
    setMessage("");

    try {
      const result = await lookupBarcode(value, controller.signal);
      if (controller.signal.aborted) {
        return false;
      }

      setProduct(result.product);
      setProductId(result.product.id);
      setBarcode(result.product.barcode);
      setMessage(
        result.stale
          ? "Using saved details. Check them against the package."
          : "Item found.",
      );
      apply(result.product, false);

      return true;
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessage(lookupErrorMessage(error));
      }

      return false;
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  function unlink() {
    resetSearch(true);
    setMessage(
      "Product link removed. Your entered item details have been kept.",
    );
  }

  function keepValues() {
    setReplacement(null);
  }

  function replaceValues() {
    if (replacement) {
      apply(replacement, true);
    }
  }

  return {
    productId,
    barcode,
    product,
    loading,
    message,
    replacement,
    lookup,
    resetSearch,
    cancelLookup,
    unlink,
    keepValues,
    replaceValues,
  };
}
