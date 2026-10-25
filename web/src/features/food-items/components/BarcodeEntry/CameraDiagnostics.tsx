import { LuChevronDown } from "react-icons/lu";
import {
  type CameraDiagnosticSnapshot,
  type CameraOption,
  type CaptureStrategy,
  captureStrategyLabels,
} from "./cameraExperiment";

interface Props {
  attempts: number;
  candidateReads: number;
  cameras: CameraOption[];
  selectedDeviceId: string;
  snapshot: CameraDiagnosticSnapshot | null;
  strategy: CaptureStrategy;
  onCameraChange: (deviceId: string) => void;
  onStrategyChange: (strategy: CaptureStrategy) => void;
}

export default function CameraDiagnostics({
  attempts,
  candidateReads,
  cameras,
  selectedDeviceId,
  snapshot,
  strategy,
  onCameraChange,
  onStrategyChange,
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
        Temporary local-only experiment. Change one setting at a time; camera
        frames and these details are not sent anywhere.
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
      </div>
      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="font-medium">Requested</dt>
        <dd>{captureStrategyLabels[strategy]}</dd>
        <dt className="font-medium">Selected camera</dt>
        <dd className="min-w-0 break-words">
          {snapshot?.cameraLabel ?? "Waiting for camera"}
        </dd>
        <dt className="font-medium">Capture resolution</dt>
        <dd>{snapshot?.captureResolution ?? "Waiting for camera"}</dd>
        <dt className="font-medium">Video resolution</dt>
        <dd>{snapshot?.videoResolution ?? "Waiting for camera"}</dd>
        <dt className="font-medium">Frame rate</dt>
        <dd>{snapshot?.frameRate ?? "Waiting for camera"}</dd>
        <dt className="font-medium">Facing mode</dt>
        <dd>{snapshot?.facingMode ?? "Waiting for camera"}</dd>
        <dt className="font-medium">Resolution range</dt>
        <dd>{snapshot?.resolutionCapability ?? "Waiting for camera"}</dd>
        <dt className="font-medium">Frame-rate range</dt>
        <dd>{snapshot?.frameRateCapability ?? "Waiting for camera"}</dd>
        <dt className="font-medium">Focus modes</dt>
        <dd>{snapshot?.focusModes ?? "Waiting for camera"}</dd>
        <dt className="font-medium">Zoom range</dt>
        <dd>{snapshot?.zoomCapability ?? "Waiting for camera"}</dd>
        <dt className="font-medium">Decode callbacks</dt>
        <dd>{attempts}</dd>
        <dt className="font-medium">Matching reads</dt>
        <dd>{candidateReads} / 3</dd>
      </dl>
    </details>
  );
}
