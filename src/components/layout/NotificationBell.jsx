import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2, RefreshCw, X } from "lucide-react";
import { useNavigate } from "react-router";
import { useLocation } from "react-router";
import {
  getNotificationUnreadCount,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notifications.js";
import {
  notificationDateTime,
  notificationDestination,
  notificationSourceLabel,
  relativeNotificationTime,
  unreadBadge,
} from "./notificationUtils.js";
import { getFollowUpReminders } from "../../api/reminders.js";
import { reminderDashboardDestination, reminderRequestEmpty, reminderRequestForUser, reminderScopeFor } from "../dashboard/reminderUtils.js";
import { useAuth } from "../../auth/useAuth.js";
import { dhruvaDirectionOf, flowOf } from "./leadFlow.js";

const PAGE_SIZE = 10;

export default function NotificationBell({ variant = "default" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const root = useRef(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(null);
  const [countError, setCountError] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  // Follow-ups follow the current Lead flow (?flow): KOC → Vendors, Vendors → KOC, or in the
  // Dhruva flow its direction (Dhruva → KOC or KOC → Dhruva, ?direction / the open list).
  // Counts are kept with their scope, so another scope's counts show as "—", never as this one's.
  const flow = reminderScopeFor(flowOf(location.pathname, location.search), dhruvaDirectionOf(location.pathname, location.search));
  const { user } = useAuth();
  const followUpRequest = reminderRequestForUser(flow, user); // vendor logins: only their sources
  const followUpEmpty = reminderRequestEmpty(followUpRequest);
  const followUpDhruva = followUpRequest.dhruva;
  const followUpSources = followUpRequest.sources.join(",");
  const [followUps, setFollowUps] = useState({ flow: null, counts: null, error: false });
  const followUpCounts = followUps.flow === flow ? followUps.counts : null;
  const followUpError = followUps.flow === flow && followUps.error;
  const followUpKey = useRef(flow);
  useEffect(() => {
    followUpKey.current = flow;
  }, [flow]);

  const refreshCount = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const result = await getNotificationUnreadCount();
      setCount(Number(result?.unread_count) || 0);
      setCountError(false);
    } catch {
      setCount(null);
      setCountError(true);
    }
  }, []);

  const loadPage = useCallback(async (nextPage = 1) => {
    setLoading(true);
    setError(false);
    try {
      const result = await getNotifications({ page: nextPage, pageSize: PAGE_SIZE });
      setItems((current) => nextPage === 1 ? result.items ?? [] : [...current, ...(result.items ?? [])]);
      setPage(result.page ?? nextPage);
      setPages(result.pages ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshFollowUps = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const key = flow;
    if (followUpEmpty) {
      setFollowUps({ flow: key, counts: {}, error: false });
      return;
    }
    try {
      const result = await getFollowUpReminders({
        days: 7,
        dhruva: followUpDhruva,
        sources: followUpSources ? followUpSources.split(",") : [],
      });
      if (followUpKey.current !== key) return; // a late answer for another flow
      setFollowUps({ flow: key, counts: result.counts ?? {}, error: false });
    } catch {
      if (followUpKey.current !== key) return;
      setFollowUps({ flow: key, counts: null, error: true });
    }
  }, [flow, followUpDhruva, followUpSources, followUpEmpty]);

  useEffect(() => {
    let timer = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (document.visibilityState !== "visible" || timer) return;
      refreshCount();
      refreshFollowUps();
      timer = setInterval(() => { refreshCount(); refreshFollowUps(); }, 30_000);
    };
    const onFocus = () => { refreshCount(); refreshFollowUps(); };
    const onVisibility = () => document.visibilityState === "visible" ? start() : stop();
    start();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshCount, refreshFollowUps]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => !root.current?.contains(event.target) && setOpen(false);
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      loadPage(1);
      refreshCount();
      refreshFollowUps();
    }
  }

  function openNotification(item) {
    if (!item.read) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
      setCount((current) => Number.isFinite(current) ? Math.max(0, current - 1) : current);
      markNotificationRead(item.id).catch(() => {
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: false } : entry));
        setCount(null);
        setCountError(true);
      });
    }
    setOpen(false);
    navigate(notificationDestination(item));
  }

  async function markAllRead() {
    const before = items;
    setMarkingAll(true);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setCount(0);
    setCountError(false);
    try {
      await markAllNotificationsRead();
    } catch {
      setItems(before);
      setCount(null);
      setCountError(true);
    } finally {
      setMarkingAll(false);
    }
  }

  const badge = unreadBadge(count);
  const gold = variant === "gold";
  return (
    <div ref={root} className={`relative ${gold ? "rounded-full bg-linear-to-r from-amber-200 via-amber-300 to-orange-400 p-0.5 shadow-lg sm:p-1.5 shadow-orange-500/20 ring-1 ring-white/40" : ""}`}>
      <button
        type="button"
        aria-label={badge ? `Notifications, ${badge} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notifications"
        onClick={toggleOpen}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full transition sm:h-9 sm:w-9 focus-visible:outline-2 ${gold ? "text-amber-950 hover:bg-amber-950/10 focus-visible:outline-amber-950" : "text-white/90 hover:bg-white/15 hover:text-white focus-visible:outline-white"}`}
      >
        <Bell size={18} aria-hidden="true" />
        {badge && <span className={`absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-4 text-white ring-2 ${gold ? "ring-amber-300" : "ring-brand-700"}`}>{badge}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="fixed inset-0 z-50 overflow-y-auto bg-white sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[min(24rem,calc(100vw-2rem))] sm:overflow-hidden sm:rounded-2xl text-left text-gray-900 shadow-2xl ring-1 ring-gray-200">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <div className="flex items-center gap-2">
              {countError && <button type="button" onClick={() => { refreshCount(); loadPage(1); }} className="text-xs font-medium text-brand-700 hover:underline">Retry</button>}
              <button type="button" onClick={markAllRead} disabled={markingAll || !items.some((item) => !item.read)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline disabled:text-gray-400 disabled:no-underline">
                {markingAll ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
                Mark all as read
              </button>
              <button type="button" onClick={toggleOpen} aria-label="Close notifications" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 sm:hidden">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-gray-800">Follow-ups</h3>
              {followUpError ? <button type="button" onClick={refreshFollowUps} className="text-xs font-medium text-brand-700 hover:underline">Retry</button> : (
                <button type="button" onClick={() => { setOpen(false); navigate(reminderDashboardDestination(flow)); }} className="text-xs font-semibold text-brand-700 hover:underline">View all</button>
              )}
            </div>
            <div className="mt-2 flex gap-2 text-xs">
              <button type="button" onClick={() => { setOpen(false); navigate(reminderDashboardDestination(flow)); }} className="rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700 hover:bg-rose-100">Overdue {followUpCounts?.overdue ?? "—"}</button>
              <button type="button" onClick={() => { setOpen(false); navigate(reminderDashboardDestination(flow)); }} className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 hover:bg-amber-100">Today {followUpCounts?.today ?? "—"}</button>
            </div>
          </div>

          <div className="max-h-[min(70vh,32rem)] overflow-y-auto">
            {loading && items.length === 0 && <div className="flex justify-center p-8"><Loader2 size={20} className="animate-spin text-brand-600" /></div>}
            {!loading && error && <div className="px-4 py-6 text-center text-sm text-gray-600"><p>Could not load notifications.</p><button type="button" onClick={() => loadPage(1)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"><RefreshCw size={12} />Retry</button></div>}
            {!loading && !error && items.length === 0 && <p className="px-4 py-10 text-center text-sm text-gray-500">No notifications yet</p>}
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => openNotification(item)} className={`block w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-brand-50/60 ${item.read ? "bg-white" : "bg-brand-50/50"}`}>
                <span className="flex items-start gap-2.5">
                  <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-brand-600"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-snug">{item.title || "Notification"}</span>
                      <span className="shrink-0 text-[11px] text-gray-500" title={notificationDateTime(item.created_at)}>{relativeNotificationTime(item.created_at)}</span>
                    </span>
                    {item.body && <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-gray-600">{item.body}</span>}
                    <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{notificationSourceLabel(item.source)}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>

          {page < pages && <div className="border-t border-gray-100 p-2"><button type="button" onClick={() => loadPage(page + 1)} disabled={loading} className="w-full rounded-xl px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:text-gray-400">{loading ? "Loading…" : "Load more"}</button></div>}
        </div>
      )}
    </div>
  );
}
