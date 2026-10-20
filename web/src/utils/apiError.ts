import { ApiError } from "@/api/apiFetch";

/** Convert transport failures into UI copy without exposing internal validation details. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof TypeError) {
    return "Could not reach your pantry. Check your connection and try again.";
  }
  return fallback;
}
