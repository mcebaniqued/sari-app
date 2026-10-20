import { createElement } from "react";
import { toast } from "react-toastify/unstyled";

import Toast, { type NotificationTone } from "./Toast";

/** Call after the final outcome. IDs prevent duplicate notices while one is visible. */
export function notify(tone: NotificationTone, message: string, id?: string) {
  return toast((props) => createElement(Toast, props), {
    type: tone,
    data: { message, tone },
    role: tone === "error" ? "alert" : "status",
    ...(id ? { toastId: id } : {}),
  });
}
