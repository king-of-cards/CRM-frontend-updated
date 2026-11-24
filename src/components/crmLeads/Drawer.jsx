import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLocation } from "react-router";
import LeadBackButton from "../layout/LeadBackButton.jsx";
import { isLeadRoute } from "../layout/leadBack.js";

// Right-hand drawer in the same style as the Branches and Vendors forms.
// Rendered in document.body, so it isn't clipped by the table it may be opened from (inline when
// there is no document, e.g. server rendering in tests).
export default function Drawer({ kicker, title, onClose, wide = false, children, footer, headerActions }) {
  const { pathname } = useLocation();
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const drawer = (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]"
      />
      <div
        className={`relative flex h-full w-full flex-col bg-linear-to-b from-white via-white to-brand-50 shadow-2xl ${wide ? "max-w-6xl" : "max-w-lg"}`}
      >
        <div className="flex items-center justify-between gap-3 bg-linear-to-r from-brand-800 via-brand-700 to-brand-600 px-4 py-4 text-white sm:px-6 sm:py-5">
          <div className="min-w-0">
            {kicker && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{kicker}</p>
            )}
            <h2 className="break-words text-lg font-semibold">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {isLeadRoute(pathname) && <LeadBackButton inverted />}
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-6 sm:py-4">{footer}</div>}
      </div>
    </div>
  );
  return typeof document === "undefined" ? drawer : createPortal(drawer, document.body);
}

export const fieldCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

export const primaryBtn =
  "rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-6 py-2 text-sm font-semibold text-white shadow-md shadow-brand-700/25 disabled:opacity-60";

export const secondaryBtn =
  "rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60";


export function Alert({ kind = "error", children }) {
  const cls = {
    error: "bg-red-50 text-red-700 ring-red-200",
    warning: "bg-amber-50 text-amber-800 ring-amber-200",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-2.5 text-sm ring-1 ${cls}`}>
      {children}
    </div>
  );
}
