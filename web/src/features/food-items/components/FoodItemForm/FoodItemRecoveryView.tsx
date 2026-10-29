import type { FoodItem, FoodProduct } from "@sari/contracts";
import { useState } from "react";
import {
  type FoodItemDraft,
  normalizedFoodItemEdit,
} from "../../hooks/useFoodItemDraft";

interface DraftVersion extends FoodItemDraft {
  productId: string | null;
  barcode: string | null;
}

interface RecoveryViewProps {
  kind: "conflict" | "uncertain";
  draft: DraftVersion;
  saved: FoodItem;
  product: FoodProduct | null;
  onBack: () => void;
  onUseSaved: () => void;
  onKeepDraft: () => void;
}

interface UnavailableViewProps {
  draft: DraftVersion;
  product: FoodProduct | null;
  onDiscard: () => void;
}

interface PersistedVersion {
  name: string;
  quantity: number | string;
  unit: string;
  expiresOn: string | null;
  productId?: string | null;
  barcode?: string | null;
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

function persistedValues(
  values: PersistedVersion,
  product: FoodProduct | null,
) {
  const expiresOn = values.expiresOn ?? "";

  return [
    { label: "Name", value: values.name.trim() },
    { label: "Quantity", value: String(values.quantity) },
    { label: "Unit", value: values.unit },
    {
      label: "Expiration date",
      value: expiresOn === "" ? "Not set" : expiresOn,
    },
    {
      label: "Product link",
      value: productLinkDescription(
        values.productId ?? null,
        values.barcode ?? null,
        product,
      ),
    },
  ];
}

function normalizedVersion(values: DraftVersion | FoodItem) {
  return normalizedFoodItemEdit(
    {
      name: values.name,
      quantity: String(values.quantity),
      unit: values.unit,
      expiresOn: values.expiresOn ?? "",
    },
    {
      productId: values.productId ?? null,
      barcode: values.barcode ?? null,
    },
  );
}

function comparisonRows(
  draft: DraftVersion,
  saved: FoodItem,
  product: FoodProduct | null,
) {
  const local = persistedValues(normalizedVersion(draft), product);
  const server = persistedValues(normalizedVersion(saved), product);

  return local
    .map((entry, index) => ({
      label: entry.label,
      draft: entry.value,
      saved: server[index]?.value ?? "",
    }))
    .filter((entry) => entry.draft !== entry.saved);
}

const secondaryButton =
  "inline-flex min-h-11 w-full items-center justify-center rounded-control border border-border-default bg-surface px-4 py-2.5 text-sm font-semibold text-content hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto sm:flex-1";
const primaryButton =
  "inline-flex min-h-11 w-full items-center justify-center rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-content-inverse hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto sm:flex-1";

export function FoodItemRecoveryView({
  kind,
  draft,
  saved,
  product,
  onBack,
  onUseSaved,
  onKeepDraft,
}: RecoveryViewProps) {
  const rows = comparisonRows(draft, saved, product);

  return (
    <div className="space-y-6 px-6 py-6">
      <p className="text-sm leading-relaxed text-content-muted">
        {kind === "conflict"
          ? "Compare your unsaved draft with the newer saved version."
          : "Compare your draft with the version Sari can currently read. Matching values do not confirm whether the earlier save finished."}
      </p>
      {rows.length ? (
        <>
          <table className="hidden w-full table-fixed border-separate border-spacing-0 text-left text-sm sm:table">
            <thead>
              <tr>
                <th className="w-1/4 border-b border-border-default p-3 font-semibold">
                  Field
                </th>
                <th className="w-3/8 border-b border-border-default p-3 font-semibold">
                  Your draft
                </th>
                <th className="w-3/8 border-b border-border-default p-3 font-semibold">
                  Saved version
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th className="border-b border-border-default p-3 align-top font-medium">
                    {row.label}
                  </th>
                  <td className="wrap-anywhere border-b border-border-default p-3 align-top">
                    {row.draft}
                  </td>
                  <td className="wrap-anywhere border-b border-border-default p-3 align-top">
                    {row.saved}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="space-y-4 sm:hidden">
            {rows.map((row) => (
              <div
                key={row.label}
                className="rounded-control border border-border-default p-4"
              >
                <dt className="font-semibold">{row.label}</dt>
                <dd className="mt-3 grid gap-3 text-sm">
                  <div>
                    <span className="block font-medium text-content-muted">
                      Your draft
                    </span>
                    <span className="wrap-anywhere">{row.draft}</span>
                  </div>
                  <div>
                    <span className="block font-medium text-content-muted">
                      Saved version
                    </span>
                    <span className="wrap-anywhere">{row.saved}</span>
                  </div>
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="rounded-control bg-surface-subtle p-4 text-sm">
          No differences were found between your draft and the saved version.
        </p>
      )}
      <p className="text-sm leading-relaxed text-content-muted">
        Keeping your draft authorizes its complete submitted values to replace
        the saved version when you choose Save and replace. Nothing is saved
        from this review.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className={secondaryButton}>
          Back to editing
        </button>
        <button type="button" onClick={onUseSaved} className={primaryButton}>
          Use saved version
        </button>
        <button type="button" onClick={onKeepDraft} className={primaryButton}>
          Keep my draft
        </button>
      </div>
    </div>
  );
}

export function FoodItemUnavailableView({
  draft,
  product,
  onDiscard,
}: UnavailableViewProps) {
  const [copyStatus, setCopyStatus] = useState("");
  const details = persistedValues(draft, product);
  const copyText = details
    .map(({ label, value }) => `${label}: ${value}`)
    .join("\n");

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopyStatus("Details copied");
    } catch {
      setCopyStatus(
        "Copy failed. Select the text in the manual-copy field and copy it manually.",
      );
    }
  }

  return (
    <div className="space-y-6 px-6 py-6">
      <p className="text-sm leading-relaxed text-content-muted">
        This item was removed or is no longer accessible. Your draft cannot be
        saved as this pantry item.
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-control border border-border-default p-4 text-sm">
        {details.map(({ label, value }) => (
          <div key={label} className="contents">
            <dt className="font-semibold">{label}</dt>
            <dd className="wrap-anywhere">{value}</dd>
          </div>
        ))}
      </dl>
      {copyStatus.startsWith("Copy failed") && (
        <textarea
          readOnly
          aria-label="Draft details for manual copying"
          value={copyText}
          className="min-h-40 w-full rounded-control border border-border-control bg-surface p-3 text-sm"
          onFocus={(event) => {
            event.currentTarget.select();
          }}
        />
      )}
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-content-muted"
      >
        {copyStatus}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => void copyDetails()}
          className={secondaryButton}
        >
          Copy details
        </button>
        <button type="button" onClick={onDiscard} className={primaryButton}>
          Discard and close
        </button>
      </div>
    </div>
  );
}
