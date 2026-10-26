import { useState, useSyncExternalStore } from "react";
import {
  cameraDiagnosticRevision,
  cameraDiagnosticSnapshot,
  exportCameraDiagnostics,
  subscribeToCameraDiagnostics,
} from "./cameraDiagnosticExport";

export default function CameraDiagnosticExportControl() {
  useSyncExternalStore(
    subscribeToCameraDiagnostics,
    cameraDiagnosticRevision,
    cameraDiagnosticRevision,
  );
  const [message, setMessage] = useState("");
  const sessionCount = cameraDiagnosticSnapshot().length;

  return (
    <section className="mx-6 mb-4 rounded-control border border-border-default bg-surface-subtle p-3 text-sm">
      <p className="font-medium">Camera diagnostic export</p>
      <p className="mt-1 text-xs text-content-muted">
        {sessionCount === 0
          ? "No camera sessions have been collected on this page yet."
          : `${sessionCount} camera ${sessionCount === 1 ? "session" : "sessions"} ready to export.`}
      </p>
      <button
        type="button"
        disabled={sessionCount === 0}
        onClick={() => {
          setMessage("");
          void exportCameraDiagnostics()
            .then((result) => {
              setMessage(
                result === "shared"
                  ? "Diagnostic JSON opened in the share sheet."
                  : "Diagnostic JSON download started.",
              );
            })
            .catch((error: unknown) => {
              if (
                error instanceof DOMException &&
                error.name === "AbortError"
              ) {
                setMessage("Export canceled.");

                return;
              }

              setMessage("Could not export diagnostics. Try again.");
            });
        }}
        className="mt-3 inline-flex min-h-11.5 w-full items-center justify-center rounded-control border border-border-control bg-surface px-3 py-2 text-sm font-medium text-brand hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Export diagnostic JSON
      </button>
      {message && (
        <p role="status" className="mt-2 text-xs text-content-muted">
          {message}
        </p>
      )}
    </section>
  );
}
