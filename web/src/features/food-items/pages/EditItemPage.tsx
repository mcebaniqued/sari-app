import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { LuArrowLeft } from "react-icons/lu";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "@/components/Modal/Modal";
import { useAccessDenied } from "@/hooks/useAccessDenied";
import FoodItemEditor from "../components/FoodItemEditor/FoodItemEditor";
import { useItemDetails } from "../hooks/useItemDetails";
import { useSaveFoodItem } from "../hooks/useSaveFoodItem";
import {
  invalidatePantryContext,
  type PantryRouteNavigationState,
  restorePantryItemFocus,
} from "../pantryRouteNavigation";

const constrainedViewportQuery = "(max-width: 40rem), (max-height: 32rem)";

function subscribeToConstrainedViewport(onChange: () => void) {
  const media = window.matchMedia(constrainedViewportQuery);
  media.addEventListener("change", onChange);

  return () => {
    media.removeEventListener("change", onChange);
  };
}

function constrainedViewportSnapshot() {
  return window.matchMedia(constrainedViewportQuery).matches;
}

function useConstrainedViewport() {
  return useSyncExternalStore(
    subscribeToConstrainedViewport,
    constrainedViewportSnapshot,
    () => false,
  );
}

interface EditItemPageProps {
  contextual?: boolean;
  navigationState?: PantryRouteNavigationState;
  seedItem?: FoodItem;
}

interface LoadStateProps {
  contextualPage: boolean;
  message: string;
  onBack: () => void;
  onRetry?: () => void;
  presentation: "modal" | "page";
  title: string;
}

function LoadState({
  contextualPage,
  message,
  onBack,
  onRetry,
  presentation,
  title,
}: LoadStateProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (presentation === "page") {
      heading.current?.focus({ preventScroll: true });
    }
  }, [presentation, title]);

  const content = (
    <div className="space-y-4 px-6 py-6">
      <p role={onRetry ? "alert" : "status"}>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-control border border-border-default bg-surface px-4 font-medium"
        >
          Try again
        </button>
      )}
    </div>
  );

  if (presentation === "modal") {
    return (
      <Modal title={title} onClose={onBack}>
        {content}
      </Modal>
    );
  }

  return (
    <article
      className={
        contextualPage
          ? "fixed inset-0 z-40 overflow-y-auto overscroll-none bg-page px-[max(1rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-content"
          : "mx-auto max-w-3xl"
      }
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-2 rounded-control font-medium text-brand underline-offset-4 hover:underline"
      >
        <LuArrowLeft aria-hidden="true" /> Back
      </button>
      <h1
        ref={heading}
        tabIndex={-1}
        className="mt-4 rounded-control text-3xl font-semibold tracking-tight"
      >
        {title}
      </h1>
      <div className="mt-5 overflow-hidden rounded-panel border border-border-default bg-surface">
        {content}
      </div>
    </article>
  );
}

export default function EditItemPage({
  contextual = false,
  navigationState,
  seedItem,
}: EditItemPageProps) {
  const navigate = useNavigate();
  const handleAccessDenied = useAccessDenied();
  const [completedSave, setCompletedSave] = useState<FoodItem | null>(null);
  const finishStarted = useRef(false);
  const { itemId = "" } = useParams();
  const constrained = useConstrainedViewport();
  const details = useItemDetails(itemId, seedItem, handleAccessDenied, {
    verifySeed: false,
  });
  const contextualPage = contextual && constrained;
  const presentation = contextual && !constrained ? "modal" : "page";
  const onChanged = useCallback(() => {
    if (navigationState) {
      invalidatePantryContext(navigationState.pantryContextId);
    }
  }, [navigationState]);
  const mutation = useSaveFoodItem(onChanged);
  const detailsPath = `/pantry/items/${itemId}`;

  useEffect(() => {
    if (!contextual) {
      const previousTitle = document.title;
      document.title = "Edit item | Sari";

      return () => {
        document.title = previousTitle;
      };
    }
  }, [contextual]);

  useLayoutEffect(() => {
    if (!contextualPage) {
      return;
    }

    const background = document.querySelector<HTMLElement>(
      "[data-route-background]",
    );
    if (!background) {
      return;
    }

    background.inert = true;

    return () => {
      background.inert = false;
    };
  }, [contextualPage]);

  const close = useCallback(() => {
    if (contextual) {
      if (navigationState?.editOrigin === "pantry") {
        restorePantryItemFocus(navigationState.pantryContextId, itemId);
      }
      void navigate(-1);
    } else {
      void navigate(detailsPath, { replace: true });
    }
  }, [contextual, detailsPath, itemId, navigate, navigationState]);

  const finish = useCallback(
    (saved: FoodItem) => {
      if (contextual && navigationState?.editOrigin === "details") {
        void navigate(detailsPath, {
          replace: true,
          state: { ...navigationState, completedEdit: saved, seedItem: saved },
        });

        return;
      }

      void navigate(detailsPath, {
        replace: true,
        ...(contextual && navigationState
          ? {
              state: {
                ...navigationState,
                seedItem: saved,
              },
            }
          : {}),
      });
    },
    [contextual, detailsPath, navigate, navigationState],
  );

  useEffect(() => {
    if (completedSave && !finishStarted.current) {
      finishStarted.current = true;
      finish(completedSave);
    }
  }, [completedSave, finish]);

  if (details.invalid) {
    return (
      <LoadState
        contextualPage={contextualPage}
        message="This item link is invalid. Check the address or return to your pantry."
        onBack={close}
        presentation={presentation}
        title="Invalid item link"
      />
    );
  }

  if (details.unavailable) {
    return (
      <LoadState
        contextualPage={contextualPage}
        message="This item may have been deleted or is not available in this pantry."
        onBack={close}
        presentation={presentation}
        title="Item unavailable"
      />
    );
  }

  if (!details.item && details.loading) {
    return (
      <LoadState
        contextualPage={contextualPage}
        message="Loading item for editing…"
        onBack={close}
        presentation={presentation}
        title="Edit item"
      />
    );
  }

  const loadError = details.initialError || details.verificationError;
  if (!details.item) {
    return (
      <LoadState
        contextualPage={contextualPage}
        message={loadError || "Unable to load this item. Please try again."}
        onBack={close}
        onRetry={details.retry}
        presentation={presentation}
        title="Unable to edit item"
      />
    );
  }

  const item = details.item;

  async function save(values: CreateFoodItem, expectedRevision: number | null) {
    const saved = await mutation.saveItem(item, values, expectedRevision);
    setCompletedSave(saved);
  }

  return (
    <FoodItemEditor
      busy={mutation.busy}
      contextualPage={contextualPage}
      item={item}
      navigationReady={Boolean(completedSave)}
      onClose={close}
      onKeepSavedAndClose={(saved) => {
        onChanged();
        setCompletedSave(saved);
      }}
      onSave={save}
      presentation={presentation}
    />
  );
}
