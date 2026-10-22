import { useEffect, useState } from "react";

/** Mobile document-scroll navigation; keep the header still during active controls. */
export function useMobileHeader(enabled: boolean) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let anchor = window.scrollY;
    let scrollHeight = document.documentElement.scrollHeight;
    // Layout changes can clamp scrollY and emit a scroll event without user input.
    const rebaseAfterLayout = () => {
      anchor = window.scrollY;
      scrollHeight = document.documentElement.scrollHeight;
    };
    const layoutObserver = new ResizeObserver(rebaseAfterLayout);
    layoutObserver.observe(document.body);

    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) {
        setVisible(true);
        anchor = y;
        scrollHeight = document.documentElement.scrollHeight;
        return;
      }
      const nextScrollHeight = document.documentElement.scrollHeight;
      if (nextScrollHeight !== scrollHeight) {
        anchor = y;
        scrollHeight = nextScrollHeight;
        return;
      }
      const focused = document.activeElement;
      if (
        document.querySelector("dialog[open], [aria-expanded='true']") ||
        (focused instanceof HTMLElement &&
          focused.matches("input, textarea, select"))
      ) {
        anchor = y;
        return;
      }
      if (Math.abs(y - anchor) < 24) {
        return;
      }

      setVisible(y < anchor);
      anchor = y;
    };
    const onFocus = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        document.querySelector("header")?.contains(event.target)
      ) {
        setVisible(true);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocus);

    return () => {
      layoutObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocus);
    };
  }, [enabled]);

  return enabled && window.scrollY >= 80 ? visible : true;
}
