import { useEffect, useId, useRef, useState } from "react";
import { LuChevronDown, LuLogOut, LuUserRound } from "react-icons/lu";

export default function UserMenu({
  firstName,
  onLogout,
}: {
  firstName: string;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const id = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    action.current?.focus();

    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", outside);

    return () => {
      window.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  async function logout() {
    if (pending.current) {
      return;
    }

    pending.current = true;
    setBusy(true);
    setError("");

    try {
      await onLogout();
    } catch {
      setError("Could not log out. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={`User menu for ${firstName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex max-w-56 items-center gap-2 rounded-control px-3 py-2 text-sm font-medium hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <LuUserRound aria-hidden="true" className="size-5 shrink-0" />
        <span className="truncate">{firstName}</span>
        <LuChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-60 rounded-panel border border-border-default bg-surface p-1.5 shadow-modal">
          <div
            id={id}
            role="menu"
            tabIndex={-1}
            aria-label="User menu"
            onBlur={(event) => {
              if (!root.current?.contains(event.relatedTarget)) {
                setOpen(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                setOpen(false);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                trigger.current?.focus();
              }
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                action.current?.focus();
              }
            }}
          >
            <button
              ref={action}
              role="menuitem"
              type="button"
              aria-disabled={busy}
              onClick={() => {
                void logout();
              }}
              className="flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-left text-sm hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand"
            >
              <LuLogOut aria-hidden="true" className="size-4" />
              {busy ? "Logging out…" : "Log out"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="p-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
