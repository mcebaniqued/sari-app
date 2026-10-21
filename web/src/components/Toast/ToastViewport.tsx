import { useEffect, useEffectEvent } from "react";
import { LuX } from "react-icons/lu";
import {
  type CloseButtonProps,
  toast,
  ToastContainer,
  type ToastTransitionProps,
} from "react-toastify/unstyled";

// No motion or CSS animation dependency; dismissal also respects reduced-motion users.
function InstantTransition(props: ToastTransitionProps) {
  const enter = useEffectEvent(() => {
    props.playToast();
  });
  const exit = useEffectEvent(() => {
    props.done();
  });
  useEffect(() => {
    if (props.isIn) {
      enter();
    } else {
      exit();
    }
  }, [props.isIn]);

  return <>{props.children}</>;
}

function CloseButton({ closeToast }: CloseButtonProps) {
  return (
    <button
      type="button"
      aria-label="Dismiss notification"
      onClick={closeToast}
      onFocus={({ currentTarget }) => {
        const id = currentTarget.parentElement?.id;
        if (id) {
          toast.pause({ id });
        }
      }}
      onBlur={({ currentTarget }) => {
        const id = currentTarget.parentElement?.id;
        if (id) {
          toast.play({ id });
        }
      }}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand"
    >
      <LuX aria-hidden="true" />
    </button>
  );
}

export default function ToastViewport() {
  return (
    <ToastContainer
      aria-label="Notifications (Alt+T)"
      position="bottom-center"
      limit={3}
      autoClose={5000}
      customProgressBar
      pauseOnHover
      pauseOnFocusLoss
      hideProgressBar
      icon={false}
      closeButton={CloseButton}
      transition={InstantTransition}
      draggable={false}
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-3"
      toastClassName="pointer-events-auto flex min-h-16 items-center gap-3 rounded-panel border border-border-default bg-surface p-4 text-content shadow-lg"
    />
  );
}
