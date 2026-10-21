import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";

interface ModalProps {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  dismissible?: boolean;
}

/** Native dialog supplies the top layer and background inertness; Tab stays inside. */
export default function Modal({
  title,
  description,
  children,
  onClose,
  dismissible = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const previousFocus = document.activeElement;
    const scrollWasLocked = document.body.classList.contains("overflow-hidden");
    document.body.classList.add("overflow-hidden");
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    return () => {
      dialog.close();
      if (!scrollWasLocked) {
        document.body.classList.remove("overflow-hidden");
      }
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      tabIndex={-1}
      className={`fixed inset-0 m-auto max-h-[calc(100dvh-3rem)] w-[min(480px,calc(100vw-2rem))] overflow-y-auto rounded-modal border border-border-default bg-surface p-0 text-content shadow-modal backdrop:bg-overlay ${dismissible ? "backdrop:cursor-pointer" : "backdrop:cursor-not-allowed"}`}
      onKeyDown={(event) => {
        if (event.key !== "Tab") {
          return;
        }

        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            "button, input, select, textarea, a[href], [tabindex]",
          ),
        ].filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(":disabled") &&
            element.getClientRects().length > 0,
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) {
          event.preventDefault();

          return;
        }

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) {
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || !dismissible) {
          return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border-default px-6 py-5">
        <div>
          <h2 id={titleId} className="text-xl font-semibold tracking-tight">
            {title}
          </h2>
          {description && (
            <p
              id={descriptionId}
              className="mt-1.5 text-sm leading-relaxed text-content-muted"
            >
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={!dismissible}
          onClick={onClose}
          aria-label="Close modal"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover hover:text-content disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand -mr-1"
        >
          <LuX aria-hidden="true" className="size-5" />
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
