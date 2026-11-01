import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";

export interface ModalDismissalPolicy {
  backdrop: boolean;
  closeButton: boolean;
  escape: boolean;
}

interface ModalBaseProps {
  title: string;
  description?: string;
  children: ReactNode;
  headerActions?: ReactNode;
  onClose: () => void;
  onRestoreFocusFallback?: (() => void) | undefined;
  presentation?: "centered" | "responsive";
  scroll?: "dialog" | "contained";
}

type ModalProps = ModalBaseProps &
  (
    | {
        dismissal?: ModalDismissalPolicy;
        dismissible?: never;
      }
    | {
        dismissal?: never;
        dismissible?: boolean;
      }
  );

const fullyDismissible: ModalDismissalPolicy = {
  backdrop: true,
  closeButton: true,
  escape: true,
};

interface DocumentScrollLock {
  count: number;
  scrollX: number;
  scrollY: number;
  rootOverflow: string;
  rootOverscrollBehavior: string;
  bodyHadOverflowHidden: boolean;
  bodyLeft: string;
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
}

let documentScrollLock: DocumentScrollLock | null = null;

function lockDocumentScroll() {
  const root = document.documentElement;
  const body = document.body;
  if (documentScrollLock) {
    documentScrollLock.count += 1;
  } else {
    documentScrollLock = {
      count: 1,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      rootOverflow: root.style.overflow,
      rootOverscrollBehavior: root.style.overscrollBehavior,
      bodyHadOverflowHidden: body.classList.contains("overflow-hidden"),
      bodyLeft: body.style.left,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
    };

    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.classList.add("overflow-hidden");
    body.style.position = "fixed";
    body.style.top = `-${documentScrollLock.scrollY}px`;
    body.style.left = `-${documentScrollLock.scrollX}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
  }

  let released = false;

  return () => {
    if (released || !documentScrollLock) {
      return;
    }
    released = true;
    documentScrollLock.count -= 1;
    if (documentScrollLock.count > 0) {
      return;
    }

    const releasedLock = documentScrollLock;
    documentScrollLock = null;
    root.style.overflow = releasedLock.rootOverflow;
    root.style.overscrollBehavior = releasedLock.rootOverscrollBehavior;
    body.style.position = releasedLock.bodyPosition;
    body.style.top = releasedLock.bodyTop;
    body.style.left = releasedLock.bodyLeft;
    body.style.width = releasedLock.bodyWidth;
    body.style.overflow = releasedLock.bodyOverflow;
    body.style.overscrollBehavior = releasedLock.bodyOverscrollBehavior;
    if (!releasedLock.bodyHadOverflowHidden) {
      body.classList.remove("overflow-hidden");
    }
    window.scrollTo(releasedLock.scrollX, releasedLock.scrollY);
    if (document.scrollingElement) {
      document.scrollingElement.scrollLeft = releasedLock.scrollX;
      document.scrollingElement.scrollTop = releasedLock.scrollY;
    }
  };
}

function focusAutofocusCandidate(dialog: HTMLDialogElement) {
  const candidates = dialog.querySelectorAll<HTMLElement>("[data-autofocus]");

  for (const candidate of candidates) {
    if (
      candidate.matches(":disabled, [aria-disabled='true']") ||
      candidate.closest("[hidden], [inert], [aria-hidden='true']")
    ) {
      continue;
    }

    let current: HTMLElement | null = candidate;
    let visuallyHidden = false;
    while (current && current !== dialog) {
      const style = window.getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse"
      ) {
        visuallyHidden = true;
        break;
      }
      current = current.parentElement;
    }
    if (visuallyHidden) {
      continue;
    }

    candidate.focus({ preventScroll: true });
    if (document.activeElement === candidate) {
      return true;
    }
  }

  return false;
}

/** Native dialog supplies the top layer and background inertness; Tab stays inside. */
export default function Modal({
  title,
  description,
  children,
  headerActions,
  onClose,
  onRestoreFocusFallback,
  presentation = "centered",
  scroll = "dialog",
  dismissal,
  dismissible = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const dismissalPolicy =
    dismissal ??
    (dismissible
      ? fullyDismissible
      : { backdrop: false, closeButton: false, escape: false });
  const restoreFocusFallback = useEffectEvent(() => {
    onRestoreFocusFallback?.();
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const previousFocus = document.activeElement;
    const unlockDocumentScroll = lockDocumentScroll();
    dialog.showModal();

    if (!focusAutofocusCandidate(dialog)) {
      titleRef.current?.focus({ preventScroll: true });
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      } else {
        restoreFocusFallback();
      }
      unlockDocumentScroll();
    };
  }, []);

  const dialogClassName = [
    "fixed inset-0 m-auto w-[min(480px,calc(100vw-2rem))] overflow-x-hidden rounded-modal border border-border-default bg-surface p-0 text-content shadow-modal backdrop:bg-overlay",
    scroll === "contained"
      ? "modal-contained max-h-[calc(100dvh-3rem)] overflow-hidden"
      : "max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain",
    presentation === "responsive" ? "modal-responsive" : "",
    dismissalPolicy.backdrop
      ? "backdrop:cursor-pointer"
      : "backdrop:cursor-not-allowed",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <div
      data-modal-scroll-region={scroll === "contained" ? "" : undefined}
      className={
        scroll === "contained"
          ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
          : undefined
      }
    >
      {children}
    </div>
  );

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      tabIndex={-1}
      data-presentation={presentation}
      data-scroll={scroll}
      className={dialogClassName}
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
        if (dismissalPolicy.escape) {
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || !dismissalPolicy.backdrop) {
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
      <div
        data-modal-header
        className={`grid items-start gap-4 border-b border-border-default bg-surface px-6 py-5 ${
          presentation === "responsive"
            ? "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]"
            : "grid-cols-[minmax(0,1fr)_auto]"
        } ${scroll === "contained" ? "sticky top-0 z-10 shrink-0" : ""}`}
      >
        <div className="min-w-0">
          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="wrap-anywhere rounded-control text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
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
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          {headerActions}
          <button
            type="button"
            disabled={!dismissalPolicy.closeButton}
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover hover:text-content disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <LuX aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>
      {content}
    </dialog>,
    document.body,
  );
}
