import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LuCheck, LuPlus } from "react-icons/lu";
import { useBarcodeProduct } from "../../hooks/useBarcodeProduct";
import {
  normalizedFoodItemEdit,
  useFoodItemDraft,
} from "../../hooks/useFoodItemDraft";
import { useFoodItemForm } from "../../hooks/useFoodItemForm";
import BarcodeEntry from "../BarcodeEntry/BarcodeEntry";
import ProductReview from "../BarcodeEntry/ProductReview";
import FoodItemFields from "./FoodItemFields";
import {
  FoodItemRecoveryView,
  FoodItemUnavailableView,
} from "./FoodItemRecoveryView";

export type FoodItemRecoveryState =
  | "editing"
  | "conflict-notice"
  | "uncertain-notice"
  | "review-conflict"
  | "review-uncertain"
  | "unavailable"
  | "authorized";

interface FoodItemFormProps {
  item: FoodItem | null;
  disabled: boolean;
  onSave: (values: CreateFoodItem) => Promise<void>;
  onCancel: () => void;
  onDiscardAndClose?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRecoveryStateChange?: (state: FoodItemRecoveryState) => void;
  onAcceptCurrentItem?: (item: FoodItem, useServerValues: boolean) => void;
}

const footerButton =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border-default bg-surface px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto";
const primaryFooterButton =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-content-inverse hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto";

export default function FoodItemForm({
  item,
  disabled,
  onSave,
  onCancel,
  onDiscardAndClose,
  onDirtyChange,
  onRecoveryStateChange,
  onAcceptCurrentItem,
}: FoodItemFormProps) {
  const [mode, setMode] = useState<"manual" | "barcode">("manual");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [overwriteAuthorized, setOverwriteAuthorized] = useState(false);
  const entryRef = useRef<HTMLDivElement>(null);
  const noticeHeadingRef = useRef<HTMLHeadingElement>(null);
  const readErrorRef = useRef<HTMLParagraphElement>(null);
  const recoveryFocus = useRef<"name" | "save" | "review" | null>(null);
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
  const initialEdit = useRef(
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
  const {
    saving,
    error,
    saveIssue,
    handleSubmit,
    reviewLatest,
    backToNotice,
    clearSaveIssue,
  } = useFoodItemForm({
    disabled,
    item,
    onSave,
    values: draft.values,
    ...(linked ? { linkage } : {}),
  });

  const recoveryState: FoodItemRecoveryState = saveIssue
    ? saveIssue.kind === "unavailable"
      ? "unavailable"
      : saveIssue.phase === "review"
        ? saveIssue.kind === "conflict"
          ? "review-conflict"
          : "review-uncertain"
        : saveIssue.kind === "conflict"
          ? "conflict-notice"
          : "uncertain-notice"
    : overwriteAuthorized
      ? "authorized"
      : "editing";

  useEffect(() => {
    onRecoveryStateChange?.(recoveryState);
  }, [onRecoveryStateChange, recoveryState]);

  useEffect(() => {
    if (!item || !initialEdit.current) {
      onDirtyChange?.(false);
      return;
    }

    const current = normalizedFoodItemEdit(draft.values, linkage);
    onDirtyChange?.(
      JSON.stringify(current) !== JSON.stringify(initialEdit.current),
    );
  }, [draft.values, item, linkage, onDirtyChange]);

  useEffect(() => {
    entryRef.current
      ?.querySelector<HTMLInputElement>("[data-autofocus]")
      ?.focus();
  }, [mode]);

  useLayoutEffect(() => {
    if (saveIssue?.phase === "notice" && !saveIssue.loading) {
      if (recoveryFocus.current === "review") {
        const frame = requestAnimationFrame(() => {
          entryRef.current
            ?.querySelector<HTMLElement>('[data-recovery-action="review"]')
            ?.focus();
          recoveryFocus.current = null;
        });

        return () => {
          cancelAnimationFrame(frame);
        };
      } else if (saveIssue.readError) {
        readErrorRef.current?.focus();
      } else {
        noticeHeadingRef.current?.focus();
      }
    }
  }, [saveIssue]);

  useLayoutEffect(() => {
    if (saveIssue || !recoveryFocus.current) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const selector =
        recoveryFocus.current === "name"
          ? "[data-autofocus]"
          : 'button[type="submit"]';
      entryRef.current?.querySelector<HTMLElement>(selector)?.focus();
      recoveryFocus.current = null;
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [saveIssue]);

  function switchMode(next: "manual" | "barcode") {
    barcode.cancelLookup();
    setMode(next);
  }

  function adoptSavedVersion(currentItem: FoodItem) {
    recoveryFocus.current = "name";
    setOverwriteAuthorized(false);
    onAcceptCurrentItem?.(currentItem, true);
    draft.replaceWithItem(currentItem);
    barcode.replaceWithItem(currentItem);
    initialEdit.current = normalizedFoodItemEdit(
      {
        name: currentItem.name,
        quantity: String(currentItem.quantity),
        unit: currentItem.unit,
        expiresOn: currentItem.expiresOn ?? "",
      },
      {
        productId: currentItem.productId ?? null,
        barcode: currentItem.barcode ?? null,
      },
    );
    clearSaveIssue();
  }

  function keepDraft(currentItem: FoodItem) {
    recoveryFocus.current = "save";
    onAcceptCurrentItem?.(currentItem, false);
    setOverwriteAuthorized(true);
    clearSaveIssue();
  }

  function returnToNotice() {
    recoveryFocus.current = "review";
    backToNotice();
  }

  if (saveIssue?.kind === "unavailable") {
    return (
      <div ref={entryRef}>
        <FoodItemUnavailableView
          draft={draftVersion}
          product={barcode.product}
          onDiscard={onDiscardAndClose ?? onCancel}
        />
      </div>
    );
  }

  if (saveIssue?.phase === "review" && saveIssue.currentItem) {
    const reviewedItem = saveIssue.currentItem;

    return (
      <div ref={entryRef}>
        <FoodItemRecoveryView
          kind={saveIssue.kind}
          draft={draftVersion}
          saved={reviewedItem}
          product={barcode.product}
          onBack={returnToNotice}
          onUseSaved={() => {
            adoptSavedVersion(reviewedItem);
          }}
          onKeepDraft={() => {
            keepDraft(reviewedItem);
          }}
        />
      </div>
    );
  }

  const notice = saveIssue?.phase === "notice" ? saveIssue : null;
  const reviewLabel = notice?.readError
    ? "Try again"
    : notice?.kind === "conflict"
      ? "Review changes"
      : "Check saved version";

  return (
    <div ref={entryRef} aria-busy={saving || Boolean(notice?.loading)}>
      {mode === "barcode" ? (
        <BarcodeEntry
          disabled={disabled}
          loading={barcode.loading}
          value={barcodeValue}
          message={barcode.productId ? "" : barcode.message}
          onLookup={(value) => {
            void barcode.lookup(value).then((found) => {
              if (found) {
                setMode("manual");
              }
            });
          }}
          onChange={(value) => {
            setBarcodeValue(value);
            barcode.resetSearch();
          }}
          onCamera={barcode.cancelLookup}
          onManual={() => {
            switchMode("manual");
          }}
          onCancel={onCancel}
        />
      ) : (
        <form
          onSubmit={(event) => {
            barcode.cancelLookup();
            void handleSubmit(event);
          }}
        >
          <fieldset
            disabled={disabled || saving}
            className={`space-y-5 px-6 pt-6 ${item ? "pb-6" : "pb-2"}`}
          >
            <ProductReview
              product={barcode.product}
              productId={barcode.productId}
              barcode={barcode.barcode}
              message={barcode.productId ? barcode.message : ""}
              replacing={Boolean(barcode.replacement)}
              onReplace={barcode.replaceValues}
              onKeep={barcode.keepValues}
              onUnlink={barcode.unlink}
            />
            <FoodItemFields values={draft.values} onChange={draft.edit} />
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-danger-subtle p-3 text-sm text-danger"
              >
                {error} Your entries have been kept.
              </p>
            )}
            {notice && (
              <section
                aria-labelledby="food-save-issue-title"
                className="space-y-2 rounded-lg border border-border-default bg-surface-subtle p-4 text-sm text-content"
              >
                <h3
                  ref={noticeHeadingRef}
                  id="food-save-issue-title"
                  tabIndex={-1}
                  className="rounded-control font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {notice.kind === "conflict"
                    ? "A newer version is available"
                    : "We couldn't confirm your save"}
                </h3>
                <p className="leading-relaxed text-content-muted">
                  {notice.kind === "conflict"
                    ? "This item changed while you were editing. Your changes haven't been saved. Review the differences before saving."
                    : "Your changes may have been saved. Check the saved version before trying again."}
                </p>
                {notice.readError && (
                  <p
                    ref={readErrorRef}
                    role="status"
                    tabIndex={-1}
                    className="rounded-control text-content-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    The saved version could not be loaded. Your draft is still
                    here. Try again when the item is available.
                  </p>
                )}
              </section>
            )}
            {overwriteAuthorized && (
              <section
                role="status"
                className="rounded-lg border border-border-default bg-surface-subtle p-4 text-sm leading-relaxed text-content"
              >
                Your draft is ready to replace the saved version you reviewed.
                Choose Save and replace to submit it with revision protection.
              </section>
            )}
          </fieldset>
          {!item && (
            <div className="flex justify-end px-6 pb-3">
              <button
                type="button"
                disabled={disabled || saving}
                onClick={() => {
                  switchMode("barcode");
                }}
                className="min-h-11 rounded-control px-2 py-2 text-sm text-brand underline-offset-4 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Input barcode instead
              </button>
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 border-t border-border-default bg-surface-subtle/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              disabled={disabled || saving || Boolean(notice?.loading)}
              onClick={onCancel}
              className={footerButton}
            >
              Cancel
            </button>
            {notice ? (
              <button
                type="button"
                data-recovery-action="review"
                disabled={disabled || saving || notice.loading}
                onClick={() => void reviewLatest()}
                className={primaryFooterButton}
              >
                {notice.loading ? "Checking saved version…" : reviewLabel}
              </button>
            ) : (
              <button
                type="submit"
                disabled={disabled || saving}
                className={primaryFooterButton}
              >
                {item ? (
                  <LuCheck aria-hidden="true" />
                ) : (
                  <LuPlus aria-hidden="true" />
                )}
                {saving
                  ? "Saving…"
                  : overwriteAuthorized
                    ? "Save and replace"
                    : item
                      ? "Save changes"
                      : "Add item"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
