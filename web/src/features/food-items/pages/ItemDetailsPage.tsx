import type { FoodItem } from "@sari/contracts";
import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Modal from "@/components/Modal/Modal";
import ExpirationStatus from "../components/Inventory/ExpirationStatus";
import ItemDetailsContent from "../components/ItemDetails/ItemDetailsContent";
import { useItemDetails } from "../hooks/useItemDetails";
import { useLocalDay } from "../hooks/useLocalDay";

interface ItemDetailsProps {
  contextual?: boolean;
  seedItem?: FoodItem;
}

export default function ItemDetailsPage({
  contextual = false,
  seedItem,
}: ItemDetailsProps) {
  const navigate = useNavigate();
  const { itemId = "" } = useParams();
  const heading = useRef<HTMLHeadingElement>(null);
  const localDay = useLocalDay();
  const details = useItemDetails(itemId, seedItem);
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

  const content = <ItemDetailsContent {...details} onRetry={details.retry} />;
  const relativeStatus = details.item?.expiresOn ? (
    <ExpirationStatus
      expiresOn={details.item.expiresOn}
      now={localDay}
      prominentLater
    />
  ) : null;

  if (contextual) {
    return (
      <Modal
        title={title}
        closeButtonTarget="touch"
        headerLayout="inline"
        headerSupportingContent={relativeStatus}
        presentation="responsive"
        scroll="contained"
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
      <h1
        ref={heading}
        tabIndex={-1}
        className="mt-4 wrap-anywhere rounded-control text-3xl font-semibold tracking-tight"
      >
        {title}
      </h1>
      {relativeStatus && <div className="mt-1.5">{relativeStatus}</div>}
      <div className="mt-5">{content}</div>
    </article>
  );
}
