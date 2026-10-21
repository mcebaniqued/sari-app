import { LuCircleAlert, LuCircleCheck, LuInfo } from "react-icons/lu";
import type { ToastContentProps } from "react-toastify/unstyled";
import { useAutoDismiss } from "@/hooks/useAutoDismiss";

export type NotificationTone = "success" | "error" | "info" | "warning";
interface ToastData {
  message: string;
  tone: NotificationTone;
}

export default function Toast({
  data,
  isPaused,
  closeToast,
  toastProps,
}: ToastContentProps<ToastData>) {
  // The unstyled Toastify build has no CSS animation to drive its built-in timer.
  useAutoDismiss({
    duration: toastProps.autoClose ?? 5000,
    paused: isPaused,
    onDismiss: closeToast,
  });
  const Icon =
    data.tone === "success"
      ? LuCircleCheck
      : data.tone === "info"
        ? LuInfo
        : LuCircleAlert;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Icon
        aria-hidden="true"
        className={`size-5 shrink-0 ${data.tone === "error" || data.tone === "warning" ? "text-danger" : "text-brand"}`}
      />
      <p className="min-w-0 text-sm leading-6 wrap-anywhere">{data.message}</p>
    </div>
  );
}
