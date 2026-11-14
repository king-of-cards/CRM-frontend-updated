import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, FileText, RotateCw } from "lucide-react";
import LeadFilters from "./LeadFilters.jsx";
import LeadAvatar from "./LeadAvatar.jsx";
import LeadDrawer from "./LeadDrawer.jsx";
import StatusBadge from "./StatusBadge.jsx";
import QuotationPreview from "./QuotationPreview.jsx";
import * as activityApi from "../../api/leadActivity.js";
import { listSpinLeads } from "../../api/spinLeads.js";
import {
  FIELD_CANDIDATES,
  HIDDEN_SERVICES,
  PAGE_SIZE,
  SERVICE_RENAMES,
  SOURCE_OPTIONS,
  TABLE_COLUMNS,
} from "../../data/leadFields.js";
import { STATUSES } from "../../data/leads.js";
import { formatDateTime, formatINR } from "../../utils/format.js";

const STATUS_IDS = new Set(STATUSES.map((s) => s.id));
const LOGICAL_FIELDS = new Set([
  "name",
  "phone",
  "email",
  "service",
  "vendor",
  "source",
  "status",
  "quotation",
  "added",
]);
const FETCH_SIZE = 200; // the most the backend returns per request
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const cell = "px-4 py-3.5 first:pl-6 last:pr-6 sm:first:pl-8 sm:last:pr-8";
// Name column stays on the left when scrolling sideways; the header row stays on top
// when scrolling down. Each cell gets one z-index and one background, so nothing clashes.
const nameColumnLine = "shadow-[1px_0_0_0_var(--color-gray-100)]";
const headerLine = "shadow-[inset_0_-1px_0_var(--color-gray-100)]";
const headerCornerLine = "shadow-[inset_0_-1px_0_var(--color-gray-100),1px_0_0_0_var(--color-gray-100)]";
const tableWidth = TABLE_COLUMNS.reduce((sum, c) => sum + c.width, 0) + 2; // first column gets 2rem extra padding

const dateOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

// ── Reading backend rows ────────────────────────────────────────────────
// Loose matching for display names: "Wedding Decor", "wedding_decor" and "WEDDING-DECOR" are the same
const nameKey = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const serviceRenames = new Map(Object.entries(SERVICE_RENAMES).map(([from, to]) => [nameKey(from), to]));
const hiddenServices = new Set(HIDDEN_SERVICES.map(nameKey));
const sourceLabels = new Map(SOURCE_OPTIONS.map((label) => [nameKey(label), label]));

function serviceName(value) {
  return serviceRenames.get(nameKey(value)) ?? value;
}

function sourceName(value) {
  return value ? (sourceLabels.get(nameKey(value)) ?? value) : null;
}

// "additional_details.pinCode", "pin_code" and "pincode" all become "pincode"
function looseKey(name) {
  return name
    .split(".")
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolveColumn(columns, wanted) {
  if (columns.some((c) => c.name === wanted)) return wanted;
  const key = looseKey(wanted);
  return columns.find((c) => looseKey(c.name) === key)?.name ?? null;
}

function resolveFields(columns) {
  const names = new Set(columns.map((c) => c.name));
  const map = {};
  for (const [key, candidates] of Object.entries(FIELD_CANDIDATES)) {
    map[key] = candidates.find((c) => names.has(c)) ?? null;
  }
  return map;
}

function text(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim() || null;
}

// "Photography, Make-up" or '["Photography","Make-up"]' -> ["Photography", "Make-up"]
function toList(value) {
  const t = text(value);
  if (!t) return [];
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      // not JSON: fall through and split on commas
    }
  }
  return t
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toStatus(value) {
  const t = text(value);
  if (!t) return "new";
  const id = t.toLowerCase().replace(/[\s_]+/g, "-");
  return STATUS_IDS.has(id) ? id : "new";
}

function toAmount(value) {
  const n = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toDate(value) {
  const t = text(value);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatValue(value, format) {
  if (format === "date" || format === "datetime") {
    const d = toDate(value);
    if (d) return format === "date" ? dateOnly.format(d) : formatDateTime(d);
  }
  return text(value);
}

// "additional_details.otherWeddingServices" -> "Other wedding services"
function columnLabel(name) {
  const last = name.split(".").pop();
  const words = last
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function toLead(row, index, fields, columns) {
  const get = (key) => (fields[key] ? row[fields[key]] : null);
  const id = text(get("id")) ?? `row-${index}`;
  const services = toList(get("service")).map(serviceName);
  const createdAt = toDate(get("created"));
  const added = createdAt ? formatDateTime(createdAt) : text(get("created"));
  const used = new Set(Object.values(fields).filter(Boolean));
  return {
    id,
    row,
    createdAt,
    name: text(get("name")) ?? "Unnamed lead",
    phone: text(get("phone")),
    email: text(get("email")),
    services,
    service: services.join(", ") || null,
    vendor: text(get("vendor")),
    source: sourceName(text(get("source"))),
    status: toStatus(get("status")),
    quotation: toAmount(get("quotation")),
    added,
    timeline: [
      {
        id: `${id}-added`,
        type: "added",
        text: "Lead added",
        when: added ?? "Date not recorded",
        at: createdAt?.toISOString(),
      },
    ],
    // Every column without its own spot is listed in the lead panel
    extra: columns
      .filter((c) => !used.has(c.name))
      .map((c) => ({ label: columnLabel(c.name), value: text(row[c.name]) }))
      .filter((item) => item.value),
  };
}

// ── Saved activity from the backend (status, details, quotations, notes, timeline) ──
function fromIso(value) {
  return value ? formatDateTime(new Date(value)) : null;
}

// Puts what the team saved on top of the lead from spin_lead.
// `row` comes from /leads/summary (every lead), `activity` from /leads/{id}/activity (opened leads).
function withSaved(base, row, activity) {
  if (!row && !activity) return base;
  const lead = { ...base };
  const details = activity?.details ?? row?.details ?? {};
  for (const [key, value] of Object.entries(details)) lead[key] = value;
  if (details.service) {
    lead.services = toList(details.service).map(serviceName);
    lead.service = lead.services.join(", ") || null;
  }
  if (details.source) lead.source = sourceName(details.source);
  lead.status = activity?.status ?? row?.status ?? base.status;

  if (activity) {
    const last = activity.quotations.at(-1);
    lead.quotation = activity.quotation;
    lead.latestQuotation = last ? { id: last.id, document: last.document } : null;
    lead.quotations = activity.quotations.map((q) => ({
      id: q.id,
      amount: q.amount,
      when: fromIso(q.created_at),
      edited: fromIso(q.updated_at),
      by: q.by,
      document: q.document,
    }));
    lead.notes = activity.notes.map((n) => ({
      id: n.id,
      text: n.text,
      when: fromIso(n.created_at),
      edited: fromIso(n.updated_at),
      by: n.by,
    }));
    lead.notesCount = activity.notes.length;
    lead.timeline = [
      ...base.timeline,
      ...activity.events.map((e) => ({
        id: `e${e.id}`,
        type: e.type,
        text: e.text,
        label: e.label,
        at: e.at,
        when: fromIso(e.at),
        by: e.by,
      })),
    ];
    lead.activityLoaded = true;
  } else {
    lead.quotation = row.quotation ?? base.quotation;
    lead.latestQuotation = row.quotation_id ? { id: row.quotation_id, document: row.quotation_document } : null;
    lead.notesCount = row.notes_count;
  }
  return lead;
}

function summaryFrom(activity) {
  const last = activity.quotations.at(-1);
  return {
    lead_id: activity.lead_id,
    status: activity.status,
    details: activity.details,
    quotation: activity.quotation,
    quotation_id: last?.id ?? null,
    quotation_document: last?.document ?? null,
    notes_count: activity.notes.length,
  };
}

// Loads every lead: the first page tells us the total, the rest are fetched together.
async function loadAllLeads() {
  const first = await listSpinLeads({ page: 1, pageSize: FETCH_SIZE });
  const pages = Math.ceil(first.total / FETCH_SIZE);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => listSpinLeads({ page: i + 2, pageSize: FETCH_SIZE })),
  );
  return { columns: first.columns, items: [first.items, ...rest.map((r) => r.items)].flat() };
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// "2026-10-01" -> start of that day; "2026-10-30" with endOfDay -> 23:59:59.999 that day
function dayBoundary(value, endOfDay) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

// ── Component ───────────────────────────────────────────────────────────
export default function RecentLeads() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedAt, setLoadedAt] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [service, setService] = useState("all");
  const [vendor, setVendor] = useState("all");
  const [source, setSource] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("all");

  // Saved activity, by lead id: a short summary for every lead, full detail for opened ones
  const [summaries, setSummaries] = useState({});
  const [activities, setActivities] = useState({});
  const [activityErrors, setActivityErrors] = useState({});
  const [savedLoadFailed, setSavedLoadFailed] = useState(false);
  const [preview, setPreview] = useState(null); // quotation file shown in the preview window
  const closePreview = useCallback(() => setPreview(null), []);

  const [selectedId, setSelectedId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    Promise.all([
      loadAllLeads(),
      // Saved status/quotations; the leads still show if this part fails
      activityApi.getLeadSummary().catch((err) => {
        console.warn("Couldn't load saved lead activity:", err);
        return null;
      }),
    ])
      .then(([res, summary]) => {
        if (ignore) return;
        setData(res);
        setLoadedAt(new Date());
        setSavedLoadFailed(summary === null);
        if (summary) {
          setSummaries(Object.fromEntries(summary.map((row) => [row.lead_id, row])));
          setActivities({}); // opened leads are fetched again when reopened
        }
      })
      .catch((err) => {
        if (!ignore) setError(err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  // Backend column used for each table column (null if the backend doesn't have it)
  const columnSources = useMemo(() => {
    if (!data) return {};
    const map = {};
    for (const c of TABLE_COLUMNS) {
      map[c.field] = LOGICAL_FIELDS.has(c.field) ? c.field : resolveColumn(data.columns, c.field);
    }
    const missing = TABLE_COLUMNS.filter((c) => !map[c.field]).map((c) => c.field);
    if (missing.length) console.warn("leadFields.js: no backend column found for", missing);
    return map;
  }, [data]);

  const baseLeads = useMemo(() => {
    if (!data) return [];
    const fields = resolveFields(data.columns);
    const seen = new Set();
    return data.items
      .map((row, i) => toLead(row, i, fields, data.columns))
      .filter((l) => (seen.has(l.id) ? false : seen.add(l.id)))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)); // newest first
  }, [data]);

  const leads = useMemo(
    () => baseLeads.map((l) => withSaved(l, summaries[l.id], activities[l.id])),
    [baseLeads, summaries, activities],
  );

  const saveActivity = useCallback((leadId, activity) => {
    setActivities((prev) => ({ ...prev, [leadId]: activity }));
    setSummaries((prev) => ({ ...prev, [leadId]: summaryFrom(activity) }));
  }, []);

  const loadActivity = useCallback(
    (leadId) => {
      setActivityErrors((prev) => ({ ...prev, [leadId]: null }));
      activityApi
        .getLeadActivity(leadId)
        .then((activity) => saveActivity(leadId, activity))
        .catch((err) => setActivityErrors((prev) => ({ ...prev, [leadId]: err.message || "Couldn't load." })));
    },
    [saveActivity],
  );

  // Everything the lead panel can do; each saves to the backend and shows the saved result
  const actions = useMemo(() => {
    if (!selectedId) return null;
    const id = selectedId;
    const save = (request, quotationsChanged = false) =>
      request.then((activity) => {
        saveActivity(id, activity);
        if (quotationsChanged) window.dispatchEvent(new Event(activityApi.QUOTATIONS_CHANGED));
        return activity;
      });
    return {
      setStatus: (status) => save(activityApi.updateLead(id, { status })),
      saveDetails: (changes) => save(activityApi.updateLead(id, changes)),
      addQuotation: async (amount, file) => {
        const activity = await save(activityApi.addQuotation(id, amount), true);
        if (file) await save(activityApi.uploadQuotationDocument(id, activity.quotations.at(-1).id, file), true);
      },
      editQuotation: (quotationId, amount) => save(activityApi.editQuotation(id, quotationId, amount), true),
      deleteQuotation: (quotationId) => save(activityApi.deleteQuotation(id, quotationId), true),
      uploadDocument: (quotationId, file) => save(activityApi.uploadQuotationDocument(id, quotationId, file), true),
      removeDocument: (quotationId) => save(activityApi.deleteQuotationDocument(id, quotationId), true),
      addNote: (text) => save(activityApi.addNote(id, text)),
      editNote: (noteId, text) => save(activityApi.editNote(id, noteId, text)),
      deleteNote: (noteId) => save(activityApi.deleteNote(id, noteId)),
    };
  }, [selectedId, saveActivity]);

  function previewQuotation(lead, quotation) {
    setPreview({
      leadId: lead.id,
      leadName: lead.name,
      quotationId: quotation.id,
      amount: quotation.amount ?? lead.quotation,
      document: quotation.document,
    });
  }

  // Any filter change goes back to page 1
  const onFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  function handleServiceChange(next) {
    setService(next);
    setVendor("all"); // the picked vendor may not offer the new service
    setPage(1);
  }

  const serviceOptions = useMemo(
    () => uniqueSorted(leads.flatMap((l) => l.services)).filter((s) => !hiddenServices.has(nameKey(s))),
    [leads],
  );
  const vendorOptions = useMemo(
    () =>
      service === "all" ? [] : uniqueSorted(leads.filter((l) => l.services.includes(service)).map((l) => l.vendor)),
    [leads, service],
  );
  // The agreed sources first, then anything else found in the data (such as KIOSK)
  const sourceOptions = useMemo(
    () => [...SOURCE_OPTIONS, ...uniqueSorted(leads.map((l) => l.source)).filter((s) => !SOURCE_OPTIONS.includes(s))],
    [leads],
  );

  // Every filter except status; the status pills count within this list
  const scoped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    const from = dayBoundary(dateFrom, false);
    const to = dayBoundary(dateTo, true);
    return leads.filter((l) => {
      if (service !== "all" && !l.services.includes(service)) return false;
      if (vendor !== "all" && l.vendor !== vendor) return false;
      if (source !== "all" && l.source !== source) return false;
      if (from || to) {
        if (!l.createdAt) return false;
        if (from && l.createdAt < from) return false;
        if (to && l.createdAt > to) return false;
      }
      if (!term) return true;
      return (
        l.name.toLowerCase().includes(term) ||
        (l.email ?? "").toLowerCase().includes(term) ||
        (digits.length > 0 && (l.phone ?? "").replace(/\D/g, "").includes(digits))
      );
    });
  }, [leads, search, service, vendor, source, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const l of scoped) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return counts;
  }, [scoped]);

  const filtered = status === "all" ? scoped : scoped.filter((l) => l.status === status);
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, lastPage);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = leads.find((l) => l.id === selectedId) ?? null;

  const filtersOn =
    search.trim() !== "" ||
    service !== "all" ||
    vendor !== "all" ||
    source !== "all" ||
    status !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  function clearFilters() {
    setSearch("");
    setService("all");
    setVendor("all");
    setSource("all");
    setDateFrom("");
    setDateTo("");
    setStatus("all");
    setPage(1);
  }

  function openLead(lead) {
    setSelectedId(lead.id);
    setDrawerOpen(true);
    if (!activities[lead.id]) loadActivity(lead.id);
  }

  function renderCell(lead, column) {
    switch (column.field) {
      case "name":
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openLead(lead);
            }}
            className="flex w-full items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <LeadAvatar lead={lead} />
            <span className="truncate font-medium text-gray-900">{lead.name}</span>
          </button>
        );
      case "status":
        return <StatusBadge status={lead.status} />;
      case "quotation": {
        const doc = lead.latestQuotation?.document;
        return (
          <span className="inline-flex items-center justify-end gap-1.5">
            {lead.quotation != null ? (
              <span className="font-semibold text-gray-900">{formatINR(lead.quotation)}</span>
            ) : (
              <span className="text-gray-400" aria-label="No quotation yet">
                —
              </span>
            )}
            {doc && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  previewQuotation(lead, { id: lead.latestQuotation.id, document: doc });
                }}
                title={`Preview ${doc.file_name}`}
                aria-label={`Preview quotation file for ${lead.name}`}
                className="rounded-md p-1 text-violet-600 transition-colors hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <FileText className="size-4" />
              </button>
            )}
          </span>
        );
      }
      default: {
        const backendColumn = columnSources[column.field];
        const value = LOGICAL_FIELDS.has(column.field)
          ? lead[column.field]
          : backendColumn
            ? formatValue(lead.row[backendColumn], column.format)
            : null;
        return value ?? <span className="text-gray-400">—</span>;
      }
    }
  }

  const firstRow = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRow = Math.min(currentPage * pageSize, filtered.length);

  // 1 … 4 5 6 … 28
  const pageNumbers = [];
  for (let n = 1; n <= lastPage; n++) {
    if (n === 1 || n === lastPage || Math.abs(n - currentPage) <= 1) pageNumbers.push(n);
    else if (pageNumbers.at(-1) !== "…") pageNumbers.push("…");
  }

  return (
    <section className="mt-6 rounded-2xl bg-white shadow-md shadow-gray-200/70 ring-1 ring-gray-100">
      {/* Title and filters stay on screen while the leads below scroll */}
      <div className="sticky top-0 z-30 rounded-t-2xl bg-white p-6 pb-4 sm:px-8 sm:pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Recent leads</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500">
              <span>
                {loading && !data
                  ? "Loading leads…"
                  : filtersOn
                    ? `${filtered.length.toLocaleString("en-IN")} of ${leads.length.toLocaleString("en-IN")} leads`
                    : `${leads.length.toLocaleString("en-IN")} leads`}
              </span>
              {savedLoadFailed && (
                <span className="text-sm text-amber-700" title="Statuses, quotations and notes couldn't be loaded">
                  Saved changes couldn’t load
                </span>
              )}
              {loadedAt && (
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  disabled={loading}
                  title={`Last loaded ${formatDateTime(loadedAt)}`}
                  className="flex items-center gap-1 text-sm text-brand-700 hover:text-brand-800 disabled:text-gray-400"
                >
                  <RotateCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              )}
            </p>
          </div>
          <Link to="/leads" className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
            View all leads
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <LeadFilters
          search={search}
          onSearchChange={onFilter(setSearch)}
          service={service}
          onServiceChange={handleServiceChange}
          serviceOptions={serviceOptions}
          vendor={vendor}
          onVendorChange={onFilter(setVendor)}
          vendorOptions={vendorOptions}
          source={source}
          onSourceChange={onFilter(setSource)}
          sourceOptions={sourceOptions}
          dateFrom={dateFrom}
          onDateFromChange={onFilter(setDateFrom)}
          dateTo={dateTo}
          onDateToChange={onFilter(setDateTo)}
          status={status}
          onStatusChange={onFilter(setStatus)}
          statusCounts={statusCounts}
          total={scoped.length}
          onClearAll={clearFilters}
        />
      </div>

      {error ? (
        <div className="border-t border-gray-100 px-8 py-12 text-center">
          <p className="text-gray-800">{error.status === 403 ? "Only admin accounts can see leads." : error.message}</p>
          {error.status !== 403 && (
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-3 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Try again
            </button>
          )}
        </div>
      ) : (
        <div
          className={`max-h-[calc(100vh-22rem)] min-h-80 overflow-auto overscroll-contain border-t border-gray-100 transition-opacity ${
            loading && data ? "opacity-60" : ""
          }`}
        >
          <table className="table-fixed text-left" style={{ width: `${tableWidth}rem`, minWidth: "100%" }}>
            <colgroup>
              {TABLE_COLUMNS.map((c, i) => (
                <col key={c.field} style={{ width: `${c.width + (i === 0 ? 2 : 0)}rem` }} />
              ))}
            </colgroup>
            <thead className="text-sm text-gray-500">
              <tr>
                {TABLE_COLUMNS.map((c, i) => (
                  <th
                    key={c.field}
                    scope="col"
                    className={`${cell} sticky top-0 truncate bg-gray-50 py-3 font-medium ${
                      c.align === "right" ? "text-right" : ""
                    } ${i === 0 ? `left-0 z-30 ${headerCornerLine}` : `z-20 ${headerLine}`}`}
                    title={c.label}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((lead) => {
                const active = drawerOpen && selectedId === lead.id;
                return (
                  <tr
                    key={lead.id}
                    onClick={() => openLead(lead)}
                    className={`group cursor-pointer transition-colors hover:bg-brand-50 ${active ? "bg-brand-50" : ""}`}
                  >
                    {TABLE_COLUMNS.map((c, i) => (
                      <td
                        key={c.field}
                        className={`${cell} truncate text-gray-700 ${c.align === "right" ? "text-right tabular-nums" : ""} ${
                          i === 0
                            ? `sticky left-0 z-10 ${nameColumnLine} ${active ? "bg-brand-50" : "bg-white group-hover:bg-brand-50"}`
                            : ""
                        }`}
                      >
                        {renderCell(lead, c)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!loading && filtered.length === 0 && (
            <div className="px-8 py-12 text-center">
              <p className="text-gray-700">{filtersOn ? "No leads match these filters." : "No leads yet."}</p>
              {filtersOn && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-sm font-medium text-brand-700 hover:text-brand-800"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!error && filtered.length > 0 && (
        <div className="flex flex-col items-end gap-3 rounded-b-2xl border-t border-gray-100 px-6 py-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-end sm:gap-6 sm:px-8">
          <div className="flex items-center gap-4">
            <label htmlFor="page-size" className="flex items-center gap-2">
              Rows per page
              <span className="relative">
                <select
                  id="page-size"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="cursor-pointer appearance-none rounded-lg bg-white py-1.5 pr-8 pl-3 font-medium text-gray-900 ring-1 ring-gray-200 hover:ring-gray-300 focus:ring-2 focus:ring-brand-600 focus:outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
              </span>
            </label>
            <span className="text-gray-500">
              {firstRow.toLocaleString("en-IN")}–{lastRow.toLocaleString("en-IN")} of{" "}
              {filtered.length.toLocaleString("en-IN")}
            </span>
          </div>

          {lastPage > 1 && (
            <nav aria-label="Pages" className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Previous page"
                className="rounded-lg p-2 ring-1 ring-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              {pageNumbers.map((n, i) =>
                n === "…" ? (
                  <span key={`gap-${i}`} className="px-1.5 text-gray-400">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === currentPage ? "page" : undefined}
                    className={`min-w-9 rounded-lg px-2.5 py-1.5 font-medium tabular-nums transition-colors ${
                      n === currentPage ? "bg-brand-700 text-white" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={currentPage >= lastPage}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Next page"
                className="rounded-lg p-2 ring-1 ring-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </nav>
          )}
        </div>
      )}

      <LeadDrawer
        lead={selected}
        open={drawerOpen}
        onClose={closeDrawer}
        actions={actions}
        loadError={selected ? activityErrors[selected.id] : null}
        onRetry={() => selected && loadActivity(selected.id)}
        onPreview={(quotation) => selected && previewQuotation(selected, quotation)}
      />
      <QuotationPreview preview={preview} onClose={closePreview} />
    </section>
  );
}