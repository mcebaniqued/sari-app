import type { FoodItem } from "@sari/contracts";
import { useEffect, useRef } from "react";
import { LuPencil } from "react-icons/lu";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Modal from "@/components/Modal/Modal";
import { useAccessDenied } from "@/hooks/useAccessDenied";
import ExpirationStatus from "../components/Inventory/ExpirationStatus";
import ItemDetailsContent from "../components/ItemDetails/ItemDetailsContent";
import { useItemDetails } from "../hooks/useItemDetails";
import { useLocalDay } from "../hooks/useLocalDay";
import {
  type PantryRouteNavigationState,
  restorePantryItemFocus,
} from "../pantryRouteNavigation";

interface ItemDetailsProps {
  contextual?: boolean;
  navigationState?: PantryRouteNavigationState;
  seedItem?: FoodItem;
}

export default function ItemDetailsPage({
  contextual = false,
  navigationState,
  seedItem,
}: ItemDetailsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const handleAccessDenied = useAccessDenied();
  const { itemId = "" } = useParams();
  const heading = useRef<HTMLHeadingElement>(null);
  const returnAfterCompletedEdit = useRef(false);
  const localDay = useLocalDay();
  const details = useItemDetails(itemId, seedItem, handleAccessDenied);
  const title = details.invalid
    ? "Invalid item link"
    : details.unavailable
      ? "Item unavailable"
      : (details.item?.name ?? "Item details");

  useEffect(() => {
    if (contextual) {
      return;
    }
    const previousTitle = document.title;
    document.title = `${title} | Sari`;

    return () => {
      document.title = previousTitle;
    };
  }, [contextual, title]);

  useEffect(() => {
    if (!contextual) {
      heading.current?.focus({ preventScroll: true });
    }
  }, [contextual, itemId]);

  useEffect(() => {
    if (!contextual || !navigationState) {
      return;
    }

    if (navigationState.completedEdit) {
      const saved = navigationState.completedEdit;
      returnAfterCompletedEdit.current = true;
      void navigate(location.pathname, {
        replace: true,
        state: {
          ...navigationState,
          completedEdit: undefined,
          editOrigin: undefined,
          seedItem: saved,
        },
      });

      return;
    }

    if (returnAfterCompletedEdit.current) {
      returnAfterCompletedEdit.current = false;
      void navigate(-1);
    }
  }, [contextual, location.pathname, navigate, navigationState]);

  const content = <ItemDetailsContent {...details} onRetry={details.retry} />;
  const relativeStatus = details.item?.expiresOn ? (
    <ExpirationStatus
      expiresOn={details.item.expiresOn}
      now={localDay}
      prominentLater
    />
  ) : null;
  const canEdit = Boolean(details.item && !details.unavailable);
  const editButton = (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => {
        if (!details.item) {
          return;
        }
        void navigate(`/pantry/items/${details.item.id}/edit`, {
          ...(contextual && navigationState
            ? {
                state: {
                  ...navigationState,
                  editOrigin: "details",
                  seedItem: details.item,
                },
              }
            : {}),
        });
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border-default bg-surface px-3 text-sm font-medium hover:bg-surface-hover disabled:opacity-50"
    >
      <LuPencil aria-hidden="true" /> Edit
    </button>
  );

  if (contextual) {
    return (
      <Modal
        title={title}
        closeButtonTarget="touch"
        headerActions={editButton}
        headerLayout="inline"
        headerSupportingContent={relativeStatus}
        presentation="responsive"
        scroll="contained"
        onRestoreFocusFallback={
          navigationState?.editOrigin === "pantry"
            ? () => {
                restorePantryItemFocus(
                  navigationState.pantryContextId,
                  navigationState.seedItem.id,
                );
              }
            : undefined
        }
        onClose={() => {
          void navigate(-1);
        }}
      >
        <div className="px-6 py-5">{content}</div>
      </Modal>
    );
  }

  return (
    <article className="mx-auto max-w-3xl">
      <Link
        to="/pantry"
        className="inline-flex min-h-11 items-center rounded-control font-medium text-brand underline-offset-4 hover:underline"
      >
        Back to pantry
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <h1
          ref={heading}
          tabIndex={-1}
          className="min-w-0 flex-1 wrap-anywhere rounded-control text-3xl font-semibold tracking-tight"
        >
          {title}
        </h1>
        {editButton}
      </div>
      {relativeStatus && <div className="mt-1.5">{relativeStatus}</div>}
      <div className="mt-5">{content}</div>
    </article>
  );
}
