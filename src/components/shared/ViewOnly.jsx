import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import { VIEW_ONLY_EVENT } from "../../auth/permissions.js";

// The one "View only" look (docs section 16): a badge, read-only field lists in place of
// edit forms, and a toast when a write is refused anyway.

export function ViewOnlyBadge({ className = "", inverted = false }) {
  return (
    <span
      title="View only: you can see everything but can't change data"
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
        inverted ? "bg-white/15 text-white ring-white/30" : "bg-slate-100 text-slate-700 ring-slate-200"
      } ${className}`}
    >
      <Eye size={12} aria-hidden="true" />
      View only
    </span>
  );
}

// Label / value pairs as plain text, e.g. a CRM section for a view-only login.
//   items: [[label, value], …]; empty values show "—"
export function ReadOnlyFields({ title, items, className = "" }) {
  return (
    <section aria-label={title ? `${title}, view only` : "View only"} className={`rounded-3xl bg-white/80 p-5 ring-1 ring-gray-100 shadow-sm backdrop-blur ${className}`}>
      <div className="flex items-center justify-between gap-3">
        {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
        <ViewOnlyBadge />
      </div>
      <dl className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-medium text-gray-500">{label}</dt>
            <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-gray-900">
              {value === null || value === undefined || value === "" ? "—" : value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Listens for the API's view-only 403 (api/client.js) and shows a short, friendly message
export function ViewOnlyToast() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener(VIEW_ONLY_EVENT, show);
    return () => window.removeEventListener(VIEW_ONLY_EVENT, show);
  }, []);
  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [visible]);
  if (!visible) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-[1100] mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl sm:inset-x-auto sm:right-6">
      <Eye size={18} className="mt-0.5 shrink-0 text-slate-300" aria-hidden="true" />
      <p className="flex-1">
        <span className="font-semibold">View only.</span> Your login can see everything but can’t change data.
      </p>
      <button type="button" aria-label="Dismiss" onClick={() => setVisible(false)} className="rounded-full p-0.5 text-slate-300 hover:bg-white/10 hover:text-white">
        <X size={16} />
      </button>
    </div>
  );
}
