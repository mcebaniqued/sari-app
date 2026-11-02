import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBarcodeProduct } from "./useBarcodeProduct";
import { normalizedFoodItemEdit, useFoodItemDraft } from "./useFoodItemDraft";
import { useFoodItemForm } from "./useFoodItemForm";

type FoodItemRecoveryState =
  | "editing"
  | "conflict-notice"
  | "uncertain-notice"
  | "review-conflict"
  | "review-uncertain"
  | "unavailable";

interface FoodItemEditorSessionOptions {
  disabled: boolean;
  item: FoodItem | null;
  onSave: (
    values: CreateFoodItem,
    expectedRevision: number | null,
  ) => Promise<void>;
}

export function useFoodItemEditorSession({
  disabled,
  item,
  onSave,
}: FoodItemEditorSessionOptions) {
  const [mode, setMode] = useState<"manual" | "barcode">("manual");
  const [barcodeValue, setBarcodeValue] = useState("");
  const entryRef = useRef<HTMLDivElement>(null);
  const noticeHeadingRef = useRef<HTMLHeadingElement>(null);
  const readErrorRef = useRef<HTMLParagraphElement>(null);
  const recoveryFocusRef = useRef<"save" | "review" | null>(null);
  const draft = useFoodItemDraft(item);
  const barcode = useBarcodeProduct(item, draft);
  const linked =
    barcode.productId !== null ||
    barcode.barcode !== null ||
    Boolean(item?.productId ?? item?.barcode);
  const linkage = useMemo(
    () => ({ productId: barcode.productId, barcode: barcode.barcode }),
    [barcode.barcode, barcode.productId],
  );
  const draftVersion = useMemo(
    () => ({ ...draft.values, ...linkage }),
    [draft.values, linkage],
  );
  const [initialEdit] = useState(() =>
    item
      ? normalizedFoodItemEdit(
          {
            name: item.name,
            quantity: String(item.quantity),
            unit: item.unit,
            expiresOn: item.expiresOn ?? "",
          },
          {
            productId: item.productId ?? null,
            barcode: item.barcode ?? null,
          },
        )
      : null,
  );
  const form = useFoodItemForm({
    disabled,
    item,
    onSave,
    values: draft.values,
    ...(linked ? { linkage } : {}),
  });
  const recoveryState: FoodItemRecoveryState = form.saveIssue
    ? form.saveIssue.kind === "unavailable"
      ? "unavailable"
      : form.saveIssue.phase === "review"
        ? form.saveIssue.kind === "conflict"
          ? "review-conflict"
          : "review-uncertain"
        : form.saveIssue.kind === "conflict"
          ? "conflict-notice"
          : "uncertain-notice"
    : "editing";
  const dirty = Boolean(
    initialEdit &&
    JSON.stringify(normalizedFoodItemEdit(draft.values, linkage)) !==
      JSON.stringify(initialEdit),
  );

  useLayoutEffect(() => {
    if (form.saveIssue?.phase === "notice" && !form.saveIssue.loading) {
      if (recoveryFocusRef.current === "review") {
        const frame = requestAnimationFrame(() => {
          entryRef.current
            ?.querySelector<HTMLElement>('[data-recovery-action="review"]')
            ?.focus();
          recoveryFocusRef.current = null;
        });

        return () => {
          cancelAnimationFrame(frame);
        };
      } else if (form.saveIssue.readError) {
        readErrorRef.current?.focus();
      } else {
        noticeHeadingRef.current?.focus();
      }
      recoveryFocusRef.current = null;
    }
  }, [form.saveIssue]);

  useLayoutEffect(() => {
    if (form.saveIssue || !recoveryFocusRef.current) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      entryRef.current
        ?.querySelector<HTMLElement>('button[type="submit"]')
        ?.focus();
      recoveryFocusRef.current = null;
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [form.saveIssue]);

  function switchMode(next: "manual" | "barcode") {
    barcode.cancelLookup();
    setMode(next);
  }

  function returnToNotice() {
    recoveryFocusRef.current = "review";
    form.backToNotice();
  }

  return {
    barcode,
    barcodeValue,
    dirty,
    draft,
    draftVersion,
    entryRef,
    form,
    item,
    linkage,
    linked,
    mode,
    noticeHeadingRef,
    readErrorRef,
    recoveryFocusRef,
    recoveryState,
    returnToNotice,
    setBarcodeValue,
    switchMode,
  };
}

export type FoodItemEditorSession = ReturnType<typeof useFoodItemEditorSession>;
