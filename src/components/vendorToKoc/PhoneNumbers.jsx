import { useState } from "react";
import ContactActions from "../shared/ContactActions.jsx";
import { Plus, X } from "lucide-react";
import { fieldCls } from "../crmLeads/Drawer.jsx";
import { cleanPhones, phoneRowErrors, splitPhones } from "../../pages/dhruvaUtils.js";

// Dhruva → KOC phone numbers (docs section 13): shown short (Indian numbers as 10 digits),
// each with the shared Call, WhatsApp and Copy buttons; edited as rows (the first is the main one).

// entries: [{text, e164}] (phoneEntriesOf). limit: show that many and a "+N more" toggle; 0 = all.
export function PhoneList({ entries, limit = 0, label = "Phone numbers", defaultExpanded = false, name }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  if (!entries?.length) return <span className="text-gray-400">—</span>;
  const { shown, hidden } = limit ? splitPhones(entries, limit, expanded) : { shown: entries, hidden: 0 };
  const canCollapse = limit > 0 && expanded && entries.length > limit;
  return (
    <div className="space-y-0.5">
      <ul aria-label={label} className="space-y-0.5">
        {shown.map((p) => (
          <li key={p.e164} className="flex items-center gap-1 whitespace-nowrap">
            <span className="tabular-nums text-gray-800">{p.text}</span>
            <ContactActions phone={p.e164} name={name} showNumber={false} />
          </li>
        ))}
      </ul>
      {(hidden > 0 || canCollapse) && (
        <button type="button" aria-expanded={expanded} onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }} className="min-h-11 text-xs font-medium text-brand-700 hover:underline sm:min-h-0">
          {expanded ? "Show less" : `+${hidden} more`}
        </button>
      )}
    </div>
  );
}

// Number rows: type or paste a number per row (+91 is dropped), add and remove rows; the first is
// the main number. showErrors: mark each bad row (after a save attempt, or always in the upload).
export function PhoneRows({ value, onChange, label = "Phone numbers", showErrors = false, compact = false }) {
  const rows = Array.isArray(value) ? value : cleanPhones(value); // the upload preview sends "a, b"
  const list = rows.length ? rows : [""];
  const errors = phoneRowErrors(list);
  const set = (i, text) => onChange(list.map((p, j) => (j === i ? text.replace(/[^\d+\s()-]/g, "") : p)));
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  const input = compact ? "w-full rounded-lg border px-2 py-1" : fieldCls;
  return (
    <div role="group" aria-label={label} className="space-y-1.5">
      {list.map((p, i) => {
        const bad = showErrors && Boolean(errors[i]);
        const name = i === 0 ? "main number" : `number ${i + 1}`;
        return (
          <div key={i}>
            <div className="flex items-center gap-1.5">
              <input
                type="tel" inputMode="tel" placeholder="10 digits" value={p} aria-label={`${label}: ${name}`} aria-invalid={bad}
                onChange={(e) => set(i, e.target.value)}
                className={`${input} ${bad ? "border-red-300" : "border-gray-200"}`}
              />
              {i === 0 && list.length > 1 && <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">Main</span>}
              {(list.length > 1 || p) && (
                <button type="button" onClick={() => remove(i)} aria-label={`Remove ${name}`} className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                  <X size={14} />
                </button>
              )}
            </div>
            {bad && <span className="mt-0.5 block text-xs text-red-600">{errors[i]}</span>}
          </div>
        );
      })}
      <button type="button" onClick={() => onChange([...list, ""])} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
        <Plus size={12} />Add number
      </button>
    </div>
  );
}
