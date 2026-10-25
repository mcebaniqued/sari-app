import {
  type CameraDiagnosticSettings,
  normalizeBarcode,
} from "@sari/contracts";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import CameraDiagnostics from "./CameraDiagnostics";
import {
  availableVideoInputs,
  cameraDiagnosticCapabilities,
  cameraDiagnosticReading,
  cameraDiagnosticsEnabled,
  type CameraOption,
  cameraVideoConstraints,
  type CaptureStrategy,
  changedCameraSettings,
  diagnosticCameraLabel,
} from "./cameraExperiment";
import { CameraDiagnosticSession } from "./cameraTelemetry";

const SCAN_INTERVAL_MS = 250;
const REQUIRED_MATCHING_READS = 3;
const MAX_READ_GAP_MS = 1500;
const LIGHTING_GUIDANCE_DELAY_MS = 10_000;
const MANUAL_ENTRY_GUIDANCE_DELAY_MS = 25_000;
const DIAGNOSTIC_SAMPLE_INTERVAL_MS = 1_000;

function cameraErrorMessage(error: unknown, diagnosticsEnabled: boolean) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Allow camera access in your browser settings, or enter the barcode number instead.";
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No camera was found. Enter the barcode number instead.";
  }

  if (
    diagnosticsEnabled &&
    error instanceof DOMException &&
    error.name === "OverconstrainedError"
  ) {
    return "That camera setup isn't available. Choose the baseline strategy or another camera.";
  }

  return "Camera scanning isn't available here. Enter the barcode number instead.";
}

function diagnosticErrorName(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string" &&
    error.name
    ? error.name.slice(0, 64)
    : "UnknownError";
}

interface Props {
  onDetected: (barcode: string) => void;
  onType: () => void;
}

export default function CameraScanner({ onDetected, onType }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const diagnosticSessionRef = useRef<CameraDiagnosticSession | null>(null);

  const diagnosticsEnabled = cameraDiagnosticsEnabled(
    globalThis.location.search,
  );

  const [guidance, setGuidance] = useState(0);
  const [error, setError] = useState("");
  const [strategy, setStrategy] = useState<CaptureStrategy>("baseline");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [cameras, setCameras] = useState<CameraOption[]>([]);

  const detected = useEffectEvent(onDetected);
  const slowScan = guidance === 2 && !error;

  const cancelDiagnosticSession = (
    reason: "camera-change" | "manual-entry" | "strategy-change",
  ) => {
    void diagnosticSessionRef.current?.close({
      type: "session-cancelled",
      reason,
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    let accepted = false;
    let candidate: { barcode: string; reads: number; lastRead: number } | null =
      null;
    let stream: MediaStream | undefined;
    let stopDecoding: (() => void) | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const video = videoRef.current;
    const diagnosticSession = diagnosticsEnabled
      ? new CameraDiagnosticSession()
      : undefined;
    const sessionStartedAt = performance.now();
    let attempts = 0;
    let invalidResults = 0;
    let noResults = 0;
    let validResults = 0;
    let lastSummaryAttempts = 0;
    let timeToFirstValidMs: number | undefined;
    let errorStage: "acquisition" | "decoding" | "setup" = "setup";
    let removeVideoReadyListener: (() => void) | undefined;

    diagnosticSessionRef.current = diagnosticSession ?? null;
    diagnosticSession?.record({
      type: "session-started",
      captureStrategy: strategy,
      cameraSource: selectedDeviceId ? "selected" : "default",
      ...(strategy === "prefer-hd"
        ? { requestedResolution: { width: 1920, height: 1080 } }
        : {}),
    });

    const emitDecodeSummary = () => {
      if (!diagnosticSession || attempts === lastSummaryAttempts) {
        return;
      }

      lastSummaryAttempts = attempts;
      diagnosticSession.record({
        type: "decode-summary",
        attempts,
        noResult: noResults,
        invalid: invalidResults,
        valid: validResults,
      });
    };

    const handlePageHide = () => {
      emitDecodeSummary();
      void diagnosticSession?.flush();
    };
    globalThis.addEventListener("pagehide", handlePageHide);

    // Cleanup is safe both during decoding and after a late permission response.
    const stop = () => {
      stopDecoding?.();
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      timers.forEach(clearTimeout);
      removeVideoReadyListener?.();
      // A cancelled Strict Mode startup can finish after a newer effect attaches
      // its stream to the same element. Only clear the preview owned by this run.
      if (video && video.srcObject === stream) {
        video.srcObject = null;
      }
    };

    async function start() {
      try {
        setError("");
        setGuidance(0);
        if (!globalThis.isSecureContext) {
          void diagnosticSession?.close({
            type: "session-error",
            stage: "setup",
            errorName: "SecurityError",
          });
          setError(
            "Camera scanning needs a secure connection. You can enter the barcode number instead.",
          );

          return;
        }

        const media = (navigator as { mediaDevices?: MediaDevices })
          .mediaDevices;
        if (!media || !video) {
          throw new Error("Camera unavailable");
        }

        const [
          { BrowserMultiFormatReader },
          { BarcodeFormat, DecodeHintType },
        ] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        controller.signal.throwIfAborted();
        const videoConstraints = cameraVideoConstraints(
          strategy,
          selectedDeviceId,
        );
        errorStage = "acquisition";
        stream = await media.getUserMedia({
          audio: false,
          video: videoConstraints,
        });
        controller.signal.throwIfAborted();
        const track = stream.getVideoTracks()[0];
        if (!track) {
          throw new Error("Camera unavailable");
        }
        if (diagnosticsEnabled) {
          const deviceIdentities = new Map<string, string>();
          let nextDeviceIdentity = 1;
          const readSettings = () => {
            const reading = cameraDiagnosticReading(track, video);
            let deviceIdentity: string | undefined;
            if (reading.rawDeviceId) {
              deviceIdentity = deviceIdentities.get(reading.rawDeviceId);
              if (!deviceIdentity) {
                deviceIdentity = `camera-${nextDeviceIdentity}`;
                nextDeviceIdentity += 1;
                deviceIdentities.set(reading.rawDeviceId, deviceIdentity);
              }
            }

            return {
              ...reading.settings,
              ...(deviceIdentity ? { deviceIdentity } : {}),
            } satisfies CameraDiagnosticSettings;
          };
          let previousSettings = readSettings();
          diagnosticSession?.record({
            type: "camera-acquired",
            cameraLabel: diagnosticCameraLabel(track),
            settings: previousSettings,
            capabilities: cameraDiagnosticCapabilities(track),
          });
          const recordVideoReady = () => {
            diagnosticSession?.record({
              type: "video-ready",
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
            });
          };
          if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            recordVideoReady();
          } else {
            video.addEventListener("loadedmetadata", recordVideoReady, {
              once: true,
            });
            removeVideoReadyListener = () => {
              video.removeEventListener("loadedmetadata", recordVideoReady);
            };
          }
          timers.push(
            setInterval(() => {
              const currentSettings = readSettings();
              const changedFields = changedCameraSettings(
                previousSettings,
                currentSettings,
              );
              if (changedFields.length > 0) {
                diagnosticSession?.record({
                  type: "settings-changed",
                  changedFields,
                  settings: currentSettings,
                });
                previousSettings = currentSettings;
              }
            }, DIAGNOSTIC_SAMPLE_INTERVAL_MS),
            setInterval(emitDecodeSummary, DIAGNOSTIC_SAMPLE_INTERVAL_MS),
          );
          void availableVideoInputs(media).then((inputs) => {
            if (!controller.signal.aborted) {
              setCameras(inputs);
            }
          });
        }
        timers.push(
          setTimeout(() => {
            setGuidance(1);
          }, LIGHTING_GUIDANCE_DELAY_MS),
          setTimeout(() => {
            setGuidance(2);
          }, MANUAL_ENTRY_GUIDANCE_DELAY_MS),
        );
        const formatLengths = new Map([
          [BarcodeFormat.UPC_A, 12],
          [BarcodeFormat.EAN_13, 13],
          [BarcodeFormat.EAN_8, 8],
          [BarcodeFormat.ITF, 14],
        ]);
        const hints = new Map<number, unknown>([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [
              BarcodeFormat.UPC_A,
              BarcodeFormat.EAN_13,
              BarcodeFormat.EAN_8,
              BarcodeFormat.ITF,
            ],
          ],
          // Retail ITF must be GTIN-14; generic ITF also accepts short patterns.
          [DecodeHintType.ALLOWED_LENGTHS, [14]],
        ]);
        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: SCAN_INTERVAL_MS,
          delayBetweenScanSuccess: SCAN_INTERVAL_MS,
        });
        errorStage = "decoding";
        diagnosticSession?.record({ type: "decoder-started" });
        const controls = await reader.decodeFromStream(
          stream,
          video,
          (result, _error, controls) => {
            if (controller.signal.aborted || accepted) {
              return;
            }

            attempts += 1;
            if (!result) {
              noResults += 1;

              return;
            }

            const value = result.getText();
            const barcode = normalizeBarcode(value);
            if (
              !barcode ||
              value.length !== formatLengths.get(result.getBarcodeFormat())
            ) {
              invalidResults += 1;
              if (candidate) {
                diagnosticSession?.record({
                  type: "matching-reset",
                  reason: "invalid",
                  previousReads: candidate.reads,
                });
              }
              candidate = null;

              return;
            }

            validResults += 1;
            // A valid checksum alone cannot rule out a misread. Require three
            // matching frames, without carrying old reads across a long gap.
            const now = performance.now();
            if (timeToFirstValidMs === undefined) {
              timeToFirstValidMs = Math.round(now - sessionStartedAt);
              const formatNames = new Map([
                [BarcodeFormat.UPC_A, "UPC_A" as const],
                [BarcodeFormat.EAN_13, "EAN_13" as const],
                [BarcodeFormat.EAN_8, "EAN_8" as const],
                [BarcodeFormat.ITF, "ITF" as const],
              ]);
              const format = formatNames.get(result.getBarcodeFormat());
              if (format) {
                diagnosticSession?.record({
                  type: "first-valid-read",
                  attempt: attempts,
                  format,
                });
              }
            }
            if (candidate?.barcode !== barcode && candidate) {
              diagnosticSession?.record({
                type: "matching-reset",
                reason: "different-barcode",
                previousReads: candidate.reads,
              });
            } else if (
              candidate?.barcode === barcode &&
              now - candidate.lastRead > MAX_READ_GAP_MS
            ) {
              diagnosticSession?.record({
                type: "matching-reset",
                reason: "stale",
                previousReads: candidate.reads,
              });
            }
            candidate =
              candidate?.barcode === barcode &&
              now - candidate.lastRead <= MAX_READ_GAP_MS
                ? { barcode, reads: candidate.reads + 1, lastRead: now }
                : { barcode, reads: 1, lastRead: now };
            diagnosticSession?.record({
              type: "matching-progress",
              attempt: attempts,
              reads: candidate.reads,
            });
            if (candidate.reads < REQUIRED_MATCHING_READS) {
              return;
            }

            accepted = true;
            emitDecodeSummary();
            void diagnosticSession?.close({
              type: "session-completed",
              outcome: "confirmed",
              attempts,
              timeToFirstValidMs,
              timeToConfirmedMs: Math.round(now - sessionStartedAt),
            });
            controls.stop();
            stop();
            detected(value);
          },
        );
        stopDecoding = () => {
          controls.stop();
        };
        if (controller.signal.aborted || accepted) {
          stop();
        }
      } catch (error) {
        emitDecodeSummary();
        void diagnosticSession?.close({
          type: "session-error",
          stage: errorStage,
          errorName: diagnosticErrorName(error),
        });
        stop();
        if (!controller.signal.aborted) {
          setError(cameraErrorMessage(error, diagnosticsEnabled));
        }
      }
    }

    void start();

    return () => {
      controller.abort();
      emitDecodeSummary();
      void diagnosticSession?.close({
        type: "session-cancelled",
        reason: "component-closed",
      });
      globalThis.removeEventListener("pagehide", handlePageHide);
      if (diagnosticSessionRef.current === diagnosticSession) {
        diagnosticSessionRef.current = null;
      }
      stop();
    };
  }, [diagnosticsEnabled, selectedDeviceId, strategy]);

  return (
    <div className="space-y-3">
      {!error && (
        <div className="relative overflow-hidden rounded-control border border-border-default bg-surface-subtle">
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            aria-label="Barcode camera preview"
            className="aspect-video w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 inset-y-10 rounded-control border-2 border-brand"
          />
        </div>
      )}
      <p role="status" className="text-sm text-content-muted">
        {error ||
          (guidance === 2
            ? "Still no scan? You can enter the barcode number instead."
            : guidance === 1
              ? "Try brighter light and hold the package steady."
              : "Place one barcode inside the frame. Camera images stay on your device.")}
      </p>
      {diagnosticsEnabled && (
        <CameraDiagnostics
          cameras={cameras}
          selectedDeviceId={selectedDeviceId}
          strategy={strategy}
          onCameraChange={(deviceId) => {
            cancelDiagnosticSession("camera-change");
            setSelectedDeviceId(deviceId);
          }}
          onManualMarker={() => {
            diagnosticSessionRef.current?.record({
              type: "manual-marker",
              marker: "camera-switched-or-image-sharpened",
            });
          }}
          onStrategyChange={(nextStrategy) => {
            cancelDiagnosticSession("strategy-change");
            setStrategy(nextStrategy);
          }}
        />
      )}
      <div className={`grid gap-3 ${slowScan ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          onClick={() => {
            cancelDiagnosticSession("manual-entry");
            onType();
          }}
          className={`inline-flex min-h-11 w-full items-center justify-center rounded-control px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand ${slowScan || error ? "bg-brand text-content-inverse" : "text-brand hover:bg-surface-hover"}`}
        >
          {slowScan ? "Type barcode" : "Enter barcode manually"}
        </button>
        {slowScan && (
          <button
            type="button"
            onClick={() => {
              setGuidance(0);
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-control px-3 py-2 text-sm text-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand"
          >
            Keep scanning
          </button>
        )}
      </div>
    </div>
  );
}
