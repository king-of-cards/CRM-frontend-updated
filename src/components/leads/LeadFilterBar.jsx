import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import FilterSelect from "../dashboard/FilterSelect.jsx";
import PeriodFilter from "../dashboard/PeriodFilter.jsx";
import DateInput from "../shared/DateInput.jsx";
import { todayIst } from "../../pages/dashboardPeriod.js";
import { SearchBox } from "./LeadKit.jsx";
import { SOURCES as KOC_SOURCES } from "../vendorToKoc/kocUtils.js";
import FilterDropdown from "./FilterDropdown.jsx";
import { buildFilterButtons } from "./filterButtons.js";
import { otherServiceOptions } from "./otherServices.js";
import { DHRUVA, FOLLOW_UP_LABELS, KOC, KOC_TO_DHRUVA, NOT_SHARED, ORIGIN_LABELS, UPDATE_LABELS } from "./leadFilters.js";

const input = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";
const text = (v) => String(v ?? "");
const updateLabel = (key, update) => (value) => update({ [key]: value });
const dateKeys = {
  event: ["event_from", "event_to"], lead_date: ["lead_date_from", "lead_date_to"], follow_up: ["follow_up_from", "follow_up_to"],
};

function ChoiceList({ options, value, onChange, multi = false, search = false }) {
  const [query, setQuery] = useState("");
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
  return <div className="min-w-52">
    {search && <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" aria-label="Search filter options" className={`${input} mb-2`} />}
    <div className="max-h-64 overflow-y-auto">
      {options.length > 0 && !multi && <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-gray-50"><input type="radio" checked={!selected.length} onChange={() => onChange("")} />Any</label>}
      {filtered.map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-gray-50">
        <input type={multi ? "checkbox" : "radio"} checked={selected.includes(String(option.value))} onChange={() => onChange(multi ? (selected.includes(String(option.value)) ? selected.filter((v) => v !== String(option.value)) : [...selected, String(option.value)]) : String(option.value))} />
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
      </label>)}
      {!filtered.length && <p className="px-2 py-3 text-sm text-gray-400">No options</p>}
    </div>
  </div>;
}

function RangeDates({ fromKey, toKey, filters, update, maxDate }) {
  return <div className="flex items-center gap-2">
    <DateInput type="date" aria-label="From date" value={filters[fromKey] || ""} max={filters[toKey] || maxDate || undefined} onChange={(e) => update({ [fromKey]: e.target.value })} className={`${input} min-w-0`} />
    <span className="text-gray-400">–</span>
    <DateInput type="date" aria-label="To date" value={filters[toKey] || ""} min={filters[fromKey] || undefined} max={maxDate || undefined} onChange={(e) => update({ [toKey]: e.target.value })} className={`${input} min-w-0`} />
  </div>;
}

function FilterContents({ button, source, filters, update, options, isAdmin }) {
  const k = button.kind;
  const countOptions = (items = [], name = (v) => String(v)) => items.map((o) => ({ value: String(o.value), label: `${name(o.value)}${o.count == null ? "" : ` (${o.count})`}` }));
  const single = (key, opts, searchable = false) => <ChoiceList options={opts} value={filters[key]} onChange={updateLabel(key, update)} search={searchable || opts.length > 10} />;
  const multi = (key, opts, searchable = false) => <ChoiceList options={opts} value={filters[key] ?? []} onChange={updateLabel(key, update)} multi search={searchable || opts.length > 10} />;
  if (dateKeys[k]) return <RangeDates fromKey={dateKeys[k][0]} toKey={dateKeys[k][1]} filters={filters} update={update} />;
  if (k === "event") return <div className="space-y-2">{source === DHRUVA && <p className="px-2 text-xs text-gray-500">Matches any of a lead's event dates.</p>}<button type="button" onClick={() => update({ upcoming_days: filters.upcoming_days ? "" : "30", event_from: "", event_to: "" })} className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-50">{filters.upcoming_days ? "Any event date" : "Upcoming 30 days"}</button><RangeDates fromKey="event_from" toKey="event_to" filters={filters} update={(u) => update({ ...u, upcoming_days: "" })} /></div>;
  if (k === "follow_up") return <div className="space-y-2"><RangeDates fromKey="follow_up_from" toKey="follow_up_to" filters={filters} update={update} /><button type="button" onClick={() => update({ follow_up_due: filters.follow_up_due ? "" : "true" })} className={`w-full rounded-lg px-2 py-2 text-left text-sm ${filters.follow_up_due ? "bg-brand-50 text-brand-800" : "hover:bg-gray-50"}`}>{filters.follow_up_due ? "✓ Due" : "Due"}</button></div>;
  if (["venue", "city", "country", "pincode", "last_step", "occasion", "budget"].includes(k)) {
    const key = k === "occasion" ? "occasion" : k;
    let opts = [];
    if (k === "venue") opts = countOptions(options.venues);
    if (k === "city") opts = countOptions(options.cities);
    if (k === "country") opts = countOptions(options.countries);
    if (k === "pincode") opts = countOptions(options.pincodes, (v) => String(v));
    if (k === "last_step") opts = countOptions(options.last_steps);
    if (k === "occasion") opts = countOptions(options.occasions);
    if (k === "budget") opts = countOptions(options.budgets);
    const active = text(filters[key]);
    // KOC → Dhruva's occasion filter matches "contains", so it can be typed too
    const freeText = ["venue", "city", "pincode"].includes(k) || (k === "occasion" && source === KOC_TO_DHRUVA);
    return <div className="space-y-2">{freeText && <input value={active} onChange={(e) => update({ [key]: e.target.value })} aria-label={button.label} placeholder={`Filter ${button.label.toLowerCase()}`} className={input} />}{opts.length > 0 && single(key, opts, true)}{!freeText && !opts.length && single(key, opts, true)}</div>;
  }
  // Spin's Other services: one value (the API's other_services is a single "contains" filter)
  if (k === "other_services") return single("other_services", otherServiceOptions(options.other_services), true);
  if (k === "follow_when") return single("follow_up", Object.entries(FOLLOW_UP_LABELS).map(([value, label]) => ({ value, label })));
  if (k === "quantity") {
    const range = options.quantity_range ?? {};
    return <div className="grid grid-cols-2 gap-2"><input value={filters.quantity_min || ""} onChange={(e) => update({ quantity_min: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder={range.min != null ? `Min (${range.min})` : "Min"} aria-label="Quantity minimum" className={input} /><input value={filters.quantity_max || ""} onChange={(e) => update({ quantity_max: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder={range.max != null ? `Max (${range.max})` : "Max"} aria-label="Quantity maximum" className={input} /></div>;
  }
  if (k === "event_type") return multi("event_type", countOptions(options.event_types), true);
  if (k === "source") return multi("source", (options.sources ?? KOC_SOURCES).map((o) => ({ value: String(o.value), label: o.label ?? String(o.value) })));
  if (k === "update") {
    const opts = source === KOC ? [{ value: "pending", label: "Pending" }, ...Object.entries(UPDATE_LABELS).filter(([v]) => v !== "pending").map(([value, label]) => ({ value, label }))] : countOptions(options.updates, (v) => UPDATE_LABELS[v] ?? v);
    return multi("update_status", opts);
  }
  if (k === "vendor") return multi("vendor_id", (options.vendors ?? []).map((v) => ({ value: String(v.id), label: v.name })), true);
  if (k === "assigned") {
    const values = [...(filters.unassigned ? ["unassigned"] : []), ...(filters.vendor_id ?? [])];
    const opts = [{ value: "unassigned", label: "Unassigned" }, ...(options.vendors ?? []).map((v) => ({ value: String(v.id), label: v.name }))];
    return <ChoiceList options={opts} value={values} multi search onChange={(next) => update({ vendor_id: next.filter((v) => v !== "unassigned"), unassigned: next.includes("unassigned") ? "true" : "" })} />;
  }
  if (k === "branch") return single("branch", (options.branches ?? []).map((b) => ({ value: String(b.id), label: `${b.name || `Branch #${b.id}`}${b.count == null ? "" : ` (${b.count})`}` })), true);
  if (k === "origin") return multi("origin", countOptions(options.origins, (v) => ORIGIN_LABELS[v] ?? v));
  if (k === "shared_with") return single("shared_with", [{ value: NOT_SHARED, label: "Not shared yet" }, ...(options.shared_with ?? []).map((o) => ({ value: String(o.value), label: String(o.value) }))], true);
  if (k === "hot" || k === "hide_repeats") return <button type="button" onClick={() => update({ [k]: filters[k] ? "" : k === "hot" ? "yes" : "true" })} className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-50">{filters[k] ? "✓ " : ""}{button.label}</button>;
  if (k === "needs_intervention") {
    const count = (v) => (options.needs_intervention ?? []).find((o) => String(o.value).toLowerCase() === v || String(o.value) === String(v === "yes"))?.count;
    const label = (v, text) => (count(v) == null ? text : `${text} (${count(v)})`);
    return single("needs_intervention", [{ value: "yes", label: label("yes", "Yes") }, { value: "no", label: label("no", "No") }]);
  }
  if (k === "has_phone" || k === "also_in" || k === "fits_budget") {
    const opts = k === "has_phone" ? [{ value: "yes", label: "Has phone" }, { value: "no", label: "No phone" }] : k === "also_in" ? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] : [{ value: "true", label: "Fits budget" }, { value: "false", label: "Over budget" }];
    return single(k, opts);
  }
  if (k === "quote" || k === "conversion") {
    const value = filters[k] || "";
    const match = /^(gt|lt):(\d+)$/.exec(value);
    const op = match?.[1] ?? value;
    const amount = match?.[2] ?? "";
    const set = (nextOp, nextAmount = amount) => update({ [k]: nextOp === "gt" || nextOp === "lt" ? nextAmount ? `${nextOp}:${nextAmount}` : "" : nextOp });
    return <div className="space-y-2"><select aria-label={button.label} value={op} onChange={(e) => set(e.target.value)} className={input}><option value="">Any</option><option value="has">Has amount</option><option value="none">No amount</option><option value="gt">More than</option><option value="lt">Less than</option></select>{(op === "gt" || op === "lt") && <input value={amount} onChange={(e) => set(op, e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Amount" aria-label={`${button.label} amount`} className={input} />}</div>;
  }
  if (k === "budget_range" || k === "guests") {
    const prefix = k === "guests" ? "guests" : "budget";
    return <div className="grid grid-cols-2 gap-2"><input value={filters[`${prefix}_min`] || ""} onChange={(e) => update({ [`${prefix}_min`]: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="Min" aria-label={`${button.label} minimum`} className={input} /><input value={filters[`${prefix}_max`] || ""} onChange={(e) => update({ [`${prefix}_max`]: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="Max" aria-label={`${button.label} maximum`} className={input} /></div>;
  }
  return <input value={text(filters[k])} onChange={(e) => update({ [k]: e.target.value })} placeholder={`Filter ${button.label.toLowerCase()}`} aria-label={button.label} className={input} />;
}

// Phones: every filter in one sheet, as a list (no sideways scrolling to discover them). Each row
// shows its current value; tap it to open its choices right there. Active filters also show as
// chips under the search box, each with an × to remove it.
const TOGGLES = ["hot", "hide_repeats"];
const toggleValue = (kind) => (kind === "hot" ? "yes" : "true");

function MobileFilters({ buttons, update, onClearAll, contents }) {
  const [open, setOpen] = useState(false);
  const [openKind, setOpenKind] = useState(null);
  const active = buttons.filter((b) => b.active);
  useEffect(() => {
    if (!open) return undefined;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  // The row already shows the filter's name, so only its value here ("Jayanagar", not "Branch: Jayanagar")
  const valueText = (b) => {
    if (!b.active) return "Any";
    const label = b.activeLabel || "On";
    return `${label.startsWith(`${b.label}: `) ? label.slice(b.label.length + 2) : label}${b.count || ""}`;
  };

  const sheet = open && (
    <div className="fixed inset-0 z-[900] sm:hidden" role="dialog" aria-modal="true" aria-label="Filters">
      <button type="button" aria-label="Close filters" onClick={() => setOpen(false)} className="absolute inset-0 bg-gray-900/30" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-3xl bg-white shadow-2xl">
        <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-gray-200" />
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 pb-3 pt-4">
          <p className="text-base font-semibold text-gray-900">
            Filters{active.length > 0 && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">{active.length} on</span>}
          </p>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto overscroll-contain px-4">
          {buttons.map((b) => {
            if (TOGGLES.includes(b.kind)) {
              return (
                <li key={b.kind}>
                  <button type="button" role="switch" aria-checked={b.active} onClick={() => update({ [b.keys[0]]: b.active ? "" : toggleValue(b.kind) })} className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-sm text-gray-800">
                    {b.label}
                    <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${b.active ? "bg-brand-600" : "bg-gray-200"}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${b.active ? "left-[1.125rem]" : "left-0.5"}`} />
                    </span>
                  </button>
                </li>
              );
            }
            const expanded = openKind === b.kind;
            return (
              <li key={b.kind}>
                <button type="button" aria-expanded={expanded} onClick={() => setOpenKind(expanded ? null : b.kind)} className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-sm">
                  <span className="font-medium text-gray-800">{b.label}</span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={`truncate ${b.active ? "font-medium text-brand-700" : "text-gray-400"}`}>{valueText(b)}</span>
                    <ChevronDown size={16} className={`shrink-0 text-gray-400 transition ${expanded ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {expanded && <div className="pb-4">{contents(b)}</div>}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-gray-100 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={onClearAll} disabled={!active.length} className="min-h-10 rounded-full px-4 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">Clear all</button>
          <button type="button" onClick={() => setOpen(false)} className="min-h-10 flex-1 rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-5 text-sm font-semibold text-white shadow-md shadow-brand-700/25">Show leads</button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium sm:hidden ${active.length ? "border-brand-300 bg-brand-50 text-brand-800" : "border-gray-200 bg-white text-gray-700"}`}
      >
        <SlidersHorizontal size={15} aria-hidden="true" />
        Filters
        {active.length > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1.5 text-[11px] font-semibold text-white">{active.length}</span>}
      </button>
      {typeof document !== "undefined" && sheet && createPortal(sheet, document.body)}
    </>
  );
}

// Phones: the active filters as chips (tap × to remove one)
function ActiveChips({ buttons, filters, update }) {
  const active = buttons.filter((b) => b.active);
  if (!active.length) return null;
  const clearOne = (b) => update(Object.fromEntries(b.keys.map((k) => [k, Array.isArray(filters[k]) ? [] : ""])));
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 sm:hidden">
      {active.map((b) => (
        <span key={b.kind} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1 text-xs font-medium text-brand-800 ring-1 ring-brand-100">
          <span className="truncate">{TOGGLES.includes(b.kind) ? b.label : `${b.activeLabel || b.label}${b.count || ""}`}</span>
          <button type="button" onClick={() => clearOne(b)} aria-label={`Remove ${b.label} filter`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-brand-100"><X size={12} /></button>
        </span>
      ))}
    </div>
  );
}

export default function LeadFilterBar({ source, filters, update, clear, apply, clearFilters, count, options, isAdmin, sorts, sortValue, placeholder, renderSearch }) {
  const [search, setSearch] = useState(filters.search ?? "");
  useEffect(() => setSearch(filters.search ?? ""), [filters.search]);
  useEffect(() => { const timer = setTimeout(() => { if (search.trim() !== (filters.search ?? "")) update({ search: search.trim() }); }, 250); return () => clearTimeout(timer); }, [search]);
  const buttons = buildFilterButtons(source, filters ?? {}, options ?? {}, isAdmin);
  const searchBox = renderSearch ? renderSearch({ value: search, onChange: setSearch }) : <SearchBox value={search} onChange={setSearch} placeholder={placeholder} />;
  const clearAll = () => { setSearch(""); clear?.(); };
  return <div className="w-full rounded-2xl bg-gray-50/80 p-3 ring-1 ring-gray-100">
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 basis-full sm:basis-0 sm:flex-1 sm:min-w-[15rem]">{searchBox}</div>
      <MobileFilters buttons={buttons} update={update} onClearAll={clearAll} contents={(button) => <FilterContents button={button} source={source} filters={filters} update={update} options={options ?? {}} isAdmin={isAdmin} />} />
      <PeriodFilter alignStart period={{ all: !filters.date_from && !filters.date_to, from: filters.date_from || filters.date_to, to: filters.date_to || filters.date_from }} today={todayIst()} onChange={(p) => update(p.all ? { date_from: "", date_to: "" } : { date_from: p.from, date_to: p.to })} />
      <FilterSelect label="Sort" value={sortValue} onChange={(v) => update({ sort: v })} options={sorts} />
    </div>
    <ActiveChips buttons={buttons} filters={filters ?? {}} update={update} />
    {/* From sm (tablets, laptops): every filter as a chip, wrapping onto more lines. Phones use the Filters sheet. */}
    <div className="mt-2 hidden flex-wrap gap-2 sm:flex">
      {buttons.map((button) => {
        const activeLabel = button.active ? `${button.activeLabel || button.label}${button.count || ""}` : button.label;
        if (["hot", "hide_repeats"].includes(button.kind)) return <button key={button.kind} type="button" aria-pressed={button.active} onClick={() => update({ [button.keys[0]]: button.active ? "" : button.kind === "hot" ? "yes" : "true" })} className={`h-10 shrink-0 whitespace-nowrap rounded-full border px-3 text-sm sm:h-9 ${button.active ? "border-brand-300 bg-brand-50 text-brand-800" : "border-gray-200 bg-white text-gray-700"}`}>{button.label}</button>;
        return <FilterDropdown key={button.kind} label={button.label} activeLabel={activeLabel} active={button.active}><FilterContents button={button} source={source} filters={filters} update={update} options={options ?? {}} isAdmin={isAdmin} /></FilterDropdown>;
      })}
    </div>
    {(count > 0 || filters.search) && <div className="mt-2 hidden justify-end sm:flex"><button type="button" onClick={clearAll} className="text-xs font-medium text-gray-500 hover:text-gray-900 hover:underline">Clear all</button></div>}
  </div>;
}
