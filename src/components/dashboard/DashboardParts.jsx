import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router";

// Building blocks shared by the two dashboards (KOC → Vendors and Vendors → KOC),
// moved unchanged from src/pages/Dashboard.jsx.

const fmt = (n) => (n == null ? "—" : n.toLocaleString("en-IN"));

// flush: the body runs edge to edge (for lists with their own row padding)
export function Panel({
  title,
  subtitle,
  icon: Icon,
  right,
  flush = false,
  children,
}) {
  return (
    <section
      className={`rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 ${flush ? "pt-5" : "p-5"}`}
    >
      <div
        className={`flex items-start justify-between gap-3 ${flush ? "px-5" : ""}`}
      >
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            {Icon && (
              <Icon size={16} className="text-brand-600" aria-hidden="true" />
            )}
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
      <div className={flush ? "mt-3" : "mt-4"}>{children}</div>
    </section>
  );
}

export function Kpi({ icon: Icon, label, value, caption, delta, gradient, loading, to }) {
  const card = (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 transition-shadow hover:shadow-lg hover:shadow-gray-200/80">
      {/* Corner glow in the card's colour */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-linear-to-br opacity-15 blur-xl ${gradient}`}
      />
      <div className="relative flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm ${gradient}`}
        >
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <span className="mt-3 block h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        <div className="relative mt-2 flex items-baseline gap-2">
          <p className="text-3xl font-bold tracking-tight tabular-nums text-gray-900">
            {value}
          </p>
          {delta != null && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                delta >= 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {delta >= 0 ? (
                <ArrowUpRight size={12} />
              ) : (
                <ArrowDownRight size={12} />
              )}
              {Math.abs(delta)}%
            </span>
          )}
        </div>
      )}
      <p className="relative mt-1.5 text-xs text-gray-500">{caption}</p>
    </div>
  );
  return to ? <Link to={to} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-brand-600">{card}</Link> : card;
}

export function BarList({
  items,
  color = "from-brand-600 to-brand-800",
  empty = "No data yet",
}) {
  if (!items?.length) return <p className="text-sm text-gray-500">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.value}>
          <div className="flex items-center justify-between text-sm">
            <span className="truncate pr-3 text-gray-700">{i.value}</span>
            <span className="tabular-nums font-medium text-gray-900">
              {fmt(i.count)}
            </span>
          </div>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"
            aria-hidden="true"
          >
            <div
              className={`h-full rounded-full bg-linear-to-r ${color} transition-all duration-700`}
              style={{ width: `${(i.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Checkboxes above a chart, one per series, coloured like the series (all ticked by default).
// series: [{ key, label, color }]; hidden: Set of unticked keys
export function SeriesToggles({ series, hidden, onToggle }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="Show series">
      {series.map((s) => (
        <label key={s.key} className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={!hidden.has(s.key)}
            onChange={() => onToggle(s.key)}
            className="h-3.5 w-3.5"
            style={{ accentColor: s.color }}
          />
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
          {s.label}
        </label>
      ))}
    </div>
  );
}

// Toggle a key in a Set (returns a new Set)
export const toggled = (set, key) => {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
};
