'use client';

import { TOAST_CONTAINER_CONFIG } from "@/lib/ui/toast/toastConfig";
import { ToastContainer } from "react-toastify";

export default function ToastContainerClient() {
  return <ToastContainer {...TOAST_CONTAINER_CONFIG} />;
};
