import { useState } from "react";
import { CalendarDays, ChevronDown, Search, X } from "lucide-react";
import { STATUSES } from "../../data/leads.js";
import { STATUS_STYLES } from "../../data/statusStyles.js";
import { formatDate } from "../../utils/format.js";

const statusById = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

const fieldClass =
  "w-full cursor-pointer appearance-none truncate rounded-xl bg-white py-2.5 pr-10 pl-4 text-sm text-gray-800 ring-1 ring-gray-200 transition-shadow hover:ring-gray-300 focus:ring-2 focus:ring-brand-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

// ── Dates ───────────────────────────────────────────────────────────────
// Date -> "2026-10-01" in local time (what <input type="date"> uses)
function toInput(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const DATE_PRESETS = [
  { id: "today", label: "Today", range: () => [new Date(), new Date()] },
  { id: "yesterday", label: "Yesterday", range: () => [daysAgo(1), daysAgo(1)] },
  { id: "last7", label: "Last 7 days", range: () => [daysAgo(6), new Date()] },
  { id: "last30", label: "Last 30 days", range: () => [daysAgo(29), new Date()] },
  {
    id: "thisMonth",
    label: "This month",
    range: () => {
      const now = new Date();
      return [new Date(now.getFullYear(), now.getMonth(), 1), now];
    },
  },
  {
    id: "lastMonth",
    label: "Last month",
    range: () => {
      const now = new Date();
      return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)];
    },
  },
];

function presetFor(from, to) {
  return DATE_PRESETS.find((p) => {
    const [a, b] = p.range();
    return toInput(a) === from && toInput(b) === to;
  });
}

function dateChipLabel(from, to) {
  const f = from && formatDate(new Date(`${from}T00:00:00`));
  const t = to && formatDate(new Date(`${to}T00:00:00`));
  if (f && t) return f === t ? f : `${f} – ${t}`;
  return f ? `From ${f}` : `Until ${t}`;
}

// ── Building blocks ─────────────────────────────────────────────────────
function Field({ label, htmlFor, className = "", children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({ id, value, onChange, disabled, title, children }) {
  return (
    <div className="relative" title={title}>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-400"
        aria-hidden="true"
      />
    </div>
  );
}

function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pr-1 pl-3 text-sm text-brand-800 ring-1 ring-brand-100">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="rounded-full p-0.5 text-brand-700/70 transition-colors hover:bg-brand-100 hover:text-brand-800"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

// Filters on the left, search on the right, status pills underneath,
// then the active filters as chips that can be removed one by one.
export default function LeadFilters({
  search,
  onSearchChange,
  service,
  onServiceChange,
  serviceOptions,
  vendor,
  onVendorChange,
  vendorOptions,
  source,
  onSourceChange,
  sourceOptions,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  status,
  onStatusChange,
  statusCounts,
  total,
  onClearAll,
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const hasDates = Boolean(dateFrom || dateTo);
  const preset = presetFor(dateFrom, dateTo);
  const dateChoice = preset ? preset.id : hasDates || customOpen ? "custom" : "any";
  const showDateInputs = dateChoice === "custom";

  function chooseDate(id) {
    if (id === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    if (id === "any") {
      onDateFromChange("");
      onDateToChange("");
      return;
    }
    const [from, to] = DATE_PRESETS.find((p) => p.id === id).range();
    onDateFromChange(toInput(from));
    onDateToChange(toInput(to));
  }

  function clearDates() {
    setCustomOpen(false);
    onDateFromChange("");
    onDateToChange("");
  }

  const chips = [
    service !== "all" && { key: "service", label: `Service: ${service}`, remove: () => onServiceChange("all") },
    vendor !== "all" && { key: "vendor", label: `Vendor: ${vendor}`, remove: () => onVendorChange("all") },
    source !== "all" && { key: "source", label: `Source: ${source}`, remove: () => onSourceChange("all") },
    hasDates && {
      key: "date",
      label: `Created: ${preset ? preset.label : dateChipLabel(dateFrom, dateTo)}`,
      remove: clearDates,
    },
    status !== "all" && {
      key: "status",
      label: `Status: ${statusById[status]?.label ?? status}`,
      remove: () => onStatusChange("all"),
    },
    search.trim() && { key: "search", label: `Search: “${search.trim()}”`, remove: () => onSearchChange("") },
  ].filter(Boolean);

  const statusPills = [{ id: "all", label: "All" }, ...STATUSES];

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <Field label="Service" htmlFor="service-filter" className="lg:w-44">
          <Select id="service-filter" value={service} onChange={onServiceChange}>
            <option value="all">All services</option>
            {serviceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        {/* Vendors appear only after a service is picked, and only that service's vendors */}
        <Field label="Vendor" htmlFor="vendor-filter" className="lg:w-48">
          <Select
            id="vendor-filter"
            value={vendor}
            onChange={onVendorChange}
            disabled={service === "all"}
            title={service === "all" ? "Pick a service to see its vendors" : undefined}
          >
            <option value="all">{service === "all" ? "Pick a service first" : "All vendors"}</option>
            {vendorOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Source" htmlFor="source-filter" className="lg:w-40">
          <Select id="source-filter" value={source} onChange={onSourceChange}>
            <option value="all">All sources</option>
            {sourceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Created" htmlFor="date-preset" className="lg:w-40">
          <div className="relative">
            <CalendarDays
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <select
              id="date-preset"
              value={dateChoice}
              onChange={(e) => chooseDate(e.target.value)}
              className={`${fieldClass} pl-10`}
            >
              <option value="any">Any time</option>
              {DATE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom range…</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
          </div>
        </Field>

        {showDateInputs && (
          <div role="group" aria-label="Custom date range" className="flex items-end gap-2">
            <Field label="From" htmlFor="date-from">
              <input
                id="date-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="rounded-xl bg-white px-3 py-2 text-sm text-gray-800 ring-1 ring-gray-200 hover:ring-gray-300 focus:ring-2 focus:ring-brand-600 focus:outline-none"
              />
            </Field>
            <Field label="To" htmlFor="date-to">
              <input
                id="date-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => onDateToChange(e.target.value)}
                className="rounded-xl bg-white px-3 py-2 text-sm text-gray-800 ring-1 ring-gray-200 hover:ring-gray-300 focus:ring-2 focus:ring-brand-600 focus:outline-none"
              />
            </Field>
          </div>
        )}

        <Field label="Search" htmlFor="lead-search" className="lg:ml-auto lg:w-72">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              id="lead-search"
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Name, phone or email"
              className="w-full rounded-xl bg-white py-2.5 pr-4 pl-10 text-sm text-gray-800 ring-1 ring-gray-200 placeholder:text-gray-400 hover:ring-gray-300 focus:ring-2 focus:ring-brand-600 focus:outline-none"
            />
          </div>
        </Field>
      </div>

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {statusPills.map((s) => {
          const active = s.id === status;
          const count = s.id === "all" ? total : (statusCounts[s.id] ?? 0);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => onStatusChange(s.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                active ? "bg-gray-900 text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {s.id !== "all" && (
                <span className={`size-2 rounded-full ${STATUS_STYLES[s.id]?.dot}`} aria-hidden="true" />
              )}
              {s.label}
              <span
                className={`min-w-6 rounded-full px-1.5 text-center text-xs ${
                  active ? "bg-white/20 text-white" : "bg-white text-gray-500"
                }`}
              >
                {count.toLocaleString("en-IN")}
              </span>
            </button>
          );
        })}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-gray-200 pt-4">
          <span className="text-sm text-gray-500">Showing leads with</span>
          {chips.map((c) => (
            <Chip key={c.key} label={c.label} onRemove={c.remove} />
          ))}
          <button
            type="button"
            onClick={() => {
              setCustomOpen(false);
              onClearAll();
            }}
            className="ml-1 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}