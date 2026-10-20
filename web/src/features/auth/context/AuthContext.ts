import type { AuthUser } from "@sari/contracts";
import { createContext, useContext } from "react";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  signedIn: (user: AuthUser) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("Authentication provider is missing.");
  }
  return auth;
}
