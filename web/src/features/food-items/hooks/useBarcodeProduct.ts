import { type FoodItem, type FoodProduct } from "@sari/contracts";
import {
  type ChangeEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import { ApiError } from "@/api/apiFetch";

import { getFoodProduct, lookupBarcode } from "../api/foodProductsApi";

export function useBarcodeProduct(
  item: FoodItem | null,
  formRef: RefObject<HTMLFormElement | null>,
) {
  const [productId, setProductId] = useState(item?.productId ?? null);
  const [barcode, setBarcode] = useState(item?.barcode ?? null);
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [replace, setReplace] = useState<FoodProduct | null>(null);
  const dirty = useRef(new Set<string>());
  const automatic = useRef(new Map<string, string>());
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
    setReplace(null);
  }

  function resetSearch(keepValues = false) {
    cancelLookup();
    for (const [name, value] of automatic.current) {
      const field = formRef.current?.elements.namedItem(name);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement
      ) {
        if (keepValues) {
          dirty.current.add(name);
        } else if (
          !dirty.current.has(name) &&
          field.value === value &&
          !(
            (name === "quantity" || name === "unit") &&
            (dirty.current.has("quantity") || dirty.current.has("unit"))
          )
        ) {
          field.value =
            name === "quantity" ? "1" : name === "unit" ? "item" : "";
        }
      }
    }
    automatic.current.clear();
    setProduct(null);
    setProductId(null);
    setBarcode(null);
    setMessage("");
  }

  function apply(suggestion: FoodProduct, overwrite: boolean) {
    const proposals = {
      name: suggestion.name,
      quantity: suggestion.packageQuantity?.toString(),
      unit: suggestion.packageUnit ?? undefined,
    };
    let conflict = false;
    for (const [name, value] of Object.entries(proposals)) {
      if (!value) {
        continue;
      }
      const field = formRef.current?.elements.namedItem(name);
      if (!(
        field instanceof HTMLInputElement || field instanceof HTMLSelectElement
      )) {
        continue;
      }
      const amountEdited =
        (name === "quantity" || name === "unit") &&
        (dirty.current.has("quantity") || dirty.current.has("unit"));
      if (
        overwrite ||
        (!amountEdited &&
          (!field.value.trim() || (!item && !dirty.current.has(name))))
      ) {
        field.value = value;
        automatic.current.set(name, value);
      } else if (field.value !== value) {
        conflict = true;
      }
    }
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
        return;
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
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  function onFormChange(event: ChangeEvent<HTMLFormElement>) {
    const field = event.target;
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement
    ) {
      dirty.current.add(field.name);
    }
  }

  function unlink() {
    resetSearch(true);
    setOpen(false);
    setMessage(
      "Product link removed. Your entered item details have been kept.",
    );
  }

  return {
    productId,
    barcode,
    product,
    open,
    setOpen,
    loading,
    message,
    replace,
    lookup,
    resetSearch,
    cancelLookup,
    onFormChange,
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
