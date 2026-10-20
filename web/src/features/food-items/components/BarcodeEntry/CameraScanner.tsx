import { normalizeBarcode } from "@sari/contracts";
import { useEffect, useEffectEvent, useRef, useState } from "react";

interface Props {
  onDetected: (barcode: string) => void;
  onType: () => void;
}

export default function CameraScanner({ onDetected, onType }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [guidance, setGuidance] = useState(0);
  const [error, setError] = useState("");
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
    const stop = () => {
      stopDecoding?.();
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      timers.forEach(clearTimeout);
      if (video) {
        video.srcObject = null;
      }
    };
    async function start() {
      try {
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
        stream = await media.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        controller.signal.throwIfAborted();
        timers.push(
          setTimeout(() => {
            setGuidance(1);
          }, 10_000),
          setTimeout(() => {
            setGuidance(2);
          }, 25_000),
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
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 250,
        });
        const controls = await reader.decodeFromStream(
          stream,
          video,
          (result, _error, controls) => {
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
              return;
            }
            // A valid checksum alone cannot rule out a misread. Require three
            // matching frames, without carrying old reads across a long gap.
            const now = performance.now();
            candidate =
              candidate?.barcode === barcode && now - candidate.lastRead <= 1500
                ? { barcode, reads: candidate.reads + 1, lastRead: now }
                : { barcode, reads: 1, lastRead: now };
            if (candidate.reads < 3) {
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
        if (controller.signal.aborted || accepted) {
          stop();
        }
      } catch (error) {
        stop();
        if (!controller.signal.aborted) {
          setError(
            error instanceof DOMException && error.name === "NotAllowedError"
              ? "Allow camera access in your browser settings, or enter the barcode number instead."
              : error instanceof DOMException && error.name === "NotFoundError"
                ? "No camera was found. Enter the barcode number instead."
                : "Camera scanning isn't available here. Enter the barcode number instead.",
          );
        }
      }
    }
    void start();
    return () => {
      controller.abort();
      stop();
    };
  }, []);

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
