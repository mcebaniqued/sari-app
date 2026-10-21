import type { AuthUser } from "@sari/contracts";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSession, signOut } from "../api/authApi";
import { AuthContext } from "./AuthContext";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // A response must belong to the current session version, even after an account switch.
  const version = useRef(0);
  const request = useRef<AbortController | null>(null);

  const invalidateSessionRequest = useCallback(() => {
    ++version.current;
    request.current?.abort();
  }, []);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++version.current;

    try {
      const session = await getSession(controller.signal);
      if (version.current === current) {
        setUser(session?.user ?? null);
        setError("");
      }
    } catch {
      if (!controller.signal.aborted && version.current === current) {
        setUser(null);
        setError(
          "Could not check your session. Check your connection and try again.",
        );
      }
    } finally {
      if (!controller.signal.aborted && version.current === current) {
        setLoading(false);
      }
    }
  }, []);

  const signedIn = useCallback(
    (nextUser: AuthUser) => {
      invalidateSessionRequest();
      setUser(nextUser);
      setError("");
      setLoading(false);
    },
    [invalidateSessionRequest],
  );

  const logout = useCallback(async () => {
    await signOut();
    invalidateSessionRequest();
    setUser(null);
    setError("");
  }, [invalidateSessionRequest]);

  useEffect(() => {
    const expired = () => {
      invalidateSessionRequest();
      setUser(null);
      setError("");
      setLoading(false);
    };

    const recheck = () => {
      void refresh();
    };

    const initialCheck = window.setTimeout(() => {
      void refresh();
    }, 0);
    window.addEventListener("sari:unauthorized", expired);
    window.addEventListener("focus", recheck);

    return () => {
      window.clearTimeout(initialCheck);
      request.current?.abort();
      window.removeEventListener("sari:unauthorized", expired);
      window.removeEventListener("focus", recheck);
    };
  }, [refresh, invalidateSessionRequest]);

  // Key the subtree so changing accounts discards every pantry cache and draft.
  return (
    <AuthContext value={{ user, loading, error, refresh, signedIn, logout }}>
      <div key={user?.id ?? "signed-out"}>{children}</div>
    </AuthContext>
  );
}
