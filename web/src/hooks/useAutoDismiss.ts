import { useEffect, useRef } from "react";

interface AutoDismissOptions {
  duration: number | false;
  paused: boolean;
  onDismiss: () => void;
}

/** A cancellable countdown that preserves remaining time across hover/focus pauses. */
export function useAutoDismiss({
  duration,
  paused,
  onDismiss,
}: AutoDismissOptions) {
  const countdown = useRef({
    duration,
    remaining: duration === false ? 0 : duration,
  });
  useEffect(() => {
    if (countdown.current.duration !== duration) {
      countdown.current = {
        duration,
        remaining: duration === false ? 0 : duration,
      };
    }
    if (duration === false || paused) {
      return;
    }

    const startedAt = Date.now();
    const timer = window.setTimeout(onDismiss, countdown.current.remaining);

    return () => {
      window.clearTimeout(timer);
      countdown.current.remaining = Math.max(
        0,
        countdown.current.remaining - (Date.now() - startedAt),
      );
    };
  }, [duration, paused, onDismiss]);
}
