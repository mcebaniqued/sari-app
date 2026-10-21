import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "@/api/apiFetch";

/** Keep HTTP transport independent of routing; handle forbidden outcomes at the UI boundary. */
export function useAccessDenied() {
  const navigate = useNavigate();

  return useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError) || error.status !== 403) {
        return false;
      }

      void navigate("/access-denied", { replace: true });

      return true;
    },
    [navigate],
  );
}
