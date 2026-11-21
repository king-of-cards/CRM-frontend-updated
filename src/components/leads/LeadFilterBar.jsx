import { useEffect, useState } from "react";
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
  if (k === "event") return <div className="space-y-2"><button type="button" onClick={() => update({ upcoming_days: filters.upcoming_days ? "" : "30", event_from: "", event_to: "" })} className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-50">{filters.upcoming_days ? "Any event date" : "Upcoming 30 days"}</button><RangeDates fromKey="event_from" toKey="event_to" filters={filters} update={(u) => update({ ...u, upcoming_days: "" })} /></div>;
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

export default function LeadFilterBar({ source, filters, update, clear, apply, clearFilters, count, options, isAdmin, sorts, sortValue, placeholder, renderSearch }) {
  const [search, setSearch] = useState(filters.search ?? "");
  useEffect(() => setSearch(filters.search ?? ""), [filters.search]);
  useEffect(() => { const timer = setTimeout(() => { if (search.trim() !== (filters.search ?? "")) update({ search: search.trim() }); }, 250); return () => clearTimeout(timer); }, [search]);
  const buttons = buildFilterButtons(source, filters ?? {}, options ?? {}, isAdmin);
  const searchBox = renderSearch ? renderSearch({ value: search, onChange: setSearch }) : <SearchBox value={search} onChange={setSearch} placeholder={placeholder} />;
  const clearAll = () => { setSearch(""); clear?.(); };
  return <div className="w-full rounded-2xl bg-gray-50/80 p-3 ring-1 ring-gray-100">
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-[15rem] flex-1">{searchBox}</div>
      <PeriodFilter alignStart period={{ all: !filters.date_from && !filters.date_to, from: filters.date_from || filters.date_to, to: filters.date_to || filters.date_from }} today={todayIst()} onChange={(p) => update(p.all ? { date_from: "", date_to: "" } : { date_from: p.from, date_to: p.to })} />
      <FilterSelect label="Sort" value={sortValue} onChange={(v) => update({ sort: v })} options={sorts} />
    </div>
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
      {buttons.map((button) => {
        const activeLabel = button.active ? `${button.activeLabel || button.label}${button.count || ""}` : button.label;
        if (["hot", "hide_repeats"].includes(button.kind)) return <button key={button.kind} type="button" aria-pressed={button.active} onClick={() => update({ [button.keys[0]]: button.active ? "" : button.kind === "hot" ? "yes" : "true" })} className={`h-9 whitespace-nowrap rounded-full border px-3 text-sm ${button.active ? "border-brand-300 bg-brand-50 text-brand-800" : "border-gray-200 bg-white text-gray-700"}`}>{button.label}</button>;
        return <FilterDropdown key={button.kind} label={button.label} activeLabel={activeLabel} active={button.active}><FilterContents button={button} source={source} filters={filters} update={update} options={options ?? {}} isAdmin={isAdmin} /></FilterDropdown>;
      })}
    </div>
    {(count > 0 || filters.search) && <div className="mt-2 flex justify-end"><button type="button" onClick={clearAll} className="text-xs font-medium text-gray-500 hover:text-gray-900 hover:underline">Clear all</button></div>}
  </div>;
}
