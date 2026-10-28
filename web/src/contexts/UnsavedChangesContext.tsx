import { type ReactNode, useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";
import {
  UnsavedChangesContext,
  type UnsavedChangesGuard,
} from "./UnsavedChangesGuard";

function NavigationBlocker({ guard }: { guard: UnsavedChangesGuard | null }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      Boolean(guard) &&
      (nextLocation.pathname !== currentLocation.pathname ||
        nextLocation.search !== currentLocation.search ||
        nextLocation.hash !== currentLocation.hash) &&
      nextLocation.pathname !== "/access-denied" &&
      nextLocation.pathname !== "/login",
  );

  useEffect(() => {
    if (blocker.state !== "blocked" || !guard) {
      return;
    }

    guard.requestDiscard(blocker.proceed, blocker.reset);
  }, [blocker, guard]);

  return null;
}

export default function UnsavedChangesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [guard, setGuard] = useState<UnsavedChangesGuard | null>(null);

  return (
    <UnsavedChangesContext.Provider value={setGuard}>
      <NavigationBlocker guard={guard} />
      {children}
    </UnsavedChangesContext.Provider>
  );
}
