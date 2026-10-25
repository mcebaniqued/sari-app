import { normalizeBarcode } from "@sari/contracts";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import CameraDiagnostics from "./CameraDiagnostics";
import {
  availableVideoInputs,
  cameraDiagnosticsEnabled,
  type CameraDiagnosticSnapshot,
  cameraDiagnosticSnapshot,
  type CameraOption,
  cameraVideoConstraints,
  type CaptureStrategy,
} from "./cameraExperiment";

const SCAN_INTERVAL_MS = 250;
const REQUIRED_MATCHING_READS = 3;
const MAX_READ_GAP_MS = 1500;
const LIGHTING_GUIDANCE_DELAY_MS = 10_000;
const MANUAL_ENTRY_GUIDANCE_DELAY_MS = 25_000;

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

interface Props {
  onDetected: (barcode: string) => void;
  onType: () => void;
}

export default function CameraScanner({ onDetected, onType }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const diagnosticsEnabled = cameraDiagnosticsEnabled(
    globalThis.location.search,
  );

  const [guidance, setGuidance] = useState(0);
  const [error, setError] = useState("");
  const [strategy, setStrategy] = useState<CaptureStrategy>("baseline");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [snapshot, setSnapshot] = useState<CameraDiagnosticSnapshot | null>(
    null,
  );
  const [attempts, setAttempts] = useState(0);
  const [candidateReads, setCandidateReads] = useState(0);

  const detected = useEffectEvent(onDetected);
  const slowScan = guidance === 2 && !error;

  useEffect(() => {
    const controller = new AbortController();
    let accepted = false;
    let candidate: { barcode: string; reads: number; lastRead: number } | null =
      null;
    let stream: MediaStream | undefined;
    let stopDecoding: (() => void) | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const video = videoRef.current;

    // Cleanup is safe both during decoding and after a late permission response.
    const stop = () => {
      stopDecoding?.();
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      timers.forEach(clearTimeout);
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
        setSnapshot(null);
        setAttempts(0);
        setCandidateReads(0);
        if (!globalThis.isSecureContext) {
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
          setSnapshot(cameraDiagnosticSnapshot(track, video));
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
        const controls = await reader.decodeFromStream(
          stream,
          video,
          (result, _error, controls) => {
            if (diagnosticsEnabled && !controller.signal.aborted && !accepted) {
              setAttempts((count) => count + 1);
            }
            if (!result || controller.signal.aborted || accepted) {
              return;
            }

            const value = result.getText();
            const barcode = normalizeBarcode(value);
            if (
              !barcode ||
              value.length !== formatLengths.get(result.getBarcodeFormat())
            ) {
              candidate = null;
              if (diagnosticsEnabled) {
                setCandidateReads(0);
              }

              return;
            }

            // A valid checksum alone cannot rule out a misread. Require three
            // matching frames, without carrying old reads across a long gap.
            const now = performance.now();
            candidate =
              candidate?.barcode === barcode &&
              now - candidate.lastRead <= MAX_READ_GAP_MS
                ? { barcode, reads: candidate.reads + 1, lastRead: now }
                : { barcode, reads: 1, lastRead: now };
            if (diagnosticsEnabled) {
              setCandidateReads(candidate.reads);
            }
            if (candidate.reads < REQUIRED_MATCHING_READS) {
              return;
            }

            accepted = true;
            controls.stop();
            stop();
            detected(value);
          },
        );
        stopDecoding = () => {
          controls.stop();
        };
        if (diagnosticsEnabled && !controller.signal.aborted && !accepted) {
          setSnapshot(cameraDiagnosticSnapshot(track, video));
        }
        if (controller.signal.aborted || accepted) {
          stop();
        }
      } catch (error) {
        stop();
        if (!controller.signal.aborted) {
          setError(cameraErrorMessage(error, diagnosticsEnabled));
        }
      }
    }

    void start();

    return () => {
      controller.abort();
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
          attempts={attempts}
          candidateReads={candidateReads}
          cameras={cameras}
          selectedDeviceId={selectedDeviceId}
          snapshot={snapshot}
          strategy={strategy}
          onCameraChange={setSelectedDeviceId}
          onStrategyChange={setStrategy}
        />
      )}
      <div className={`grid gap-3 ${slowScan ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          onClick={onType}
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
