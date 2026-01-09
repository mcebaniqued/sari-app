import { toast } from "react-toastify";
import { BASE_TOAST_CONFIG, TOAST_KIND_CONFIG } from "./toastConfig";

export function notifyInfo(title: string,) {
  toast.info(title, {
    ...BASE_TOAST_CONFIG,
    ...TOAST_KIND_CONFIG.info,
  });
};

export function notifySuccess(title: string) {
  toast.success(title, {
    ...BASE_TOAST_CONFIG,
    ...TOAST_KIND_CONFIG.success,
  });
};

export function notifyError(title: string) {
  toast.error(title, {
    ...BASE_TOAST_CONFIG,
    ...TOAST_KIND_CONFIG.error,
  });
};
