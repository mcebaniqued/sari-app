"use client";

import { useEffect, useId, useRef } from "react";
import { FaXmark } from "react-icons/fa6";

type ModalProps = {
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  closeOnBackdrop?: boolean;
};

export default function Modal({
  title,
  children,
  onClose,
  closeOnBackdrop = true,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    // Basic focus management
    panelRef.current?.focus();

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/50"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      {/* Wrapper should NOT block backdrop clicks */}
      <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-0 md:p-6 pointer-events-none">
        {/* Panel re-enables interaction */}
        <div
          ref={panelRef}
          tabIndex={-1}
          className="
            pointer-events-auto
            w-full h-[85vh] md:h-auto
            md:max-w-xl
            bg-[rgb(var(--card))] text-[rgb(var(--card-foreground))]
            border border-[rgb(var(--border))]
            shadow-xl
            rounded-t-2xl md:rounded-2xl
            outline-none
            flex flex-col
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
            <h2 id={titleId} className="text-base font-semibold">
              {title ?? ""}
            </h2>

            <button
              type="button"
              className="
                inline-flex items-center justify-center
                rounded-md
                border border-[rgb(var(--border))]
                bg-[rgb(var(--card))]
                w-9 h-9
              "
              onClick={onClose}
              aria-label="Close"
            >
              <FaXmark className="text-lg" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
