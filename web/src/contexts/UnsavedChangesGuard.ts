import { createContext, useCallback, useContext, useEffect } from "react";

export interface UnsavedChangesGuard {
  requestDiscard: (onDiscard: () => void, onContinue: () => void) => void;
}

export const UnsavedChangesContext = createContext<
  ((guard: UnsavedChangesGuard | null) => void) | null
>(null);

export function useUnsavedChangesGuard(
  active: boolean,
  requestDiscard: UnsavedChangesGuard["requestDiscard"],
) {
  const register = useContext(UnsavedChangesContext);

  useEffect(() => {
    if (!register || !active) {
      return;
    }

    const guard = { requestDiscard };
    register(guard);

    return () => {
      register(null);
    };
  }, [active, register, requestDiscard]);

  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (active) {
        event.preventDefault();
      }
    },
    [active],
  );

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload, {
      capture: true,
    });

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload, {
        capture: true,
      });
    };
  }, [handleBeforeUnload]);
}
