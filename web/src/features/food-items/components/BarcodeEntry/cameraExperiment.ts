import type {
  CameraDiagnosticCapabilities,
  CameraDiagnosticSettings,
} from "@sari/contracts";

export type CaptureStrategy = "baseline" | "prefer-hd";

export interface CameraOption {
  deviceId: string;
  label: string;
}

export interface CameraDiagnosticReading {
  rawDeviceId?: string;
  settings: CameraDiagnosticSettings;
}

export interface CameraZoomControl {
  min: number;
  max: number;
  step?: number;
  current: number;
}

interface NumericRange {
  min?: number;
  max?: number;
  step?: number;
}

interface ZoomTrack {
  applyConstraints?: MediaStreamTrack["applyConstraints"];
  getCapabilities?: () => MediaTrackCapabilities & {
    zoom?: NumericRange;
  };
  getSettings?: () => MediaTrackSettings & {
    zoom?: number;
  };
}

export const captureStrategyLabels: Record<CaptureStrategy, string> = {
  baseline: "Baseline (rear camera preference)",
  "prefer-hd": "Prefer 1920 × 1080",
};

export function cameraDiagnosticsEnabled(search: string) {
  return new URLSearchParams(search).get("cameraDiagnostics") === "1";
}

export function cameraVideoConstraints(
  strategy: CaptureStrategy,
  deviceId = "",
): MediaTrackConstraints {
  const camera = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: { ideal: "environment" } };

  return strategy === "prefer-hd"
    ? {
        ...camera,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      }
    : camera;
}

function numericRange(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const { min, max } = value as NumericRange;
  if (
    typeof min !== "number" ||
    !Number.isFinite(min) ||
    min < 0 ||
    typeof max !== "number" ||
    !Number.isFinite(max) ||
    max < min ||
    max > 100_000
  ) {
    return undefined;
  }

  return { min, max };
}

function boundedNumber(
  value: unknown,
  { integer = false, max = 100_000, positive = false } = {},
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < (positive ? Number.EPSILON : 0) ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    return undefined;
  }

  return value;
}

function boundedString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 64)
    : undefined;
}

function readCameraValue<T>(read: () => T, fallback: T) {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function cameraZoomControl(
  track: MediaStreamTrack,
): CameraZoomControl | undefined {
  const zoomTrack = track as unknown as ZoomTrack;
  if (
    typeof zoomTrack.applyConstraints !== "function" ||
    typeof zoomTrack.getCapabilities !== "function" ||
    typeof zoomTrack.getSettings !== "function"
  ) {
    return undefined;
  }

  const capabilities = readCameraValue(
    () => zoomTrack.getCapabilities?.().zoom,
    undefined,
  );
  const range = numericRange(capabilities);
  const current = boundedNumber(
    readCameraValue(() => zoomTrack.getSettings?.().zoom, undefined),
    { max: 1_000 },
  );
  if (
    !range ||
    range.min === range.max ||
    current === undefined ||
    current < range.min ||
    current > range.max
  ) {
    return undefined;
  }

  const step = boundedNumber(capabilities?.step, {
    max: range.max - range.min,
    positive: true,
  });

  return {
    ...range,
    ...(step === undefined ? {} : { step }),
    current,
  };
}

export async function applyCameraZoom(
  track: MediaStreamTrack,
  requested: number,
  range: Pick<CameraZoomControl, "min" | "max">,
) {
  if (!Number.isFinite(requested)) {
    throw new TypeError("Zoom must be a finite number.");
  }

  const zoom = Math.min(range.max, Math.max(range.min, requested));
  await track.applyConstraints({
    advanced: [
      {
        zoom,
      } as MediaTrackConstraintSet,
    ],
  });
  const zoomTrack = track as unknown as ZoomTrack;
  const actual = boundedNumber(
    readCameraValue(() => zoomTrack.getSettings?.().zoom, undefined),
    { max: 1_000 },
  );

  return { requested: zoom, actual };
}

export function cameraDiagnosticReading(
  track: MediaStreamTrack,
  video: HTMLVideoElement,
  deviceIdentity?: string,
): CameraDiagnosticReading {
  const inspectableTrack = track as unknown as {
    getSettings?: () => MediaTrackSettings;
  };
  const reported = readCameraValue(
    () => inspectableTrack.getSettings?.() ?? {},
    {},
  ) as MediaTrackSettings & Record<string, unknown>;
  const width = boundedNumber(reported.width, {
    integer: true,
    max: 16_384,
    positive: true,
  });
  const height = boundedNumber(reported.height, {
    integer: true,
    max: 16_384,
    positive: true,
  });
  const videoWidth = boundedNumber(video.videoWidth, {
    integer: true,
    max: 16_384,
  });
  const videoHeight = boundedNumber(video.videoHeight, {
    integer: true,
    max: 16_384,
  });
  const frameRate = boundedNumber(reported.frameRate, {
    max: 1_000,
    positive: true,
  });
  const focusDistance = boundedNumber(reported.focusDistance);
  const zoom = boundedNumber(reported.zoom, { max: 1_000 });

  return {
    ...(typeof reported.deviceId === "string" && reported.deviceId
      ? { rawDeviceId: reported.deviceId }
      : {}),
    settings: {
      ...(width === undefined ? {} : { width }),
      ...(height === undefined ? {} : { height }),
      ...(videoWidth === undefined ? {} : { videoWidth }),
      ...(videoHeight === undefined ? {} : { videoHeight }),
      ...(frameRate === undefined ? {} : { frameRate }),
      ...(boundedString(reported.facingMode)
        ? { facingMode: boundedString(reported.facingMode) }
        : {}),
      ...(boundedString(reported.focusMode)
        ? { focusMode: boundedString(reported.focusMode) }
        : {}),
      ...(focusDistance === undefined ? {} : { focusDistance }),
      ...(zoom === undefined ? {} : { zoom }),
      ...(deviceIdentity ? { deviceIdentity } : {}),
    },
  };
}

export function cameraDiagnosticCapabilities(
  track: MediaStreamTrack,
): CameraDiagnosticCapabilities {
  const inspectableTrack = track as unknown as {
    getCapabilities?: () => MediaTrackCapabilities;
  };
  const capabilities = readCameraValue(
    () => inspectableTrack.getCapabilities?.() ?? {},
    {},
  ) as MediaTrackCapabilities & Record<string, unknown>;
  const focusModes = Array.isArray(capabilities.focusMode)
    ? capabilities.focusMode
        .filter((mode): mode is string => typeof mode === "string")
        .map((mode) => mode.trim().slice(0, 64))
        .filter(Boolean)
        .slice(0, 10)
    : undefined;

  return {
    ...(numericRange(capabilities.width)
      ? { width: numericRange(capabilities.width) }
      : {}),
    ...(numericRange(capabilities.height)
      ? { height: numericRange(capabilities.height) }
      : {}),
    ...(numericRange(capabilities.frameRate)
      ? { frameRate: numericRange(capabilities.frameRate) }
      : {}),
    ...(numericRange(capabilities.zoom)
      ? { zoom: numericRange(capabilities.zoom) }
      : {}),
    ...(numericRange(capabilities.focusDistance)
      ? { focusDistance: numericRange(capabilities.focusDistance) }
      : {}),
    ...(focusModes?.length ? { focusModes } : {}),
  };
}

export function changedCameraSettings(
  previous: CameraDiagnosticSettings,
  current: CameraDiagnosticSettings,
) {
  return (
    Object.keys({
      ...previous,
      ...current,
    }) as (keyof CameraDiagnosticSettings)[]
  ).filter((field) => previous[field] !== current[field]);
}

export function diagnosticCameraLabel(track: MediaStreamTrack) {
  return track.label.trim().slice(0, 120) || "Not reported";
}

export async function availableVideoInputs(media: MediaDevices) {
  const inspectableMedia = media as unknown as {
    enumerateDevices?: () => Promise<MediaDeviceInfo[]>;
  };
  if (!inspectableMedia.enumerateDevices) {
    return [];
  }

  try {
    const devices = await inspectableMedia.enumerateDevices();
    let cameraNumber = 0;

    return devices
      .filter((device) => device.kind === "videoinput")
      .map((device): CameraOption => {
        cameraNumber += 1;

        return {
          deviceId: device.deviceId,
          label: device.label.trim() ? device.label : `Camera ${cameraNumber}`,
        };
      });
  } catch {
    return [];
  }
}
