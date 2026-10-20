import type { FoodProduct } from "@sari/contracts";

interface Props {
  product: FoodProduct | null;
  productId: string | null;
  barcode: string | null;
  message: string;
  replacing: boolean;
  onReplace: () => void;
  onKeep: () => void;
  onUnlink: () => void;
}

export default function ProductReview({
  product,
  productId,
  barcode,
  message,
  replacing,
  onReplace,
  onKeep,
  onUnlink,
}: Props) {
  if (!productId) {
    return null;
  }
  const size =
    product?.packageQuantity && product.packageUnit
      ? `${String(product.packageQuantity)} ${product.packageUnit}`
      : null;
  return (
    <section
      aria-label="Matched product"
      className="space-y-2 rounded-control border border-border-default bg-surface-subtle p-3 text-sm"
    >
      {message && (
        <p role="status" className="text-content-muted">
          {message}
        </p>
      )}
      <p className="font-medium">{product?.name ?? "Saved product"}</p>
      {(product?.brand ?? size) && (
        <p className="text-content-muted">
          {[product?.brand, size ? `Listed size: ${size}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {product && !size && (
        <p className="text-content-muted">
          Check the package size and enter the amount you have.
        </p>
      )}
      {replacing && (
        <div className="space-y-2">
          <p>Keep your entries or use the matching product's details.</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onKeep}
              className="min-h-11 text-brand underline focus-visible:outline-2 focus-visible:outline-brand"
            >
              Keep my entries
            </button>
            <button
              type="button"
              onClick={onReplace}
              className="min-h-11 text-brand underline focus-visible:outline-2 focus-visible:outline-brand"
            >
              Replace entered fields
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-3">
        <details className="min-w-0 flex-1 text-xs text-content-muted">
          <summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2 focus-visible:outline-brand">
            More product details
          </summary>
          <div className="space-y-1 pb-2">
            {product && (
              <a
                className="inline-block text-brand underline"
                href={product.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Details from USDA
              </a>
            )}
            {barcode && <p className="break-all">Barcode: {barcode}</p>}
            {product?.packageDescription && (
              <p>Package label: {product.packageDescription}</p>
            )}
            {product && (
              <p>
                Last checked {new Date(product.checkedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </details>
        <button
          type="button"
          onClick={onUnlink}
          className="min-h-11 text-xs text-brand underline focus-visible:outline-2 focus-visible:outline-brand"
        >
          Remove product link
        </button>
      </div>
    </section>
  );
}
