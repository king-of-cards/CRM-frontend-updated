import { useCallback, useEffect, useState } from "react";
import { getFollowUpReminders } from "../../api/reminders.js";

export default function useFollowUpReminders({ dhruva = false, days = 7 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const result = await getFollowUpReminders({ dhruva, days });
      setData(result);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dhruva, days]);

  useEffect(() => {
    let timer = null;
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const start = () => {
      if (document.visibilityState !== "visible" || timer) return;
      refresh();
      timer = setInterval(refresh, 30_000);
    };
    const onFocus = () => refresh();
    const onVisibility = () => document.visibilityState === "visible" ? start() : stop();
    start();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisibility); };
  }, [refresh]);

  return { data, loading, error, refresh };
}
