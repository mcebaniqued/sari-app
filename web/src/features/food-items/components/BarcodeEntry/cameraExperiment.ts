export type CaptureStrategy = "baseline" | "prefer-hd";

export interface CameraOption {
  deviceId: string;
  label: string;
}

export interface CameraDiagnosticSnapshot {
  cameraLabel: string;
  captureResolution: string;
  videoResolution: string;
  frameRate: string;
  facingMode: string;
  resolutionCapability: string;
  frameRateCapability: string;
  focusModes: string;
  zoomCapability: string;
}

interface NumericRange {
  min?: number;
  max?: number;
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

function describeNumber(value: number | undefined) {
  return value === undefined ? "Not reported" : String(Math.round(value));
}

function describeRange(value: unknown) {
  if (!value || typeof value !== "object") {
    return "Not reported";
  }

  const { min, max } = value as NumericRange;
  if (typeof min !== "number" || typeof max !== "number") {
    return "Not reported";
  }

  return min === max ? String(min) : `${min}–${max}`;
}

function describeModes(value: unknown) {
  return Array.isArray(value) && value.every((mode) => typeof mode === "string")
    ? value.join(", ")
    : "Not reported";
}

function readCameraValue<T>(read: () => T, fallback: T) {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function cameraDiagnosticSnapshot(
  track: MediaStreamTrack,
  video: HTMLVideoElement,
): CameraDiagnosticSnapshot {
  const inspectableTrack = track as unknown as {
    getCapabilities?: () => MediaTrackCapabilities;
    getSettings?: () => MediaTrackSettings;
  };
  const settings = readCameraValue(
    () => inspectableTrack.getSettings?.() ?? {},
    {},
  );
  const capabilities = readCameraValue(
    () => inspectableTrack.getCapabilities?.() ?? {},
    {},
  ) as MediaTrackCapabilities & Record<string, unknown>;
  const captureResolution =
    settings.width === undefined || settings.height === undefined
      ? "Not reported"
      : `${settings.width} × ${settings.height}`;
  const videoResolution =
    video.videoWidth && video.videoHeight
      ? `${video.videoWidth} × ${video.videoHeight}`
      : "Not reported";
  const width = describeRange(capabilities.width);
  const height = describeRange(capabilities.height);

  return {
    cameraLabel: track.label.trim() ? track.label : "Not reported",
    captureResolution,
    videoResolution,
    frameRate: describeNumber(settings.frameRate),
    facingMode: settings.facingMode ?? "Not reported",
    resolutionCapability:
      width === "Not reported" && height === "Not reported"
        ? "Not reported"
        : `${width} × ${height}`,
    frameRateCapability: describeRange(capabilities.frameRate),
    focusModes: describeModes(capabilities.focusMode),
    zoomCapability: describeRange(capabilities.zoom),
  };
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
