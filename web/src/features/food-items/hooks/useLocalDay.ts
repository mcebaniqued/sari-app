import { useEffect, useState } from "react";

export function useLocalDay() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout>;

    function refresh() {
      const current = new Date();
      setNow(current);
      clearTimeout(midnightTimer);
      const nextMidnight = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate() + 1,
      );
      midnightTimer = setTimeout(
        refresh,
        nextMidnight.getTime() - current.getTime(),
      );
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    refresh();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refresh);

    return () => {
      clearTimeout(midnightTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return now;
}
