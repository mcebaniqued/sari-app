import type { CreateFoodItem, FoodItem, FoodProduct } from "@sari/contracts";
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

interface FoodItemFormProps {
  item: FoodItem | null;
  disabled: boolean;
  onSave: (values: CreateFoodItem) => Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onAcceptCurrentItem?: (item: FoodItem, useServerValues: boolean) => void;
}

interface FoodItemVersionSummaryProps {
  heading: string;
  values: {
    name: string;
    quantity: number | string;
    unit: string;
    expiresOn: string | null;
    productId: string | null;
    barcode: string | null;
  };
  product: FoodProduct | null;
}

function productLinkDescription(
  productId: string | null,
  barcode: string | null,
  product: FoodProduct | null,
) {
  if (!productId && !barcode) {
    return "Not linked";
  }

  return [
    product?.id === productId ? product.name : null,
    barcode ? `Barcode ${barcode}` : null,
    productId ? `Product ID ${productId}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function FoodItemVersionSummary({
  heading,
  values,
  product,
}: FoodItemVersionSummaryProps) {
  return (
    <section className="space-y-2 rounded-control bg-surface p-3 text-content">
      <h4 className="font-semibold">{heading}</h4>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="font-medium">Name</dt>
        <dd>{values.name}</dd>
        <dt className="font-medium">Quantity</dt>
        <dd>
          {values.quantity} {values.unit}
        </dd>
        <dt className="font-medium">Expires</dt>
        <dd>
          {values.expiresOn === ""
            ? "Not set"
            : (values.expiresOn ?? "Not set")}
        </dd>
        <dt className="font-medium">Product link</dt>
        <dd className="break-all">
          {productLinkDescription(values.productId, values.barcode, product)}
        </dd>
      </dl>
    </section>
  );
}

export default function FoodItemForm({
  item,
  disabled,
  onSave,
  onCancel,
  onDirtyChange,
  onAcceptCurrentItem,
}: FoodItemFormProps) {
  const [mode, setMode] = useState<"manual" | "barcode">("manual");
  const [barcodeValue, setBarcodeValue] = useState("");

  const entryRef = useRef<HTMLDivElement>(null);
  const saveIssueRef = useRef<HTMLElement>(null);
  const recoveryFocus = useRef<"name" | "save" | null>(null);
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
    clearSaveIssue,
  } = useFoodItemForm({
    disabled,
    item,
    onSave,
    values: draft.values,
    ...(linked ? { linkage } : {}),
  });

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

  useEffect(() => {
    if (
      !saving &&
      (error || saveIssue) &&
      !entryRef.current?.closest("dialog")?.contains(document.activeElement)
    ) {
      if (saveIssue) {
        saveIssueRef.current?.focus();
      } else {
        entryRef.current
          ?.querySelector<HTMLButtonElement>('button[type="submit"]')
          ?.focus();
      }
    }
  }, [error, saveIssue, saving]);

  useLayoutEffect(() => {
    if (saveIssue || !recoveryFocus.current) {
      return;
    }

    const selector =
      recoveryFocus.current === "name"
        ? "[data-autofocus]"
        : 'button[type="submit"]';
    entryRef.current?.querySelector<HTMLElement>(selector)?.focus();
    recoveryFocus.current = null;
  }, [saveIssue]);

  function switchMode(next: "manual" | "barcode") {
    barcode.cancelLookup();
    setMode(next);
  }

  function acceptCurrentItem(currentItem: FoodItem, useServerValues: boolean) {
    recoveryFocus.current = useServerValues ? "name" : "save";
    onAcceptCurrentItem?.(currentItem, useServerValues);
    if (useServerValues) {
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
    }
    clearSaveIssue();
  }

  function continueEditing() {
    recoveryFocus.current = "name";
    clearSaveIssue();
  }

  function acceptReviewedItem(useServerValues: boolean) {
    if (saveIssue?.currentItem) {
      acceptCurrentItem(saveIssue.currentItem, useServerValues);
    }
  }

  return (
    <div ref={entryRef} aria-busy={saving}>
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
            {saveIssue && (
              <section
                ref={saveIssueRef}
                role="alert"
                tabIndex={-1}
                aria-labelledby="food-save-issue-title"
                className="space-y-3 rounded-lg border border-danger-border bg-danger-subtle p-3 text-sm text-danger"
              >
                <h3 id="food-save-issue-title" className="font-semibold">
                  {saveIssue.kind === "conflict"
                    ? "A newer version was saved"
                    : saveIssue.kind === "unavailable"
                      ? "This item is no longer available"
                      : "The save outcome is unknown"}
                </h3>
                <p>
                  {saveIssue.kind === "conflict"
                    ? saveIssue.currentItem
                      ? "Your complete draft is still here. Compare it with the newer saved version below. Using your draft will not save immediately, but the next Save changes will replace every newer saved value shown here."
                      : "Your complete draft is still here. Review the newer saved version, or continue editing; revision protection will prevent an accidental overwrite."
                    : saveIssue.kind === "unavailable"
                      ? "The item could not be found or is no longer available to you. Your draft is still here, but it cannot be saved as this item."
                      : saveIssue.currentItem
                        ? "Sari did not repeat the save. The current server version is shown below, but neither matching values nor an unchanged revision proves that the earlier save has finished. If you authorize another save, revision protection will make it conflict if another write finishes first."
                        : "Sari did not repeat the save and could not read the current item. Check the server again before attempting another save."}
                </p>
                {saveIssue.currentItem &&
                  (saveIssue.kind === "conflict" ||
                    saveIssue.kind === "uncertain") && (
                    <div className="space-y-2">
                      <FoodItemVersionSummary
                        heading="Your draft"
                        values={{
                          ...draft.values,
                          ...linkage,
                        }}
                        product={barcode.product}
                      />
                      <FoodItemVersionSummary
                        heading={
                          saveIssue.kind === "conflict"
                            ? "Newer saved version"
                            : "Current server version"
                        }
                        values={{
                          name: saveIssue.currentItem.name,
                          quantity: saveIssue.currentItem.quantity,
                          unit: saveIssue.currentItem.unit,
                          expiresOn: saveIssue.currentItem.expiresOn,
                          productId: saveIssue.currentItem.productId ?? null,
                          barcode: saveIssue.currentItem.barcode ?? null,
                        }}
                        product={barcode.product}
                      />
                    </div>
                  )}
                <div className="flex flex-wrap gap-2">
                  {saveIssue.kind === "conflict" &&
                    (saveIssue.currentItem ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            acceptReviewedItem(true);
                          }}
                          className="min-h-11 rounded-control bg-brand px-3 py-2 font-semibold text-content-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          Use newer saved version
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            acceptReviewedItem(false);
                          }}
                          className="min-h-11 rounded-control border border-border-default bg-surface px-3 py-2 font-medium text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          Overwrite saved version with my draft
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={saveIssue.loading}
                          onClick={() => void reviewLatest()}
                          className="min-h-11 rounded-control bg-brand px-3 py-2 font-semibold text-content-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
                        >
                          {saveIssue.loading
                            ? "Loading newer data…"
                            : "Review newer data"}
                        </button>
                        <button
                          type="button"
                          onClick={continueEditing}
                          className="min-h-11 rounded-control border border-border-default bg-surface px-3 py-2 font-medium text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          Continue editing
                        </button>
                      </>
                    ))}
                  {saveIssue.kind === "uncertain" &&
                    (saveIssue.currentItem ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            acceptReviewedItem(true);
                          }}
                          className="min-h-11 rounded-control bg-brand px-3 py-2 font-semibold text-content-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          Use current server version
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            acceptReviewedItem(false);
                          }}
                          className="min-h-11 rounded-control border border-border-default bg-surface px-3 py-2 font-medium text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          Overwrite saved version with my draft
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={saveIssue.loading}
                        onClick={() => void reviewLatest()}
                        className="min-h-11 rounded-control bg-brand px-3 py-2 font-semibold text-content-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
                      >
                        {saveIssue.loading
                          ? "Checking server…"
                          : "Check server data"}
                      </button>
                    ))}
                </div>
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
          <div className="flex items-center justify-end gap-3 border-t border-border-default bg-surface-subtle/60 px-6 py-4">
            <button
              type="button"
              disabled={disabled || saving}
              onClick={onCancel}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-default bg-surface px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disabled || saving || Boolean(saveIssue)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-content-inverse hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {item ? (
                <LuCheck aria-hidden="true" />
              ) : (
                <LuPlus aria-hidden="true" />
              )}
              {saving ? "Saving…" : item ? "Save changes" : "Add item"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
