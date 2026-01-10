import { toast } from "react-toastify";
import SariToastContent from "./SariToastContent";
import { BASE_TOAST_CONFIG, TOAST_KIND_CONFIG } from "./toastConfig";

export function notifyInfo(title: string, description?: string) {
  toast.info(
    <SariToastContent title={title} description={description} />,
    {
      ...BASE_TOAST_CONFIG,
      ...TOAST_KIND_CONFIG.info,
    }
  );
};

export function notifySuccess(title: string, description?: string) {
  toast.success(
    <SariToastContent title={title} description={description} />,
    {
      ...BASE_TOAST_CONFIG,
      ...TOAST_KIND_CONFIG.success,
    }
  );
};

export function notifyError(title: string, description?: string) {
  toast.error(
    <SariToastContent title={title} description={description} />,
    {
      ...BASE_TOAST_CONFIG,
      ...TOAST_KIND_CONFIG.error,
    }
  );
};
