import { type FoodItem, type FoodProduct } from "@sari/contracts";
import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/api/apiFetch";

import { getFoodProduct, lookupBarcode } from "../api/foodProductsApi";
import type { useFoodItemDraft } from "./useFoodItemDraft";

export function useBarcodeProduct(
  item: FoodItem | null,
  draft: ReturnType<typeof useFoodItemDraft>,
) {
  const [productId, setProductId] = useState(item?.productId ?? null);
  const [barcode, setBarcode] = useState(item?.barcode ?? null);
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [replace, setReplace] = useState<FoodProduct | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (item?.productId) {
      void getFoodProduct(item.productId, controller.signal)
        .then(setProduct)
        .catch(() => {
          if (!controller.signal.aborted) {
            setMessage(
              "Linked product details are unavailable. Your saved values are unchanged; you can remove its link.",
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
    setReplace(null);
    setProduct(null);
    setProductId(null);
    setBarcode(null);
    setMessage("");
  }

  function apply(suggestion: FoodProduct, overwrite: boolean) {
    const conflict = draft.applyProduct(suggestion, overwrite);
    setReplace(conflict && !overwrite ? suggestion : null);
  }

  async function lookup(value: string) {
    if (barcode && barcode !== value) {
      resetSearch();
    } else {
      cancelLookup();
    }
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
          ? "Using previously cached USDA details; a refresh could not be completed. Check the package before saving."
          : "USDA match found. Review the suggested details before saving.",
      );
      apply(result.product, false);
      return true;
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessage(
          error instanceof ApiError && error.code === "INVALID_BARCODE"
            ? "Invalid barcode. Enter the item details manually."
            : error instanceof ApiError && error.code === "PRODUCT_NOT_FOUND"
              ? "Barcode not found. Enter the item details manually."
              : "Could not look up the barcode. Enter the item details manually.",
        );
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

  return {
    productId,
    barcode,
    product,
    loading,
    message,
    replace,
    lookup,
    resetSearch,
    cancelLookup,
    unlink,
    keepValues: () => {
      setReplace(null);
    },
    replaceValues: () => {
      if (replace) {
        apply(replace, true);
      }
    },
  };
}
