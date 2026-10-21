import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthBoundary({
  publicOnly = false,
}: {
  publicOnly?: boolean;
}) {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <p role="status" className="p-8 text-center text-content-muted">
        Checking your session…
      </p>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p role="alert">{error}</p>
        <button
          className="mt-4 rounded-control bg-brand px-4 py-2 text-content-inverse"
          onClick={() => {
            void refresh();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (publicOnly) {
    return user ? <Navigate to="/pantry" replace /> : <Outlet />;
  }

  return user ? (
    <Outlet />
  ) : (
    <Navigate
      to="/login"
      replace
      state={{
        returnTo: `${location.pathname}${location.search}${location.hash}`,
      }}
    />
  );
}
