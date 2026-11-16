import { useEffect, useRef, useState } from "react";
import { Filter, SlidersHorizontal, X } from "lucide-react";
import FilterSelect from "../dashboard/FilterSelect.jsx";
import PeriodFilter from "../dashboard/PeriodFilter.jsx";
import { todayIst } from "../../pages/dashboardPeriod.js";
import { SearchBox, useDebounced } from "./LeadKit.jsx";
import MultiSelect from "./MultiSelect.jsx";
import PincodePicker from "./PincodePicker.jsx";
import { PENDING, SOURCES as KOC_SOURCES, STATUSES } from "../vendorToKoc/kocUtils.js";
import {
  branchName,
  buildQuote,
  filtersOfPeriod,
  INTEREST_LABELS,
  KOC,
  NOT_SHARED,
  ORIGIN_LABELS,
  parseQuote,
  periodOfFilters,
  readFilters,
  toApiQuery,
  UPCOMING_DAYS,
  withCount,
  withFilters,
} from "./leadFilters.js";
import { filterChips } from "./filterChips.js";

// One filter bar for the lead lists (docs/API_REFERENCE.md sections 10 and 11): a row with the
// search box, the date control (as on the Dashboard), a "Filters" button (count of the panel's
// filters) and Sort; the button opens a panel with the other filter options, edited as a draft
// until Apply (Clear removes them; the date stays). Active filters
// show as removable chips under the row. All values live in the URL (useLeadFilters).
// Names are shown for choices, never ids.
//   options:     GET /{list}/filter-options
//   sorts:       the page's sort options; sortValue: the current one
//   renderSearch({ value, onChange }): a custom search box (Spin's suggestions)
// source "vendor_to_koc" (Vendors → KOC, docs section 11) shows its own filters instead of the
// CRM ones: Received date, Lead date, Vendor / Update / Follow-up (admins), City, Source.

const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500";
const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:bg-gray-50 disabled:text-gray-400";

// A text box that writes normalize(text) to the panel's draft as you type (no requests are
// made until Apply). It follows outside changes without undoing what's being typed.
const trimText = (v) => v.trim();
function DebouncedInput({ value, onCommit, normalize = trimText, ...props }) {
  const [text, setText] = useState(value ?? "");
  const settled = useDebounced(text, 0);
  useEffect(() => {
    if (normalize(text) !== (value ?? "")) setText(value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  useEffect(() => {
    if (normalize(settled) !== (value ?? "")) onCommit(normalize(settled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);
  return <input value={text} onChange={(e) => setText(e.target.value)} {...props} />;
}
const digitsOnly = (v) => v.replace(/\D/g, "");

function Field({ label, children, wide = false, hint }) {
  return (
    <div className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-tight text-gray-400">{hint}</span>}
    </div>
  );
}

function Select({ value, onChange, options, label }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Range({ label, min, max, onMin, onMax, rupees = false }) {
  const box = (value, onCommit, placeholder) => (
    <span className="relative block min-w-0 flex-1">
      {rupees && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
      )}
      <DebouncedInput
        value={value}
        normalize={digitsOnly}
        onCommit={onCommit}
        inputMode="numeric"
        placeholder={placeholder}
        aria-label={`${label} ${placeholder.toLowerCase()}`}
        className={`${inputCls} ${rupees ? "pl-7" : ""}`}
      />
    </span>
  );
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        {box(min, onMin, "Min")}
        <span className="text-gray-400">–</span>
        {box(max, onMax, "Max")}
      </div>
    </Field>
  );
}

const counted = (list, label = (v) => v) =>
  (list ?? []).map((o) => ({ value: String(o.value), label: withCount(label(o.value), o.count), name: label(o.value) }));
const partnerLabel = (v) => (v === NOT_SHARED ? "Not shared yet" : v);
const budgetLabel = (v) => (/^\d/.test(String(v)) ? `₹${String(v).replace(/[-_]/g, "–")}` : String(v));


// Every filter option, for the panel. filters / update are the panel's draft.
function FilterControls({ source, filters, update, options, isAdmin, today }) {
  const o = options ?? {};
  const isKoc = source === KOC;

  // Event date: Any | Upcoming 30 days | Date range
  const eventChosen = filters.upcoming_days ? "upcoming" : filters.event_from || filters.event_to ? "range" : "";
  const [eventMode, setEventMode] = useState(eventChosen);
  // Follow the URL, except right after this control cleared it itself (e.g. Upcoming -> Date
  // range with no dates yet), so the choice doesn't jump back to "Any"
  const skipEventSync = useRef(false);
  useEffect(() => {
    if (skipEventSync.current) {
      skipEventSync.current = false;
      return;
    }
    setEventMode(eventChosen);
  }, [eventChosen]);

  // Quoted amount: Any | Has a quote | No quote | More than | Less than (+ amount)
  const quote = parseQuote(filters.quote);
  const [quoteOp, setQuoteOp] = useState(quote.op);
  const skipQuoteSync = useRef(false); // as above: "More than" with no amount yet stays chosen
  useEffect(() => {
    if (skipQuoteSync.current) {
      skipQuoteSync.current = false;
      return;
    }
    setQuoteOp(quote.op);
  }, [quote.op]);

  // Assigned to: Unassigned + vendors (admins only)
  const assigned = [...(filters.unassigned ? ["unassigned"] : []), ...filters.vendor_id];
  const vendorOptions = [
    { value: "unassigned", label: "Unassigned", name: "Unassigned" },
    ...(o.vendors ?? []).map((v) => ({ value: String(v.id), label: v.name, name: v.name })),
  ];
  const interestOptions = o.interests
    ? counted(o.interests, (v) => INTEREST_LABELS[v] ?? v)
    : Object.entries(INTEREST_LABELS).map(([value, label]) => ({ value, label, name: label }));
  const originOptions = counted(o.origins, (v) => ORIGIN_LABELS[v] ?? v);
  const partnerOptions = [
    { value: "", label: "Anyone" },
    ...counted(o.shared_with, partnerLabel).map((x) => ({ value: x.value, label: x.label })),
  ];

  return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {!isKoc && (
        <Field
          label="Event date"
          wide
          hint="Leads with an approximate event date, like 'April 2027', aren't included"
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Event date"
              value={eventMode}
              onChange={(e) => {
                const v = e.target.value;
                setEventMode(v);
                if (v === "upcoming") update({ upcoming_days: UPCOMING_DAYS, event_from: "", event_to: "" });
                else if (v === "") update({ upcoming_days: "", event_from: "", event_to: "" });
                else {
                  if (eventChosen === "upcoming") skipEventSync.current = true; // becomes "" in the URL
                  update({ upcoming_days: "" });
                }
              }}
              className={`${inputCls} w-auto`}
            >
              <option value="">Any</option>
              <option value="upcoming">Upcoming 30 days</option>
              <option value="range">Date range</option>
            </select>
            {eventMode === "range" && (
              <>
                <input
                  type="date"
                  aria-label="Event from"
                  value={filters.event_from}
                  max={filters.event_to || undefined}
                  onChange={(e) => update({ event_from: e.target.value })}
                  className={`${inputCls} w-auto`}
                />
                <span className="text-gray-400">–</span>
                <input
                  type="date"
                  aria-label="Event to"
                  value={filters.event_to}
                  min={filters.event_from || undefined}
                  onChange={(e) => update({ event_to: e.target.value })}
                  className={`${inputCls} w-auto`}
                />
              </>
            )}
          </div>
        </Field>
        )}

        {/* Vendors → KOC */}
        {isKoc && (
          <>
            <Field label="Lead date" wide>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  aria-label="Lead date from"
                  value={filters.lead_date_from}
                  max={filters.lead_date_to || undefined}
                  onChange={(e) => update({ lead_date_from: e.target.value })}
                  className={`${inputCls} w-auto`}
                />
                <span className="text-gray-400">–</span>
                <input
                  type="date"
                  aria-label="Lead date to"
                  value={filters.lead_date_to}
                  min={filters.lead_date_from || undefined}
                  onChange={(e) => update({ lead_date_to: e.target.value })}
                  className={`${inputCls} w-auto`}
                />
              </div>
            </Field>
            {/* Vendor: admins only; Update and Follow-up: everyone */}
            {isAdmin && (
                <Field label="Vendor">
                  <MultiSelect
                    label="Vendor"
                    anyLabel="All vendors"
                    options={(o.vendors ?? []).map((v) => ({ value: String(v.id), label: v.name, name: v.name }))}
                    value={filters.vendor_id}
                    onChange={(vals) => update({ vendor_id: vals })}
                  />
                </Field>
            )}
              <>
                <Field label="Update">
                  <MultiSelect
                    label="Update"
                    options={[{ value: PENDING, label: "Pending", name: "Pending" }, ...STATUSES.map((x) => ({ ...x, name: x.label }))]}
                    value={filters.update_status}
                    onChange={(vals) => update({ update_status: vals })}
                  />
                </Field>
                <Field label="Follow-up" wide>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      aria-label="Follow-up from"
                      value={filters.follow_up_from}
                      max={filters.follow_up_to || undefined}
                      onChange={(e) => update({ follow_up_from: e.target.value })}
                      className={`${inputCls} w-auto`}
                    />
                    <span className="text-gray-400">–</span>
                    <input
                      type="date"
                      aria-label="Follow-up to"
                      value={filters.follow_up_to}
                      min={filters.follow_up_from || undefined}
                      onChange={(e) => update({ follow_up_to: e.target.value })}
                      className={`${inputCls} w-auto`}
                    />
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={filters.follow_up_due === "true"}
                        onChange={(e) => update({ follow_up_due: e.target.checked ? "true" : "" })}
                        className="h-4 w-4 accent-brand-600"
                      />
                      Due
                    </label>
                  </div>
                </Field>
              </>
            <Field label="City">
              <DebouncedInput
                value={filters.city}
                onCommit={(v) => update({ city: v })}
                placeholder="Any city"
                aria-label="City"
                className={inputCls}
              />
            </Field>
            <Field label="Source">
              <MultiSelect
                label="Source"
                options={KOC_SOURCES.map((x) => ({ ...x, name: x.label }))}
                value={filters.source}
                onChange={(vals) => update({ source: vals })}
              />
            </Field>
          </>
        )}

        {/* Per source */}
        {source === "spin" && (
          <>
            <Field label="Branch">
              <Select
                label="Branch"
                value={filters.branch}
                onChange={(v) => update({ branch: v })}
                options={[
                  { value: "", label: "All branches" },
                  ...(o.branches ?? []).map((b) => ({ value: String(b.id), label: withCount(branchName(b), b.count) })),
                ]}
              />
            </Field>
            <Field label="Pincode">
              <PincodePicker value={filters.pincode} onChange={(v) => update({ pincode: v })} options={o.pincodes ?? []} />
            </Field>
            <Field label="Budget">
              <Select
                label="Budget"
                value={filters.budget}
                onChange={(v) => update({ budget: v })}
                options={[{ value: "", label: "Any budget" }, ...counted(o.budgets, budgetLabel)]}
              />
            </Field>
          </>
        )}
        {source === "whatsapp" && (
          <Field label="Country">
            <Select
              label="Country"
              value={filters.country}
              onChange={(v) => update({ country: v })}
              options={[{ value: "", label: "All countries" }, ...counted(o.countries)]}
            />
          </Field>
        )}
        {source === "wedding" && (
          <Field label="Occasion">
            <Select
              label="Occasion"
              value={filters.occasion}
              onChange={(v) => update({ occasion: v })}
              options={[{ value: "", label: "All occasions" }, ...counted(o.occasions)]}
            />
          </Field>
        )}
        {(source === "wedding" || source === "wedding_planner") && (
          <Field label={source === "wedding" ? "City" : "Wedding city"}>
            <DebouncedInput
              value={filters.city}
              onCommit={(v) => update({ city: v })}
              list={`cities-${source}`}
              placeholder="Any city"
              aria-label="City"
              className={inputCls}
            />
            <datalist id={`cities-${source}`}>
              {(o.cities ?? []).map((c) => (
                <option key={c.value} value={c.value} />
              ))}
            </datalist>
          </Field>
        )}
        {source === "wedding_planner" && (
          <Range
            label="Guests"
            min={filters.guests_min}
            max={filters.guests_max}
            onMin={(v) => update({ guests_min: v })}
            onMax={(v) => update({ guests_max: v })}
          />
        )}
        {(source === "wedding" || source === "wedding_planner") && (
          <Range
            label="Budget"
            rupees
            min={filters.budget_min}
            max={filters.budget_max}
            onMin={(v) => update({ budget_min: v })}
            onMax={(v) => update({ budget_max: v })}
          />
        )}
        {source === "wedding_planner" && (
          <>
            <Field label="Fits budget">
              <Select
                label="Fits budget"
                value={filters.fits_budget}
                onChange={(v) => update({ fits_budget: v })}
                options={[
                  { value: "", label: "Any" },
                  { value: "true", label: "Fits budget" },
                  { value: "false", label: "Over budget" },
                ]}
              />
            </Field>
            <Field label="Step">
              <Select
                label="Step"
                value={filters.last_step}
                onChange={(v) => update({ last_step: v })}
                options={[{ value: "", label: "Any" }, ...counted(o.last_steps)]}
              />
            </Field>
          </>
        )}
        {(source === "wedding" || source === "wedding_planner") && (
          <Field label="Sheet partner">
            <Select
              label="Sheet partner"
              value={filters.shared_with}
              onChange={(v) => update({ shared_with: v })}
              options={partnerOptions}
            />
          </Field>
        )}

        {/* Common CRM filters (not for Vendors → KOC) */}
        {!isKoc && isAdmin && (
          <Field label="Assigned to">
            <MultiSelect
              label="Assigned to"
              anyLabel="Anyone"
              options={vendorOptions}
              value={assigned}
              onChange={(vals) =>
                update({
                  vendor_id: vals.filter((v) => v !== "unassigned"),
                  unassigned: vals.includes("unassigned") ? "true" : "",
                })
              }
            />
          </Field>
        )}
        {!isKoc && (
        <>
        <Field label="Interest">
          <MultiSelect
            label="Interest"
            options={interestOptions}
            value={filters.interest}
            onChange={(vals) => update({ interest: vals })}
          />
        </Field>
        <Field label="Quoted amount" wide>
          <div className="flex gap-2">
            <select
              aria-label="Quoted amount"
              value={quoteOp}
              onChange={(e) => {
                const op = e.target.value;
                setQuoteOp(op);
                const next = buildQuote(op, quote.amount);
                const nextOp = parseQuote(next).op;
                if (nextOp !== quote.op && nextOp !== op) skipQuoteSync.current = true;
                update({ quote: next });
              }}
              className={`${inputCls} w-40 flex-none`}
            >
              <option value="">Any quote</option>
              <option value="has">Has a quote</option>
              <option value="none">No quote yet</option>
              <option value="gt">More than</option>
              <option value="lt">Less than</option>
            </select>
            <span className="relative block min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
              <DebouncedInput
                value={quote.amount}
                normalize={digitsOnly}
                onCommit={(v) => update({ quote: buildQuote(quoteOp, v) })}
                disabled={quoteOp !== "gt" && quoteOp !== "lt"}
                inputMode="numeric"
                placeholder={quoteOp === "gt" || quoteOp === "lt" ? "Amount" : "Pick an option"}
                aria-label="Quoted amount value"
                className={`${inputCls} pl-7`}
              />
            </span>
          </div>
        </Field>
        <Field label="Converted">
          <Select
            label="Converted"
            value={filters.converted}
            onChange={(v) => update({ converted: v })}
            options={[
              { value: "", label: "Any" },
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </Field>
        <Field label="Origin">
          <MultiSelect
            label="Origin"
            options={originOptions}
            value={filters.origin}
            onChange={(vals) => update({ origin: vals })}
          />
        </Field>
        </>
        )}
        {source === "wedding" && (
          <Field label="Repeats">
            <label className="flex h-[38px] cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={filters.hide_repeats === "true"}
                onChange={(e) => update({ hide_repeats: e.target.checked ? "true" : "" })}
                className="h-4 w-4 accent-brand-600"
              />
              Hide repeats
            </label>
          </Field>
        )}
      </div>
  );
}

export default function LeadFilterBar({
  source,
  filters,
  update,
  clear,
  apply,
  clearFilters,
  count,
  options,
  isAdmin,
  sorts,
  sortValue,
  placeholder = "Search…",
  renderSearch,
}) {
  const today = todayIst();

  // Search (in the row): typed text goes to the URL after a pause
  const [searchText, setSearchText] = useState(filters.search);
  const settledSearch = useDebounced(searchText.trim());
  useEffect(() => {
    if (searchText.trim() !== filters.search) setSearchText(filters.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);
  useEffect(() => {
    if (settledSearch !== filters.search) update({ search: settledSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledSearch]);

  // The panel edits a draft (URL-style params) until Apply
  const [draft, setDraft] = useState(null);
  const open = draft !== null;
  const openPanel = () => setDraft(withFilters(new URLSearchParams(), toApiQuery({ ...filters, search: "" }, source)));
  const draftFilters = open ? readFilters(draft, source) : filters;
  const draftUpdate = (updates) => setDraft((d) => withFilters(d, updates));

  const chips = filterChips(filters, source, options, isAdmin);
  // The Filters badge counts the panel's filters (the date has its own control in the row)
  const panelCount = count - (filters.date_from || filters.date_to ? 1 : 0);
  // Removing a chip (or Clear all) closes the panel, so an open draft can't bring it back
  const removeChip = (keys) => {
    setDraft(null);
    update(Object.fromEntries(keys.map((k) => [k, ""])));
  };

  const searchBox = renderSearch ? (
    renderSearch({ value: searchText, onChange: setSearchText })
  ) : (
    <SearchBox value={searchText} onChange={setSearchText} placeholder={placeholder} />
  );

  return (
    <div className="w-full rounded-2xl bg-gray-50/80 p-4 ring-1 ring-gray-100">
      <div className="flex flex-wrap items-start gap-3">
        {searchBox}
        {/* Arrival (lists) / received (Vendors → KOC) date, as on the Dashboard; applies at once */}
        <div title={source === KOC ? "Received date" : "Arrival date"}>
          <PeriodFilter
            alignStart
            period={periodOfFilters(filters)}
            today={today}
            onChange={(p) => {
              setDraft(null);
              update(filtersOfPeriod(p));
            }}
          />
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => (open ? setDraft(null) : openPanel())}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${
            open || panelCount > 0
              ? "bg-white text-brand-800 ring-brand-200"
              : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
          }`}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          Filters
          {panelCount > 0 && (
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">{panelCount}</span>
          )}
        </button>
        <div className="ml-auto">
          <FilterSelect label="Sort" value={sortValue} onChange={(v) => update({ sort: v })} options={sorts} />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-white py-1 pl-3 pr-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200"
            >
              {c.label}
              <button
                type="button"
                onClick={() => removeChip(c.keys)}
                aria-label={`Remove filter ${c.label}`}
                className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setSearchText("");
              clear();
            }}
            className="px-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {open && (
        <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-gray-100">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Filter size={15} className="text-brand-600" aria-hidden="true" /> Filters
          </p>
          <FilterControls
            source={source}
            filters={draftFilters}
            update={draftUpdate}
            options={options}
            isAdmin={isAdmin}
            today={today}
          />
          <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => {
                clearFilters();
                setDraft(null);
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                apply(draft);
                setDraft(null);
              }}
              className="rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-6 py-2 text-sm font-semibold text-white shadow-md shadow-brand-700/25"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
