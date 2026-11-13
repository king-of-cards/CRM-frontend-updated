import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageCircle,
  PanelRightOpen,
  Phone,
  RefreshCw,
  Search,
} from "lucide-react";
import { listSheetSources, syncSheet } from "../../api/sheets.js";
import { saveLeadCrm } from "../../api/leadCrm.js";
import { CrmHeaderCells, InlineCrmCells } from "./InlineCrm.jsx";
import LeadPanel from "./LeadPanel.jsx";

// One design for every lead section (Spin, International, Wedding, Wedding planner):
// the section frame, stat chips, toolbar, the table with contact buttons + CRM columns,
// expandable details and pagination. Each section only says WHAT to show.

// ── Small helpers ────────────────────────────────────────────────────────
export const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
export const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("en-IN"));

export function shortMoney(amount) {
  if (amount == null) return null;
  if (amount >= 1e7) return `₹${+(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${+(amount / 1e5).toFixed(1)} L`;
  return inr.format(amount);
}

export function timeAgo(iso) {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function dateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayDate(isoDate) {
  if (!isoDate) return null;
  const d = new Date(
    String(isoDate).length === 10 ? `${isoDate}T00:00:00` : isoDate,
  );
  if (Number.isNaN(d.getTime())) return String(isoDate);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "in 12 days" / "Passed" for an event date
export function countdown(isoDate) {
  if (!isoDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(
    String(isoDate).length === 10 ? `${isoDate}T00:00:00` : isoDate,
  );
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.round((d - today) / 86400000);
  if (days < 0) return { text: "Passed", tone: "text-gray-400" };
  if (days === 0) return { text: "Today", tone: "text-rose-600" };
  if (days <= 30)
    return {
      text: `in ${days} d`,
      tone: days <= 14 ? "text-rose-600" : "text-amber-600",
    };
  const months = Math.round(days / 30.4);
  return {
    text: months < 12 ? `in ${months} mo` : `in ${+(days / 365).toFixed(1)} yr`,
    tone: "text-gray-400",
  };
}

// Phone digits with country code: 10-digit numbers are Indian (+91)
export function phoneDigits(value) {
  let d = String(value ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d.length >= 8 ? d : null;
}

const AVATARS = [
  "from-brand-500 to-brand-700",
  "from-violet-500 to-violet-700",
  "from-rose-500 to-rose-700",
  "from-amber-500 to-amber-600",
  "from-sky-500 to-sky-700",
  "from-emerald-500 to-emerald-700",
];
const initials = (name) =>
  String(name || "?")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "#";
const avatarTone = (name) =>
  AVATARS[
    [...String(name || "")].reduce((t, c) => t + c.charCodeAt(0), 0) %
      AVATARS.length
  ];

// ── Section look per source ──────────────────────────────────────────────
export const THEMES = {
  spin: {
    tag: "Spin",
    chip: "from-sky-500 to-sky-700",
    tagCls: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  whatsapp: {
    tag: "International",
    chip: "from-violet-500 to-violet-700",
    tagCls: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  wedding: {
    tag: "Wedding",
    chip: "from-rose-500 to-rose-700",
    tagCls: "bg-rose-50 text-rose-700 ring-rose-200",
  },
  wedding_planner: {
    tag: "Wedding planner",
    chip: "from-amber-500 to-amber-600",
    tagCls: "bg-amber-50 text-amber-700 ring-amber-200",
  },
};

// ── Hooks ────────────────────────────────────────────────────────────────
// Search box that waits until typing pauses
export function useDebounced(value, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Last sync of a Google Sheet source + "Sync now"
export function useSheetSync(source, onSynced) {
  const [lastSync, setLastSync] = useState(
    () =>
      listSheetSources.peek()?.sources.find((s) => s.source === source) ?? null,
  );
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);

  const loadLastSync = useCallback(() => {
    listSheetSources()
      .then((res) =>
        setLastSync(res.sources.find((s) => s.source === source) ?? null),
      )
      .catch(() => {});
  }, [source]);

  useEffect(() => {
    if (source) loadLastSync();
  }, [source, loadLastSync]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const run = await syncSheet(source);
      const changes = [
        run.inserted && `${run.inserted} new`,
        run.updated && `${run.updated} updated`,
        run.removed && `${run.removed} removed`,
      ].filter(Boolean);
      setMessage({
        kind: "ok",
        text: changes.length
          ? `Synced: ${changes.join(", ")}.`
          : "Synced. No changes in the sheet.",
      });
      loadLastSync();
      onSynced?.();
    } catch (err) {
      setMessage({
        kind: "error",
        text:
          err.status === 409
            ? "A sync is already running. Try again in a moment."
            : err.message,
      });
    } finally {
      setSyncing(false);
    }
  }, [source, loadLastSync, onSynced]);

  return { lastSync, syncing, message, setMessage, sync };
}

// ── Frame ────────────────────────────────────────────────────────────────
export function SectionShell({
  theme,
  icon: Icon,
  title,
  subtitle,
  action,
  message,
  stats,
  toolbar,
  children,
  footer,
}) {
  const t = THEMES[theme];
  return (
    <section className="mt-6 overflow-hidden rounded-3xl bg-white ring-1 ring-gray-100 shadow-lg shadow-gray-200/50">
      {/* Coloured strip */}
      <div className={`h-1 bg-linear-to-r ${t.chip}`} />

      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-5">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-md ${t.chip}`}
            aria-hidden="true"
          >
            <Icon size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mx-6 mt-4 rounded-xl px-4 py-2.5 text-sm ring-1 ${
            message.kind === "error"
              ? "bg-red-50 text-red-700 ring-red-200"
              : "bg-emerald-50 text-emerald-700 ring-emerald-200"
          }`}
        >
          {message.text}
        </p>
      )}

      {stats?.length > 0 && (
        <div
          className={`mt-5 grid grid-cols-2 gap-3 px-6 ${stats.length >= 5 ? "sm:grid-cols-3 lg:grid-cols-5" : stats.length === 4 ? "lg:grid-cols-4" : "sm:grid-cols-3"}`}
        >
          {stats.map((s) => {
            const tone =
              {
                rose: "bg-rose-50 text-rose-700 ring-rose-100",
                amber: "bg-amber-50 text-amber-700 ring-amber-100",
                emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
              }[s.tone] ?? "bg-gray-50 text-gray-500 ring-gray-100";
            return (
              <div
                key={s.label}
                className={`rounded-2xl px-4 py-3 ring-1 ${tone}`}
              >
                <p className="text-xs">{s.label}</p>
                <p
                  className={`mt-1 text-xl font-bold tabular-nums ${s.tone ? "" : "text-gray-900"}`}
                >
                  {s.value ?? "—"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {toolbar && (
        <div className="mt-5 flex flex-wrap items-center gap-3 px-6">
          {toolbar}
        </div>
      )}

      <div className="mt-4">{children}</div>
      {footer}
    </section>
  );
}

export function SyncButton({ syncing, onClick, label = "Sync now" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={syncing}
      className="flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-md shadow-gray-900/10 transition hover:bg-gray-700 disabled:opacity-60"
    >
      <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
      {syncing ? "Syncing…" : label}
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="relative w-full sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <Search
        size={16}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
      />
    </label>
  );
}

export function Tabs({ options, value, onChange, label }) {
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-full bg-gray-100 p-1"
      role="tablist"
      aria-label={label}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {o.label}
            {o.count != null && (
              <span className="ml-1.5 text-xs text-gray-400">{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Contact buttons ─────────────────────────────────────────────────────
export function ContactActions({ phone, email, name, showNumber = true }) {
  const digits = phoneDigits(phone);
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-full transition";
  const off = "cursor-not-allowed bg-gray-50 text-gray-300";
  const stop = (e) => e.stopPropagation();
  return (
    <div className="flex items-center gap-2" onClick={stop}>
      {showNumber && (
        <span className="min-w-[118px] tabular-nums text-sm text-gray-800">
          {digits ? (
            `+${digits}`
          ) : (
            <span className="text-gray-300">No number</span>
          )}
        </span>
      )}
      <div className="flex items-center gap-1">
        {digits ? (
          <a
            href={`tel:+${digits}`}
            title={`Call +${digits}`}
            aria-label={`Call ${name ?? ""}`}
            className={`${btn} bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700`}
          >
            <Phone size={14} />
          </a>
        ) : (
          <span
            className={`${btn} ${off}`}
            title="No phone number"
            aria-hidden="true"
          >
            <Phone size={14} />
          </span>
        )}
        {email ? (
          <a
            href={`mailto:${email}`}
            title={`Email ${email}`}
            aria-label={`Email ${name ?? ""}`}
            className={`${btn} bg-violet-50 text-violet-600 hover:bg-violet-100 hover:text-violet-700`}
          >
            <Mail size={14} />
          </a>
        ) : (
          <span className={`${btn} ${off}`} title="No email" aria-hidden="true">
            <Mail size={14} />
          </span>
        )}
        {digits ? (
          <a
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noreferrer"
            title="Chat on WhatsApp"
            aria-label={`Chat with ${name ?? ""} on WhatsApp`}
            className={`${btn} bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-600`}
          >
            <MessageCircle size={14} />
          </a>
        ) : (
          <span
            className={`${btn} ${off}`}
            title="No WhatsApp number"
            aria-hidden="true"
          >
            <MessageCircle size={14} />
          </span>
        )}
      </div>
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────
function LeadIdentity({ theme, name, subtitle, badge }) {
  const t = THEMES[theme];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-xs font-semibold text-white ${avatarTone(name)}`}
      >
        {initials(name)}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5">
          <span
            className="max-w-[170px] truncate font-semibold leading-tight text-gray-900"
            title={name}
          >
            {name}
          </span>
          {badge}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5">
          <span
            className={`rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ring-1 ${t.tagCls}`}
          >
            {t.tag}
          </span>
          {subtitle && (
            <span
              className="max-w-[160px] truncate text-xs text-gray-500"
              title={subtitle}
            >
              {subtitle}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// Blank CRM details for a lead that has none yet (so the cells can still be edited)
export function emptyCrm(leadKey) {
  return {
    lead_key: String(leadKey),
    vendor: null,
    vendor_source: null,
    suggested_vendor: null,
    interest: null,
    converted: false,
    converted_at: null,
    quoted_date: null,
    quoted_amount: null,
    notes: null,
    updated_at: null,
  };
}

/**
 * columns: [{ id, header, align?: "right", render: (row) => node }]
 * identity(row) -> { name, subtitle, badge? }   contact(row) -> { phone, email }
 * source: "spin" | "whatsapp" | "wedding" | "wedding_planner"
 * crm(row) -> crm object | null                 context(row) -> { location, pincode, sheet_vendor }
 * crmKey(row) -> the lead's key, used when crm(row) is missing (backend not sending "crm" yet)
 * onCrmSaved(leadKey, crm)                      update the row in the page's data
 * panel(row) -> { sourceLabel, title, subtitle, sections: [{ title, rows: [[label, value]] }], extra? }
 * Clicking a row opens the side panel. The CRM cells are edited right in the table.
 */
export function LeadTable({
  theme,
  source,
  rows,
  rowKey,
  loading,
  dimmed,
  identity,
  contact,
  columns,
  crm,
  crmKey,
  context,
  onCrmSaved,
  trailing = [],
  panel,
  empty,
  openKey,
  onOpened,
}) {
  const [openRow, setOpenRow] = useState(null);

  // Open a lead chosen elsewhere (e.g. a search suggestion) once it's in the rows
  useEffect(() => {
    if (openKey == null) return;
    const row = rows.find((r) => String(rowKey(r)) === String(openKey));
    if (row) {
      setOpenRow(rowKey(row));
      onOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, rows]);
  const [saved, setSaved] = useState({}); // lead_key -> crm saved in this view (shown even before the list reloads)

  // A row's CRM details: just saved > from the backend > blank (still editable)
  const crmOf = (row) => {
    const fromApi = crm(row);
    const key = fromApi?.lead_key ?? (crmKey ? crmKey(row) : null);
    if (key == null) return null;
    return saved[String(key)] ?? fromApi ?? emptyCrm(key);
  };
  const all = [...columns, ...trailing];
  const colSpan = 2 + all.length + 4;
  const th =
    "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500";

  // Save one or more CRM fields for a row, then update that row
  const saveFor = (row) => async (changes) => {
    const current = crmOf(row);
    const next = await saveLeadCrm(
      source,
      current.lead_key,
      changes,
      context?.(row) ?? {},
    );
    setSaved((s) => ({ ...s, [current.lead_key]: next }));
    onCrmSaved?.(current.lead_key, next);
    return next;
  };
  const onPanelSaved = (key, next) => {
    setSaved((s) => ({ ...s, [key]: next }));
    onCrmSaved?.(key, next);
  };

  // The side panel's data for the open row (kept fresh as the row changes)
  const openLead = (() => {
    if (openRow == null) return null;
    const row = rows.find((r) => rowKey(r) === openRow);
    if (!row) return null;
    const id = identity(row);
    const c = contact(row);
    const p = panel ? panel(row) : {};
    return {
      source,
      row,
      crm: crmOf(row),
      context: context?.(row) ?? {},
      title: p.title ?? id.name,
      subtitle: p.subtitle ?? id.subtitle,
      sourceLabel: p.sourceLabel ?? THEMES[theme].tag,
      phone: phoneDigits(c.phone),
      email: c.email || null,
      sections: p.sections ?? [],
      extra: p.extra,
    };
  })();

  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full min-w-[1200px] text-sm transition-opacity ${dimmed ? "opacity-50" : ""}`}
      >
        <thead className="border-y border-gray-100 bg-gray-50/80">
          <tr>
            <th className={`${th} sticky left-0 z-10 bg-gray-50`}>Lead</th>
            <th className={th}>Contact</th>
            {columns.map((c) => (
              <th
                key={c.id}
                className={`${th} ${c.align === "right" ? "text-right" : ""}`}
              >
                {c.header}
              </th>
            ))}
            <CrmHeaderCells className={th} />
            {trailing.map((c) => (
              <th
                key={c.id}
                className={`${th} ${c.align === "right" ? "text-right" : ""}`}
              >
                {c.header}
              </th>
            ))}
            <th className="w-10 px-3 py-3" aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={`s${i}`} className="border-b border-gray-50">
                <td colSpan={colSpan} className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 animate-pulse rounded-full bg-gray-100" />
                    <span className="h-3 w-40 animate-pulse rounded bg-gray-100" />
                    <span className="ml-8 h-3 w-1/3 animate-pulse rounded bg-gray-100" />
                  </div>
                </td>
              </tr>
            ))}

          {!loading &&
            rows.map((row) => {
              const k = rowKey(row);
              const id = identity(row);
              const c = contact(row);
              const isOpen = openRow === k;
              return (
                <tr
                  key={k}
                  onClick={() => setOpenRow(k)}
                  className={`group cursor-pointer border-b border-gray-50 transition-colors hover:bg-brand-50/40 ${isOpen ? "bg-brand-50/60" : ""}`}
                >
                  <td
                    className={`sticky left-0 z-10 px-4 py-3 transition-colors group-hover:bg-brand-50 ${isOpen ? "bg-brand-50" : "bg-white"}`}
                  >
                    <LeadIdentity theme={theme} {...id} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <ContactActions
                      phone={c.phone}
                      email={c.email}
                      name={id.name}
                    />
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={`whitespace-nowrap px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}
                    >
                      {col.render(row) ?? (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                  <InlineCrmCells
                    crm={crmOf(row)}
                    save={saveFor(row)}
                    className="px-4 py-3"
                  />
                  {trailing.map((col) => (
                    <td
                      key={col.id}
                      className={`whitespace-nowrap px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}
                    >
                      {col.render(row) ?? (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition group-hover:bg-white group-hover:text-brand-700 group-hover:shadow-sm"
                      title="Open lead"
                    >
                      <PanelRightOpen size={16} />
                    </span>
                  </td>
                </tr>
              );
            })}

          {!loading && rows.length === 0 && (
            <tr>
              <td
                colSpan={colSpan}
                className="px-6 py-14 text-center text-sm text-gray-500"
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <LeadPanel
        lead={openLead}
        onClose={() => setOpenRow(null)}
        onSaved={onPanelSaved}
      />
    </div>
  );
}

// Label/value grid used inside expanded rows
export function DetailGrid({ items }) {
  const shown = items.filter(
    (i) =>
      i.value != null &&
      i.value !== "" &&
      !(Array.isArray(i.value) && !i.value.length),
  );
  if (!shown.length)
    return <p className="text-sm text-gray-500">No more details.</p>;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      {shown.map((i) => (
        <div
          key={i.label}
          className={i.wide ? "sm:col-span-2 lg:col-span-4" : ""}
        >
          <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            {i.label}
          </dt>
          <dd className="mt-0.5 break-words text-sm text-gray-800">
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────
function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export function Pagination({ page, pageSize, total, onPage, disabled }) {
  if (!total || total <= pageSize) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const nav =
    "flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40";
  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-3 text-sm text-gray-500"
    >
      <span className="tabular-nums">
        {fmt(from)}–{fmt(to)} of {fmt(total)}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1 || disabled}
          aria-label="Previous page"
          className={nav}
        >
          <ChevronLeft size={18} />
        </button>
        {pageList(page, pages).map((p) =>
          typeof p === "string" ? (
            <span key={p} className="px-1 text-gray-400" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              disabled={disabled}
              aria-current={p === page ? "page" : undefined}
              className={`h-8 min-w-8 rounded-full px-2 tabular-nums transition ${p === page ? "bg-gray-900 font-medium text-white" : "hover:bg-gray-100 hover:text-gray-900"}`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages || disabled}
          aria-label="Next page"
          className={nav}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </nav>
  );
}
