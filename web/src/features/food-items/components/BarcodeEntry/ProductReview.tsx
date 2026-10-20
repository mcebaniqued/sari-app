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
  return (
    <div className="space-y-2 text-sm">
      {message && (
        <p role="status" className="text-content-muted">
          {message}
        </p>
      )}
      {productId && (
        <div className="space-y-2 rounded-control border border-border-default bg-surface-subtle p-3">
          <p className="font-medium">
            Linked product: {product?.name ?? "USDA product"}
          </p>
          {product?.brand && <p>{product.brand}</p>}
          {product && (
            <p>
              Package:{" "}
              {product.packageDescription ??
                "Size unavailable — enter quantity manually"}
            </p>
          )}
          {barcode && (
            <p className="break-all text-content-muted">Barcode: {barcode}</p>
          )}
          {product && (
            <p className="text-content-muted">
              Source:{" "}
              <a
                className="text-brand underline"
                href={product.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                USDA FoodData Central
              </a>{" "}
              · Last checked {new Date(product.checkedAt).toLocaleDateString()}
            </p>
          )}
          {replacing && (
            <div className="space-y-2">
              <p>
                Some fields already contain your entries. Keep them or replace
                them with the available USDA suggestions.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onKeep}
                  className="text-brand underline"
                >
                  Keep my entries
                </button>
                <button
                  type="button"
                  onClick={onReplace}
                  className="text-brand underline"
                >
                  Replace entered fields
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onUnlink}
            className="text-brand underline"
          >
            Remove product link
          </button>
        </div>
      )}
    </div>
  );
}
