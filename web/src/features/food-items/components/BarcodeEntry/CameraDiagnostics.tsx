import { LuChevronDown } from "react-icons/lu";
import {
  type CameraOption,
  type CameraZoomControl,
  type CaptureStrategy,
  captureStrategyLabels,
} from "./cameraExperiment";

interface Props {
  cameras: CameraOption[];
  selectedDeviceId: string;
  strategy: CaptureStrategy;
  zoom: CameraZoomControl | undefined;
  zoomMessage: string;
  onCameraChange: (deviceId: string) => void;
  onManualMarker: () => void;
  onStrategyChange: (strategy: CaptureStrategy) => void;
  onZoomChange: (zoom: number) => void;
}

function formatZoom(value: number) {
  return Number(value.toFixed(2)).toString();
}

export default function CameraDiagnostics({
  cameras,
  selectedDeviceId,
  strategy,
  zoom,
  zoomMessage,
  onCameraChange,
  onManualMarker,
  onStrategyChange,
  onZoomChange,
}: Props) {
  return (
    <details
      open
      className="rounded-control border border-border-default bg-surface-subtle p-3 text-sm"
    >
      <summary className="cursor-pointer font-medium">
        Camera diagnostics
      </summary>
      <p className="mt-2 text-xs text-content-muted">
        Temporary preview experiment. Structured events go to protected Sari
        preview logs; camera frames and barcode values are never sent.
      </p>
      <div className="mt-3 grid gap-3">
        <label>
          <span className="mb-1 block text-xs font-medium">
            Capture strategy
          </span>
          <span className="relative block">
            <select
              value={strategy}
              onChange={(event) => {
                onStrategyChange(event.target.value as CaptureStrategy);
              }}
              className="min-h-11.5 w-full appearance-none rounded-control border border-border-control bg-surface py-2.5 pr-10 pl-3 text-base focus:border-brand focus:outline-2 focus:outline-offset-2 focus:outline-brand"
            >
              {Object.entries(captureStrategyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <LuChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-content-muted"
            />
          </span>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium">Camera source</span>
          <span className="relative block">
            <select
              value={selectedDeviceId}
              onChange={(event) => {
                onCameraChange(event.target.value);
              }}
              className="min-h-11.5 w-full appearance-none rounded-control border border-border-control bg-surface py-2.5 pr-10 pl-3 text-base focus:border-brand focus:outline-2 focus:outline-offset-2 focus:outline-brand"
            >
              <option value="">Default rear camera preference</option>
              {cameras.map((camera) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label}
                </option>
              ))}
            </select>
            <LuChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-content-muted"
            />
          </span>
        </label>
        {zoom && (
          <div>
            <label
              htmlFor="camera-zoom"
              className="mb-1 block text-xs font-medium"
            >
              Camera zoom
            </label>
            <input
              id="camera-zoom"
              type="range"
              min={zoom.min}
              max={zoom.max}
              step={zoom.step ?? "any"}
              value={zoom.current}
              onChange={(event) => {
                onZoomChange(event.currentTarget.valueAsNumber);
              }}
              aria-describedby="camera-zoom-status"
              className="min-h-11.5 w-full accent-brand"
            />
            <output
              id="camera-zoom-status"
              className="block text-xs text-content-muted"
            >
              Current zoom: {formatZoom(zoom.current)}×
              {zoomMessage ? ` — ${zoomMessage}` : ""}
            </output>
          </div>
        )}
        <button
          type="button"
          onClick={onManualMarker}
          className="inline-flex min-h-11.5 w-full items-center justify-center rounded-control border border-border-control bg-surface px-3 py-2 text-sm font-medium text-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Camera switched / image sharpened
        </button>
      </div>
    </details>
  );
}
