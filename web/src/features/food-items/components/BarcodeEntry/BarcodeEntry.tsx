import { barcodeSchema } from "@sari/contracts";
import { useRef, useState } from "react";
import { LuCamera } from "react-icons/lu";

import Input from "@/components/Input/Input";

import BarcodeNumberGuide from "./BarcodeNumberGuide";
import CameraScanner from "./CameraScanner";

interface Props {
  disabled: boolean;
  loading: boolean;
  value: string;
  message: string;
  onLookup: (barcode: string) => void;
  onChange: (value: string) => void;
  onCamera: () => void;
  onManual: () => void;
  onCancel: () => void;
}

export default function BarcodeEntry({
  disabled,
  loading,
  value,
  message,
  onLookup,
  onChange,
  onCamera,
  onManual,
  onCancel,
}: Props) {
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function lookup(input: string) {
    if (loading || disabled) {
      return;
    }
    const result = barcodeSchema.safeParse(input);
    if (!result.success) {
      onChange(input);
      setError("Invalid barcode. Enter the item details manually.");
      return;
    }
    setError("");
    onLookup(result.data);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!camera) {
          lookup(value);
        }
      }}
      aria-busy={loading}
    >
      <fieldset disabled={disabled} className="space-y-5 px-6 pt-6 pb-2">
        {camera ? (
          <CameraScanner
            onDetected={(barcode) => {
              setCamera(false);
              onChange(barcode);
              lookup(barcode);
            }}
            onType={() => {
              setCamera(false);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          />
        ) : (
          <>
            <BarcodeNumberGuide />
            <div>
              <label
                htmlFor="barcode-number"
                className="mb-2 block text-sm font-medium"
              >
                Barcode number
              </label>
              <Input
                data-autofocus
                ref={inputRef}
                id="barcode-number"
                value={value}
                inputMode="numeric"
                autoComplete="off"
                maxLength={14}
                aria-describedby={
                  error || message
                    ? "barcode-hint barcode-error"
                    : "barcode-hint"
                }
                aria-invalid={Boolean(error)}
                onChange={(event) => {
                  setError("");
                  onChange(event.target.value);
                }}
              />
              <p id="barcode-hint" className="mt-2 text-xs text-content-muted">
                Enter all the numbers below the barcode, including those at both
                ends.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onCamera();
                setError("");
                setCamera(true);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-2 py-2 text-sm text-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand"
            >
              <LuCamera aria-hidden="true" className="size-4" />
              Scan with camera
            </button>
            {(error || message) && (
              <p
                id="barcode-error"
                role="alert"
                className="text-sm text-danger"
              >
                {error || message}
              </p>
            )}
          </>
        )}
      </fieldset>
      <div className="flex justify-end px-6 pb-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onManual}
          className="min-h-11 rounded-control px-2 py-2 text-sm text-brand hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Enter details manually
        </button>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border-default bg-surface-subtle/60 px-6 py-4">
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="min-h-11 rounded-control border border-border-default bg-surface px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand"
        >
          Cancel
        </button>
        {!camera && (
          <button
            type="submit"
            disabled={disabled || loading}
            className="min-h-11 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-content-inverse hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand"
          >
            {loading ? "Finding item…" : "Find item"}
          </button>
        )}
      </div>
    </form>
  );
}
