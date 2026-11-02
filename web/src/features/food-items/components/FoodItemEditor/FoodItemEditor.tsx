import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { LuArrowLeft } from "react-icons/lu";
import Modal from "@/components/Modal/Modal";
import { useUnsavedChangesGuard } from "@/contexts/UnsavedChangesGuard";
import { useFoodItemEditorSession } from "../../hooks/useFoodItemEditorSession";
import FoodItemForm from "../FoodItemForm/FoodItemForm";

const constrainedViewportQuery = "(max-width: 40rem), (max-height: 32rem)";

interface FoodItemEditorProps {
  busy: boolean;
  contextualPage?: boolean;
  item: FoodItem | null;
  navigationReady?: boolean;
  onClose: () => void;
  onKeepSavedAndClose: (item: FoodItem) => void;
  onRestoreFocusFallback?: () => void;
  onSave: (
    values: CreateFoodItem,
    expectedRevision: number | null,
  ) => Promise<void>;
  presentation: "modal" | "page";
}

interface DiscardConfirmation {
  focusTarget: FocusTarget | null;
  onDiscard: () => void;
  onContinue: () => void;
}

interface FocusTarget {
  ariaLabel: string | null;
  editorKey: string | null;
  id: string;
  tagName: string;
  text: string;
}

function focusTarget(element: HTMLElement): FocusTarget {
  return {
    ariaLabel: element.getAttribute("aria-label"),
    editorKey: element.dataset.editorFocus ?? null,
    id: element.id,
    tagName: element.tagName,
    text: element.textContent.trim(),
  };
}

function findFocusTarget(target: FocusTarget | null) {
  if (!target) {
    return null;
  }

  return target.editorKey
    ? document.querySelector<HTMLElement>(
        `[data-editor-focus="${target.editorKey}"]`,
      )
    : target.id
      ? document.getElementById(target.id)
      : target.ariaLabel
        ? [...document.querySelectorAll<HTMLElement>("[aria-label]")].find(
            (element) =>
              element.getAttribute("aria-label") === target.ariaLabel,
          )
        : ([...document.querySelectorAll<HTMLElement>(target.tagName)].find(
            (element) => element.textContent.trim() === target.text,
          ) ?? null);
}

function escapeBelongsToNestedControl(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      'input[type="date"], select, [role="combobox"], [role="listbox"], [role="menu"], [aria-expanded="true"]',
    ),
  );
}

export default function FoodItemEditor({
  busy,
  contextualPage = false,
  item,
  navigationReady = false,
  onClose,
  onKeepSavedAndClose,
  onRestoreFocusFallback,
  onSave,
  presentation,
}: FoodItemEditorProps) {
  const [confirmation, setConfirmation] = useState<DiscardConfirmation | null>(
    null,
  );
  const editContent = useRef<HTMLDivElement>(null);
  const discardApproved = useRef(false);
  const lastEditFocus = useRef<HTMLElement | null>(null);
  const pendingConfirmationFocus = useRef<FocusTarget | null>(null);
  const invokingFocus = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const confirmationWasOpen = useRef(false);
  const latestPresentation = useRef(presentation);
  const navigationReadyRef = useRef(navigationReady);
  const pageSurface = useRef<HTMLElement>(null);
  const responsiveFocusTarget = useRef<FocusTarget | null>(null);
  const session = useFoodItemEditorSession({
    disabled: busy,
    item,
    onSave,
  });
  const { dirty, recoveryState } = session;

  useLayoutEffect(() => {
    latestPresentation.current = presentation;
    navigationReadyRef.current = navigationReady;
  }, [navigationReady, presentation]);

  useLayoutEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia(constrainedViewportQuery);
    const captureResponsiveFocus = () => {
      const active = document.activeElement;
      const editor = editContent.current;
      const dialog = editor?.closest("dialog");

      if (
        active instanceof HTMLElement &&
        (editor?.contains(active) || dialog?.contains(active))
      ) {
        responsiveFocusTarget.current = focusTarget(active);
      }
    };

    media.addEventListener("change", captureResponsiveFocus);

    return () => {
      media.removeEventListener("change", captureResponsiveFocus);
    };
  }, []);

  const requestDiscard = useCallback(
    (
      onDiscard: () => void = onClose,
      onContinue: () => void = () => void 0,
    ) => {
      if (navigationReadyRef.current || discardApproved.current) {
        onDiscard();

        return;
      }
      if (busy) {
        onContinue();

        return;
      }
      if (!item || (!dirty && recoveryState === "editing")) {
        onDiscard();

        return;
      }

      const active = document.activeElement;
      const editor = editContent.current;
      const dialog = editor?.closest("dialog");
      const focus =
        active instanceof HTMLElement &&
        (editor?.contains(active) || dialog?.contains(active)) &&
        active !== editor &&
        active !== dialog
          ? active
          : lastEditFocus.current;
      setConfirmation({
        focusTarget: focus ? focusTarget(focus) : null,
        onDiscard,
        onContinue,
      });
    },
    [busy, dirty, item, onClose, recoveryState],
  );

  useUnsavedChangesGuard(
    Boolean(item && (dirty || recoveryState !== "editing")),
    requestDiscard,
  );

  useLayoutEffect(() => {
    const surface = pageSurface.current;
    if (presentation !== "page" || !surface) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        event.isComposing ||
        escapeBelongsToNestedControl(event.target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      requestDiscard();
    };

    surface.addEventListener("keydown", handleEscape);

    return () => {
      surface.removeEventListener("keydown", handleEscape);
    };
  }, [confirmation, presentation, requestDiscard]);

  useLayoutEffect(() => {
    if (confirmation) {
      continueButton.current?.focus();
    } else if (presentation === "modal" && pendingConfirmationFocus.current) {
      findFocusTarget(pendingConfirmationFocus.current)?.focus();
      pendingConfirmationFocus.current = null;
    }
  }, [confirmation, presentation]);

  useEffect(() => {
    if (confirmation) {
      confirmationWasOpen.current = true;

      return;
    }
    if (!confirmationWasOpen.current) {
      return;
    }
    confirmationWasOpen.current = false;
    if (presentation === "modal") {
      return;
    }

    let restoreFrame = 0;
    const settleFrame = requestAnimationFrame(() => {
      restoreFrame = requestAnimationFrame(() => {
        findFocusTarget(pendingConfirmationFocus.current)?.focus();
        pendingConfirmationFocus.current = null;
      });
    });

    return () => {
      cancelAnimationFrame(settleFrame);
      cancelAnimationFrame(restoreFrame);
    };
  }, [confirmation, presentation]);

  useLayoutEffect(() => {
    if (!responsiveFocusTarget.current && presentation === "page") {
      pageHeading.current?.focus({ preventScroll: true });
    }
  }, [presentation]);

  useEffect(() => {
    if (confirmation) {
      return;
    }

    const restored = findFocusTarget(responsiveFocusTarget.current);
    responsiveFocusTarget.current = null;
    if (
      restored?.isConnected &&
      !restored.closest("[inert], [hidden], [aria-hidden='true']")
    ) {
      restored.focus({ preventScroll: true });
    }
  }, [confirmation, presentation]);

  useLayoutEffect(() => {
    if (
      recoveryState !== "review-conflict" &&
      recoveryState !== "review-uncertain" &&
      recoveryState !== "unavailable"
    ) {
      return;
    }

    if (presentation === "modal") {
      editContent.current
        ?.closest("dialog")
        ?.querySelector<HTMLElement>("[data-modal-header] h2")
        ?.focus();
    } else {
      pageHeading.current?.focus();
    }
  }, [presentation, recoveryState]);

  useEffect(
    () => () => {
      if (
        latestPresentation.current === "page" &&
        invokingFocus.current?.isConnected
      ) {
        invokingFocus.current.focus();
      }
    },
    [],
  );

  function continueEditing() {
    pendingConfirmationFocus.current = confirmation?.focusTarget ?? null;
    confirmation?.onContinue();
    setConfirmation(null);
  }

  const dedicatedRecovery =
    recoveryState === "review-conflict" ||
    recoveryState === "review-uncertain" ||
    recoveryState === "unavailable";
  const title = confirmation
    ? "Discard changes?"
    : recoveryState === "review-conflict"
      ? "Review changes"
      : recoveryState === "review-uncertain"
        ? "Review saved version"
        : recoveryState === "unavailable"
          ? "Item unavailable"
          : item
            ? "Edit item"
            : "Add item";
  const description = confirmation
    ? "Your unsaved changes will be lost."
    : recoveryState === "review-conflict"
      ? "Compare your edits with the latest saved version."
      : recoveryState === "review-uncertain"
        ? "Compare your edits with the version Sari can currently read."
        : recoveryState === "unavailable"
          ? "Review or copy your unsaved draft before closing."
          : item
            ? "Update the details of your pantry item."
            : "Add something you have on hand.";
  const form = (
    <div
      ref={editContent}
      onFocusCapture={(event) => {
        lastEditFocus.current = event.target;
      }}
    >
      <FoodItemForm
        disabled={busy}
        onCancel={() => {
          requestDiscard();
        }}
        onDiscardAndClose={() => {
          discardApproved.current = true;
          onClose();
        }}
        onKeepSavedAndClose={onKeepSavedAndClose}
        session={session}
      />
    </div>
  );

  if (confirmation) {
    return (
      <Modal
        title={title}
        description={description}
        onClose={continueEditing}
        onRestoreFocusFallback={onRestoreFocusFallback}
      >
        <div className="space-y-5 px-6 py-6">
          <p className="text-sm leading-relaxed text-content-muted">
            Continue editing to keep your draft, or discard it to complete the
            action you requested.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              ref={continueButton}
              data-autofocus
              type="button"
              onClick={continueEditing}
              className="min-h-11 rounded-control border border-border-default bg-surface px-4 py-2.5 text-sm font-medium text-content hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Continue editing
            </button>
            <button
              type="button"
              onClick={() => {
                discardApproved.current = true;
                confirmation.onDiscard();
              }}
              className="min-h-11 rounded-control border border-danger-border bg-danger px-4 py-2.5 text-sm font-semibold text-content-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Discard changes
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (presentation === "modal") {
    return (
      <Modal
        title={title}
        description={description}
        onClose={() => {
          requestDiscard();
        }}
        onRestoreFocusFallback={onRestoreFocusFallback}
        presentation={dedicatedRecovery ? "responsive" : "centered"}
        scroll={dedicatedRecovery ? "contained" : "dialog"}
        dismissal={
          dedicatedRecovery
            ? { backdrop: false, closeButton: !busy, escape: !busy }
            : { backdrop: !busy, closeButton: !busy, escape: !busy }
        }
      >
        {form}
      </Modal>
    );
  }

  return (
    <article
      ref={pageSurface}
      className={
        contextualPage
          ? "fixed inset-0 z-40 overflow-y-auto overscroll-none scroll-pb-[max(1rem,env(safe-area-inset-bottom))] bg-page text-content"
          : "mx-auto max-w-3xl"
      }
    >
      <header
        className={
          contextualPage
            ? "sticky top-0 z-10 border-b border-border-default bg-page pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-4 pl-[max(1rem,env(safe-area-inset-left))]"
            : "border-b border-border-default pb-5"
        }
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            requestDiscard();
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-control font-medium text-brand underline-offset-4 hover:underline disabled:opacity-50"
        >
          <LuArrowLeft aria-hidden="true" /> Back
        </button>
        <h1
          ref={pageHeading}
          tabIndex={-1}
          className="mt-2 rounded-control text-3xl font-semibold tracking-tight"
        >
          {title}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-content-muted">
          {description}
        </p>
      </header>
      <div
        className={
          contextualPage
            ? "mx-auto max-w-3xl pr-[env(safe-area-inset-right)] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)]"
            : "mt-5 overflow-hidden rounded-panel border border-border-default bg-surface"
        }
      >
        {form}
      </div>
    </article>
  );
}
