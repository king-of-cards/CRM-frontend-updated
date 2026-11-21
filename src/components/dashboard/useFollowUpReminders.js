import { useCallback, useEffect, useRef, useState } from "react";
import { getFollowUpReminders } from "../../api/reminders.js";
import { reminderRequestFor } from "./reminderUtils.js";

// Follow-ups of one scope only ("" = KOC → Vendors, "vendors", "dhruva", "koc_to_dhruva"); see reminderUtils.js.
// Each answer is kept with the request it belongs to, so another flow's items never show.
export default function useFollowUpReminders({ flow = "", days = 7 } = {}) {
  const { dhruva, sources } = reminderRequestFor(flow);
  const sourcesKey = sources.join(",");
  const requestKey = `${dhruva ? "dhruva" : "general"}:${sourcesKey}:${days}`;
  const [result, setResult] = useState({ key: null, data: null, error: false });
  const currentKey = useRef(requestKey);
  useEffect(() => {
    currentKey.current = requestKey;
  }, [requestKey]);

  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const data = await getFollowUpReminders({ dhruva, days, sources: sourcesKey ? sourcesKey.split(",") : [] });
      if (currentKey.current !== requestKey) return; // a late answer for another flow
      setResult({ key: requestKey, data, error: false });
    } catch {
      if (currentKey.current !== requestKey) return;
      setResult((prev) => ({ key: requestKey, data: prev.key === requestKey ? prev.data : null, error: true }));
    }
  }, [dhruva, sourcesKey, days, requestKey]);

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

  const current = result.key === requestKey;
  return { data: current ? result.data : null, loading: !current, error: current && result.error, refresh };
}
