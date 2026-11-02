import type { FoodItem } from "@sari/contracts";
import { useEffect } from "react";
import { LuCheck, LuInfo, LuPlus } from "react-icons/lu";
import type { FoodItemEditorSession } from "../../hooks/useFoodItemEditorSession";
import BarcodeEntry from "../BarcodeEntry/BarcodeEntry";
import ProductReview from "../BarcodeEntry/ProductReview";
import FoodItemFields from "./FoodItemFields";
import {
  FoodItemRecoveryView,
  FoodItemUnavailableView,
} from "./FoodItemRecoveryView";

interface FoodItemFormProps {
  disabled: boolean;
  onCancel: () => void;
  onDiscardAndClose?: () => void;
  onKeepSavedAndClose: (item: FoodItem) => void;
  session: FoodItemEditorSession;
}

const footerButton =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border-default bg-surface px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto";
const primaryFooterButton =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-content-inverse hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto";

export default function FoodItemForm({
  disabled,
  onCancel,
  onDiscardAndClose,
  onKeepSavedAndClose,
  session,
}: FoodItemFormProps) {
  const {
    barcode,
    barcodeValue,
    draft,
    draftVersion,
    entryRef,
    form: {
      error,
      handleSubmit,
      overwriteReviewed,
      reviewLatest,
      saveIssue,
      saving,
    },
    item,
    mode,
    noticeHeadingRef,
    readErrorRef,
    recoveryFocusRef,
    returnToNotice,
    setBarcodeValue,
    switchMode,
  } = session;

  useEffect(() => {
    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body &&
      document.activeElement.isConnected
    ) {
      return;
    }
    entryRef.current
      ?.querySelector<HTMLInputElement>("[data-autofocus]")
      ?.focus();
  }, [entryRef, mode]);

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
          pending={saving || disabled}
          onBack={returnToNotice}
          onKeepSaved={() => {
            onKeepSavedAndClose(reviewedItem);
          }}
          onOverwrite={() => {
            recoveryFocusRef.current = "save";
            void overwriteReviewed();
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
                switchMode("manual");
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
                className="space-y-2 rounded-lg border border-info-border border-l-4 bg-info-subtle p-4 text-sm text-content"
              >
                <h3
                  ref={noticeHeadingRef}
                  id="food-save-issue-title"
                  tabIndex={-1}
                  className="flex items-center gap-2 rounded-control font-semibold text-info focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <LuInfo aria-hidden="true" className="size-5 shrink-0" />
                  {notice.kind === "conflict"
                    ? "A newer version is available"
                    : "We couldn't confirm your save"}
                </h3>
                <p className="leading-relaxed text-content-muted">
                  {notice.kind === "conflict"
                    ? "This item changed elsewhere. Your edits are still here but haven't been saved."
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
              data-editor-focus="cancel"
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
                {saving ? "Saving…" : item ? "Save changes" : "Add item"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
