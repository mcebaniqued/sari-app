import { Outlet, useLocation } from "react-router-dom";

import AppHeader from "@/components/AppHeader/AppHeader";
import ToastViewport from "@/components/Toast/ToastViewport";
import { useAuth } from "@/features/auth/context/AuthContext";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  return (
    <div className="min-h-dvh bg-page text-content">
      <a
        href="#main-content"
        className="sr-only rounded-control bg-brand px-4 py-2 text-content-inverse focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <AppHeader
        firstName={
          location.pathname === "/pantry" ? user?.firstName : undefined
        }
        onLogout={logout}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-360 px-4 py-8 sm:px-8 lg:px-12"
      >
        <Outlet />
      </main>
      <ToastViewport />
    </div>
  );
}
