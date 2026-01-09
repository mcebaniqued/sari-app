import { Slide, ToastContainerProps, ToastOptions } from "react-toastify";
import { ToastKind } from "./toastTypes";

export const BASE_TOAST_CONFIG: ToastOptions = {
  autoClose: 3000,
  closeButton: true,
};

export const TOAST_CONTAINER_CONFIG: ToastContainerProps = {
  position: "bottom-center",
  limit: 1,
  autoClose: 3000,
  transition: Slide,
  closeOnClick: true,
  pauseOnHover: true,
  pauseOnFocusLoss: true,
  draggable: false,
  hideProgressBar: true,
  icon: false,
  toastClassName: "shadow-sm border border-[rgb(var(--border))]",
  theme: "light", // Force light theme since dark mode is handled by CSS variables
};

export const TOAST_KIND_CONFIG: Record<ToastKind, ToastOptions> = {
  success: {
    className: "border-1 border-green-500/50"
  },
  info: {
    className: "border-1 border-blue-500/50"
  },
  error: {
    className: "border-1 border-red-500/50",
    autoClose: 5000, // Error toasts may need user attention for longer
  },
};
