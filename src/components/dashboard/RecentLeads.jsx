import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
} from "lucide-react";
import { listSpinLeads } from "../../api/spinLeads.js";
import { useAuth } from "../../auth/useAuth.js";

// Live "Recent leads" box, fed by GET /api/v1/spin-leads.
// Shows every field the API returns. The lead's name stays pinned on the left while
// the rest scrolls sideways (slider under the table, arrow buttons, or Shift + mouse wheel).

const PAGE_SIZE = 6; // leads per page in this box
const CACHE_MS = 60_000; // reuse a loaded page for 1 minute (instant back/forward and return visits)
const SORT_KEY = "crm-recent-leads-sort"; // remembers the date column, so later loads need 1 request

// If a field is picked wrongly, put its exact column name here
// (as shown in the Leads page headers, e.g. "full_name" or "additional_details.serviceBudget").
const FIELD_OVERRIDES = {
  name: null,
  email: null,
  phone: null,
  status: null,
  created: null,
};

const CANDIDATES = {
  name: [
    "name",
    "fullname",
    "customername",
    "leadname",
    "clientname",
    "firstname",
    "contactname",
  ],
  email: ["email", "emailaddress", "customeremail"],
  phone: [
    "phone",
    "phonenumber",
    "mobile",
    "mobilenumber",
    "contactnumber",
    "whatsapp",
  ],
  status: ["status", "leadstatus", "stage"],
  created: ["createdat", "created", "createdon", "submittedat", "timestamp"],
};

const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/^additional_details\./, "")
    .replace(/[_\s.-]/g, "");

function pickFields(columns) {
  const names = columns.map((c) => c.name);
  const found = {};
  for (const [field, candidates] of Object.entries(CANDIDATES)) {
    if (FIELD_OVERRIDES[field]) {
      found[field] = names.includes(FIELD_OVERRIDES[field])
        ? FIELD_OVERRIDES[field]
        : null;
      continue;
    }
    found[field] =
      candidates
        .map((c) => names.find((n) => normalize(n) === c))
        .find(Boolean) ?? null;
  }
  if (!found.name)
    found.name = names.find((n) => normalize(n).includes("name")) ?? null;
  return found;
}

// ── Small in-memory cache shared across visits to the dashboard ──────────
const pageCache = new Map(); // page number -> { at, data }

function readCache(page) {
  const hit = pageCache.get(page);
  return hit && Date.now() - hit.at < CACHE_MS ? hit.data : null;
}

function writeCache(page, data) {
  pageCache.set(page, { at: Date.now(), data });
}

function storedSort() {
  try {
    const v = sessionStorage.getItem(SORT_KEY);
    return v === null ? undefined : v || null; // "" means "no date column"
  } catch {
    return undefined;
  }
}

function storeSort(value) {
  try {
    sessionStorage.setItem(SORT_KEY, value ?? "");
  } catch {
    // storage unavailable: we just find it again next time
  }
}

// ── Formatting ───────────────────────────────────────────────────────────
function columnLabel(col) {
  const raw = col.json_field ? col.key : col.name;
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const isDateCol = (col) =>
  !col.json_field && /TIMESTAMP|^DATE$/i.test(col.type ?? "");

function formatDate(value, withTime) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function timeAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  if (hours < 48) return "Yesterday";
  return formatDate(value, false);
}

function formatValue(value, col, fields) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (col.name === fields.created) return timeAgo(value);
  if (isDateCol(col)) return formatDate(value, !/^DATE$/i.test(col.type));
  if (col.type === "range")
    return /^\d/.test(String(value))
      ? `₹${String(value).replace(/[-_]/g, "–")}`
      : String(value);
  return String(value);
}

const statusStyles = [
  {
    match: /new|open|fresh/i,
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    dot: "bg-sky-500",
  },
  {
    match: /contact|follow|progress|pending/i,
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
  },
  {
    match: /qualif|convert|won|closed|confirm|done/i,
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    match: /lost|reject|cancel|spam|dead/i,
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
  },
];
const neutralStatus = {
  badge: "bg-gray-100 text-gray-700 ring-gray-200",
  dot: "bg-gray-400",
};
const styleFor = (status) =>
  statusStyles.find((s) => s.match.test(status)) ?? neutralStatus;

const avatarColors = [
  "bg-brand-100 text-brand-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
];
const initials = (name) =>
  String(name)
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const avatarColor = (name) =>
  avatarColors[
    [...String(name)].reduce((t, ch) => t + ch.charCodeAt(0), 0) %
      avatarColors.length
  ];

// Page buttons with gaps: 1 … 4 5 6 … 20
function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const sorted = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

// ── Data loading ─────────────────────────────────────────────────────────
async function fetchPage(page, sort) {
  const cached = readCache(page);
  if (cached) return { data: cached, sort };

  let sortField = sort;
  let data;
  if (sortField === undefined) {
    // Very first load only: learn the columns, then find the date column
    data = await listSpinLeads({ page, pageSize: PAGE_SIZE });
    sortField = pickFields(data.columns).created ?? null;
    storeSort(sortField);
    if (sortField)
      data = await listSpinLeads({
        page,
        pageSize: PAGE_SIZE,
        sort: sortField,
        order: "desc",
      });
  } else {
    try {
      data = await listSpinLeads({
        page,
        pageSize: PAGE_SIZE,
        sort: sortField ?? undefined,
        order: "desc",
      });
    } catch (err) {
      // The remembered date column no longer exists: forget it and work it out again
      if (err.status === 400 && sortField) return fetchPage(page, undefined);
      throw err;
    }
  }
  writeCache(page, data);
  return { data, sort: sortField };
}

export default function RecentLeads() {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(() => readCache(1));
  const [loading, setLoading] = useState(() => !readCache(1));
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const sortRef = useRef(storedSort());

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const cached = readCache(page);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError("");

    (async () => {
      try {
        const { data: res, sort } = await fetchPage(page, sortRef.current);
        sortRef.current = sort;
        if (cancelled) return;
        setData(res);
        setFilter("All");

        // Load the next page in the background, so "Next" is instant
        const pages = Math.ceil(res.total / PAGE_SIZE);
        if (page < pages && !readCache(page + 1))
          fetchPage(page + 1, sort).catch(() => {});
      } catch (err) {
        if (!cancelled)
          setError(
            err.status === 503
              ? "The leads database is unavailable right now."
              : err.message,
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, page]);

  const columns = useMemo(() => data?.columns ?? [], [data]);
  const fields = useMemo(() => pickFields(columns), [columns]);
  const otherColumns = useMemo(
    () => columns.filter((c) => c.name !== fields.name),
    [columns, fields],
  );
  const items = useMemo(() => data?.items ?? [], [data]);

  const statuses = useMemo(
    () =>
      fields.status
        ? [
            ...new Set(
              items
                .map((i) => i[fields.status])
                .filter(Boolean)
                .map(String),
            ),
          ]
        : [],
    [items, fields],
  );
  const filters = statuses.length > 1 ? ["All", ...statuses] : [];
  const shown =
    filter === "All"
      ? items
      : items.filter((i) => String(i[fields.status]) === filter);
  const countFor = (f) =>
    f === "All"
      ? items.length
      : items.filter((i) => String(i[fields.status]) === f).length;

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  // ── Horizontal slider ──────────────────────────────────────────────────
  const scrollRef = useRef(null);
  const [scroll, setScroll] = useState({ left: 0, max: 0 });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (el)
      setScroll({
        left: el.scrollLeft,
        max: Math.max(0, el.scrollWidth - el.clientWidth),
      });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure, data]);

  const scrollBy = (dx) =>
    scrollRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  const canScroll = scroll.max > 4;
  const scrolled = scroll.left > 2;

  return (
    <section className="mt-8 rounded-2xl bg-white shadow-md shadow-gray-200/70 ring-1 ring-gray-100">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Recent leads</h2>
          <p className="mt-1 text-sm text-gray-500">
            {data ? (
              <>
                Newest first ·{" "}
                <span className="font-semibold text-gray-900">
                  {total.toLocaleString("en-IN")}
                </span>{" "}
                leads · {columns.length} fields
              </>
            ) : isAdmin ? (
              "Loading…"
            ) : (
              "Leads are visible to admins."
            )}
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/leads"
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
          >
            View all leads
            <ArrowUpRight size={16} />
          </Link>
        )}
      </div>

      {/* Status tabs (only when the table has statuses) */}
      {filters.length > 0 && (
        <div
          className="mt-5 flex gap-2 overflow-x-auto px-6"
          role="tablist"
          aria-label="Filter this page by status"
        >
          {filters.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                  active
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                }`}
              >
                {f}
                <span
                  className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20 text-white" : "bg-white text-gray-500"}`}
                >
                  {countFor(f)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      {error ? (
        <p
          role="alert"
          className="mx-6 my-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
        >
          {error}
        </p>
      ) : !isAdmin ? (
        <p className="px-6 py-6 text-sm text-gray-500">
          Ask an admin if you need access to leads.
        </p>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={measure}
            className="mt-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <table
              className={`w-max min-w-full text-left text-sm transition-opacity ${loading && data ? "opacity-50" : ""}`}
            >
              <thead className="border-y border-gray-100 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th
                    className={`sticky left-0 z-10 bg-gray-50 px-6 py-3 font-medium transition-shadow ${
                      scrolled ? "shadow-[6px_0_8px_-6px_rgba(0,0,0,0.15)]" : ""
                    }`}
                  >
                    Lead
                  </th>
                  {otherColumns.map((col) => (
                    <th
                      key={col.name}
                      className="whitespace-nowrap px-4 py-3 font-medium last:pr-6"
                    >
                      {columnLabel(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* First-load placeholders */}
                {loading &&
                  !data &&
                  Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <tr
                      key={`s${i}`}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-6 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="h-8 w-8 animate-pulse rounded-full bg-gray-100" />
                          <span className="h-3 w-40 animate-pulse rounded bg-gray-100" />
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="block h-3 w-[480px] animate-pulse rounded bg-gray-100" />
                      </td>
                    </tr>
                  ))}

                {data &&
                  shown.map((item, i) => {
                    const name = item[fields.name]
                      ? String(item[fields.name])
                      : "Unnamed lead";
                    const email = fields.email ? item[fields.email] : null;
                    const phone = fields.phone ? item[fields.phone] : null;
                    return (
                      <tr
                        key={item.id ?? i}
                        className="group border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        {/* Pinned name column */}
                        <td
                          className={`sticky left-0 z-10 bg-white px-6 py-2.5 transition-shadow group-hover:bg-gray-50 ${
                            scrolled
                              ? "shadow-[6px_0_8px_-6px_rgba(0,0,0,0.15)]"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(name)}`}
                              aria-hidden="true"
                            >
                              {initials(name)}
                            </span>
                            <p
                              className="max-w-[180px] truncate font-semibold text-gray-900"
                              title={name}
                            >
                              {name}
                            </p>
                            <div className="ml-auto flex gap-0.5 pl-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                              {email && (
                                <a
                                  href={`mailto:${email}`}
                                  aria-label={`Email ${name}`}
                                  title={String(email)}
                                  className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-brand-700"
                                >
                                  <Mail size={15} />
                                </a>
                              )}
                              {phone && (
                                <a
                                  href={`tel:${phone}`}
                                  aria-label={`Call ${name}`}
                                  title={String(phone)}
                                  className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-brand-700"
                                >
                                  <Phone size={15} />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Every other field */}
                        {otherColumns.map((col) => {
                          const value = item[col.name];
                          const display = formatValue(value, col, fields);
                          if (col.name === fields.status && value) {
                            const style = styleFor(String(value));
                            return (
                              <td
                                key={col.name}
                                className="whitespace-nowrap px-4 py-2.5 last:pr-6"
                              >
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${style.badge}`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                                    aria-hidden="true"
                                  />
                                  {display}
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col.name}
                              title={
                                display.length > 32
                                  ? display
                                  : col.name === fields.created && value
                                    ? formatDate(value, true)
                                    : undefined
                              }
                              className={`max-w-[240px] truncate whitespace-nowrap px-4 py-2.5 last:pr-6 ${
                                display === "—"
                                  ? "text-gray-300"
                                  : "text-gray-700"
                              } ${col.type === "number" || col.type === "range" ? "tabular-nums" : ""}`}
                            >
                              {display}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                {data && !loading && shown.length === 0 && (
                  <tr>
                    <td
                      colSpan={otherColumns.length + 1}
                      className="px-6 py-10 text-center text-sm text-gray-500"
                    >
                      No leads yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Slider for the hidden fields */}
          {canScroll && (
            <div className="flex items-center gap-3 border-t border-gray-100 px-6 py-2.5">
              <button
                type="button"
                onClick={() => scrollBy(-320)}
                disabled={!scrolled}
                aria-label="Scroll left"
                className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="range"
                min={0}
                max={scroll.max}
                value={scroll.left}
                onChange={(e) => {
                  if (scrollRef.current)
                    scrollRef.current.scrollLeft = Number(e.target.value);
                }}
                aria-label="Scroll through the lead fields"
                className="h-1.5 flex-1 cursor-pointer accent-brand-600"
              />
              <button
                type="button"
                onClick={() => scrollBy(320)}
                disabled={scroll.left >= scroll.max - 2}
                aria-label="Scroll right"
                className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
              <span className="hidden text-xs text-gray-400 sm:inline">
                Shift + scroll also works
              </span>
            </div>
          )}
        </>
      )}

      {/* Pagination */}
      {isAdmin && !error && total > PAGE_SIZE && (
        <nav
          aria-label="Recent leads pages"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-3 text-sm text-gray-500"
        >
          <span className="tabular-nums">
            {from}–{to} of {total.toLocaleString("en-IN")}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
              className="rounded-full p-1.5 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            {pageList(page, totalPages).map((p) =>
              typeof p === "string" ? (
                <span key={p} className="px-1 text-gray-400" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  disabled={loading}
                  aria-current={p === page ? "page" : undefined}
                  className={`h-8 min-w-8 rounded-full px-2 text-sm tabular-nums transition-colors ${
                    p === page
                      ? "bg-gray-900 font-medium text-white"
                      : "hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || loading}
              aria-label="Next page"
              className="rounded-full p-1.5 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
