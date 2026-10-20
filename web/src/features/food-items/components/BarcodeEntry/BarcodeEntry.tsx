import { barcodeSchema } from "@sari/contracts";
import { useRef, useState } from "react";

import Input from "@/components/Input/Input";

import BarcodeNumberGuide from "./BarcodeNumberGuide";
import CameraScanner from "./CameraScanner";

interface Props {
  loading: boolean;
  onLookup: (barcode: string) => void;
  onChange: () => void;
  onCamera: () => void;
  onClose: () => void;
}

export default function BarcodeEntry({
  loading,
  onLookup,
  onChange,
  onCamera,
  onClose,
}: Props) {
  const [camera, setCamera] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function lookup(input: string) {
    const result = barcodeSchema.safeParse(input);
    if (!result.success) {
      onChange();
      setError("Invalid barcode. Enter the item details manually.");
      return;
    }
    setError("");
    onLookup(result.data);
  }

  return (
    <div className="space-y-3 rounded-control border border-border-default bg-surface-subtle p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Find product by barcode</span>
        <button type="button" onClick={onClose} className="text-sm text-brand">
          Close barcode input
        </button>
      </div>
      {camera ? (
        <CameraScanner
          onDetected={(barcode) => {
            setCamera(false);
            setValue(barcode);
            lookup(barcode);
          }}
          onType={() => {
            setCamera(false);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            onCamera();
            setCamera(true);
          }}
          className="rounded-control border border-border-default bg-surface px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand"
        >
          Use camera
        </button>
      )}
      {!camera && <BarcodeNumberGuide />}
      <div>
        <label
          htmlFor="barcode-number"
          className="mb-2 block text-sm font-medium"
        >
          Barcode number
        </label>
        <Input
          ref={inputRef}
          id="barcode-number"
          value={value}
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          aria-describedby="barcode-hint"
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
            onChange();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setCamera(false);
              lookup(value);
            }
          }}
        />
        <p id="barcode-hint" className="mt-1 text-xs text-content-muted">
          Enter all the numbers below the barcode, including those at both ends.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setCamera(false);
          lookup(value);
        }}
        className="rounded-control bg-brand px-3 py-2 text-sm font-medium text-content-inverse disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand"
      >
        {loading ? "Looking up…" : "Look up barcode"}
      </button>
    </div>
  );
}
