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

  useEffect(() => {
    const controller = new AbortController();
    let accepted = false;
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
        const hints = new Map([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [
              BarcodeFormat.UPC_A,
              BarcodeFormat.EAN_13,
              BarcodeFormat.EAN_8,
              BarcodeFormat.ITF,
            ],
          ],
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromStream(
          stream,
          video,
          (result, _error, controls) => {
            if (!result || controller.signal.aborted || accepted) {
              return;
            }
            accepted = true;
            controls.stop();
            stop();
            detected(result.getText());
          },
        );
        stopDecoding = () => {
          controls.stop();
        };
        if (controller.signal.aborted || accepted) {
          stop();
        }
      } catch {
        stop();
        if (!controller.signal.aborted) {
          setError(
            "Camera access is unavailable. Check permission or enter the barcode number manually.",
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
          (guidance
            ? "Having trouble? Improve the lighting, move the barcode into focus, or enter the number manually."
            : "Place one barcode inside the frame. Camera images stay on your device.")}
      </p>
      <button
        type="button"
        onClick={onType}
        className={`rounded-control border border-border-default px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand ${guidance === 2 || error ? "bg-brand text-content-inverse" : "bg-surface text-content"}`}
      >
        Enter barcode manually
      </button>
      {guidance === 2 && !error && (
        <button
          type="button"
          onClick={() => {
            setGuidance(0);
          }}
          className="ml-2 text-sm text-brand"
        >
          Keep scanning
        </button>
      )}
    </div>
  );
}
