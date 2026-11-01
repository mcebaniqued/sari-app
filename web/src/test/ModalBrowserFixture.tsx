import "@/styles/index.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import Modal, { type ModalDismissalPolicy } from "@/components/Modal/Modal";

const longTitle =
  "A very long pantry item heading that remains readable beside every available header action";

// This Vite entry mounts directly so Playwright can exercise native dialog behavior.
// eslint-disable-next-line react-refresh/only-export-components
function ModalBrowserFixture() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const parameters = new URLSearchParams(window.location.search);
  const autofocus = parameters.has("autofocus");
  const backdrop = parameters.has("backdrop");
  const dismissal: ModalDismissalPolicy = busy
    ? { backdrop: false, closeButton: false, escape: false }
    : { backdrop, closeButton: true, escape: true };

  return (
    <main className="p-6">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open fixture
      </button>
      {open && (
        <Modal
          title={longTitle}
          description="Browser-only fixture for the shared Modal foundation."
          dismissal={dismissal}
          presentation="responsive"
          scroll="contained"
          headerActions={
            <button
              type="button"
              aria-pressed={busy}
              onClick={() => {
                setBusy((current) => !current);
              }}
              className="min-h-11 rounded-control border border-border-default px-3 focus-visible:outline-2 focus-visible:outline-brand"
            >
              {busy ? "End pending operation" : "Start pending operation"}
            </button>
          }
          onClose={() => {
            setOpen(false);
          }}
        >
          <div className="space-y-5 px-6 py-5">
            {autofocus && (
              <input
                data-autofocus
                aria-label="Intentional initial focus"
                className="min-h-11 w-full rounded-control border border-border-control px-3"
              />
            )}
            {Array.from({ length: 18 }, (_, index) => (
              <p key={index}>
                Detail section {index + 1}. This content makes the designated
                region scroll while the header remains available.
              </p>
            ))}
            <button
              type="button"
              className="min-h-11 rounded-control bg-brand px-4 text-content-inverse focus-visible:outline-2 focus-visible:outline-brand"
            >
              Last detail action
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("The Modal browser fixture root is missing.");
}

createRoot(root).render(<ModalBrowserFixture />);
