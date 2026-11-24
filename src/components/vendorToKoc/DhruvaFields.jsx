import { useState } from "react";
import { Plus, X } from "lucide-react";
import DateInput from "../shared/DateInput.jsx";
import { fieldCls } from "../crmLeads/Drawer.jsx";
import { UPDATE_OPTIONS } from "../../api/leadCrm.js";
import { cleanDates, cleanPhones, dayText, eventDatesOf, eventDatesText, PENDING, phoneDigits, phonesOf, phonesText, phoneText, rupeesText, statusLabel } from "../../pages/dhruvaUtils.js";

// Dhruva → KOC field inputs and read-only values (docs section 13), for the add form and the panel.

// Event dates: a list of YYYY-MM-DD; add one with the date input, remove one with ×
export function EventDatesInput({ value = [], onChange, label = "Event dates", invalid = false }) {
  const [next, setNext] = useState("");
  const dates = cleanDates(value);
  const add = (d) => {
    if (!d) return;
    onChange(cleanDates([...dates, d]));
    setNext("");
  };
  return (
    <div className="space-y-2">
      {dates.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={label}>
          {dates.map((d) => (
            <li key={d} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-xs font-medium text-brand-800 ring-1 ring-brand-100">
              {dayText(d)}
              <button type="button" onClick={() => onChange(dates.filter((x) => x !== d))} aria-label={`Remove ${dayText(d)}`} className="rounded-full p-0.5 hover:bg-brand-100">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">No event date yet.</p>
      )}
      <div className="flex gap-2">
        <DateInput type="date" aria-label={`Add ${label.toLowerCase()}`} value={next} onChange={(e) => setNext(e.target.value)} className={`${fieldCls} ${invalid ? "border-red-300" : ""}`} />
        <button type="button" onClick={() => add(next)} disabled={!next} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:opacity-50">
          <Plus size={14} />Add date
        </button>
      </div>
    </div>
  );
}

// Phone numbers: a list, 10 digits each; add one with the input (Enter or Add), remove one with ×
export function PhonesInput({ value = [], onChange, label = "Phone numbers", invalid = false }) {
  const [next, setNext] = useState("");
  const phones = cleanPhones(value);
  const ready = /^\d{10}$/.test(next);
  const add = () => {
    if (!ready) return;
    onChange(cleanPhones([...phones, next]));
    setNext("");
  };
  return (
    <div className="space-y-2">
      {phones.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={label}>
          {phones.map((p) => (
            <li key={p} className={`inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-xs font-medium ring-1 ${/^\d{10}$/.test(p) ? "bg-brand-50 text-brand-800 ring-brand-100" : "bg-red-50 text-red-700 ring-red-200"}`}>
              {phoneText(p)}
              <button type="button" onClick={() => onChange(phones.filter((x) => x !== p))} aria-label={`Remove ${p}`} className="rounded-full p-0.5 hover:bg-brand-100">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">No phone number yet.</p>
      )}
      <div className="flex gap-2">
        <input
          type="tel" inputMode="numeric" maxLength={10} pattern="\d{10}" placeholder="10 digits" aria-label="Add a phone number"
          value={next} onChange={(e) => setNext(phoneDigits(e.target.value))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className={`${fieldCls} ${invalid ? "border-red-300" : ""}`}
        />
        <button type="button" onClick={add} disabled={!ready} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:opacity-50">
          <Plus size={14} />Add number
        </button>
      </div>
    </div>
  );
}

// One editable field. suggestions: values offered for a text field (e.g. WhatsApp statuses).
export function DhruvaFieldInput({ field, value, onChange, error, suggestions = [] }) {
  const cls = `${fieldCls} ${error ? "border-red-300" : ""}`;
  const listId = suggestions.length ? `dhruva-${field.key}-options` : undefined;
  let input;
  if (field.type === "dates") input = <EventDatesInput value={value} onChange={onChange} label={field.label} invalid={Boolean(error)} />;
  else if (field.type === "phones") input = <PhonesInput value={value} onChange={onChange} label={field.label} invalid={Boolean(error)} />;
  else if (field.type === "phone")
    input = <input type="tel" inputMode="numeric" maxLength={10} pattern="\d{10}" placeholder="10 digits" value={value} onChange={(e) => onChange(phoneDigits(e.target.value))} className={cls} aria-invalid={Boolean(error)} />;
  else if (field.type === "textarea") input = <textarea rows={3} maxLength={field.max} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />;
  else if (field.type === "yesno")
    input = (
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        Yes
      </label>
    );
  else if (field.type === "update")
    input = (
      <select value={value || PENDING} onChange={(e) => onChange(e.target.value)} className={cls}>
        <option value={PENDING}>Pending</option>
        {UPDATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  else if (field.type === "date") input = <DateInput type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />;
  else if (field.type === "amount") input = <input inputMode="numeric" placeholder="e.g. 150000" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />;
  else
    input = (
      <>
        <input type="text" maxLength={field.max} list={listId} value={value} onChange={(e) => onChange(e.target.value)} className={cls} aria-invalid={Boolean(error)} />
        {listId && <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
      </>
    );
  return (
    <div className={["textarea", "dates", "phones"].includes(field.type) ? "sm:col-span-2" : ""}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{field.label}{field.required ? " *" : ""}</span>
      {input}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  );
}

// A field's value as text, for read-only views
export function dhruvaValueText(field, lead) {
  const v = lead?.[field.key];
  if (field.type === "dates") return eventDatesText(eventDatesOf(lead));
  if (field.type === "phones") return phonesText(phonesOf(lead));
  if (field.type === "phone") return v ? phoneText(v) : "—";
  if (field.type === "yesno") return v === true ? "Yes" : "No";
  if (field.type === "update") return statusLabel(v);
  if (field.type === "amount") return rupeesText(v);
  if (field.type === "date") return dayText(v);
  return v == null || v === "" ? "—" : String(v);
}

export function DhruvaFieldList({ fields, lead, label }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2" aria-label={label}>
      {fields.map((f) => (
        <div key={f.key} className={["textarea", "dates", "phones"].includes(f.type) ? "sm:col-span-2" : ""}>
          <dt className="text-xs font-medium text-gray-500">{f.label}</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-900">{dhruvaValueText(f, lead)}</dd>
        </div>
      ))}
    </dl>
  );
}
