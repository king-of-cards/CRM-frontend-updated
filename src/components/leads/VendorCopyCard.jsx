import { useState } from "react";
import { PENDING_UPDATE, saveLeadCrm, UPDATE_OPTIONS, updateInfo } from "../../api/leadCrm.js";
import { setSourceLeadHot } from "../../api/hotLeads.js";
import HotLeadStar from "./HotLeadStar.jsx";
import { toggleHotOptimistically } from "./hotLeadToggle.js";
import DateInput from "../shared/DateInput.jsx";
import { formatDateTime, formatDay, personName } from "../shared/dates.js";
import { copyChanges, copyForm, copyOf, copySaveOptions } from "./leadVendors.js";

// One vendor's copy of a lead's CRM details (docs section 19): Update, follow-up date, notes and
// the amounts, with its own Save. The save changes only this vendor's copy: admins send
// ?vendor=<id>; vendor logins never do (the API uses their own copy). Read-only without canEdit.
// The card's hot star is this vendor's too (POST / DELETE …/hot?vendor=<id>); onHotChanged(vendorId, isHot).

const fieldCls =
  "w-full min-h-11 rounded-xl border border-gray-200 bg-white/90 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 sm:min-h-0";
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function lastSaved(copy) {
  const name = personName(copy?.updated_by_name, "");
  if (!name) return null;
  return copy?.updated_at ? `${name} · ${formatDateTime(copy.updated_at)}` : name;
}

function ReadOnlyCopy({ copy }) {
  const rows = [
    ["Update", updateInfo(copy.update_status).label],
    ["Follow-up date", formatDay(copy.follow_up_date)],
    ["Quoted amount", copy.quoted_amount != null ? inr.format(copy.quoted_amount) : null],
    ["Conversion amount", copy.conversion_amount != null ? inr.format(copy.conversion_amount) : null],
    ["Notes", copy.notes],
  ].filter(([, v]) => v != null && String(v).trim() !== "");
  return (
    <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className={label === "Notes" ? "sm:col-span-2" : ""}>
          <dt className="text-xs text-gray-500">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-gray-900">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

// copy: one entry of crm.vendors. onSaved(crm): the whole crm answer after the save.
export default function VendorCopyCard({ copy, source, leadKey, context = {}, isAdmin = false, canEdit = false, onSaved, onHotChanged }) {
  const [current, setCurrent] = useState(copy);
  const [form, setForm] = useState(() => copyForm(copy));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [hot, setHot] = useState(Boolean(copy.is_hot));
  const [hotBusy, setHotBusy] = useState(false);
  const vendor = copy.vendor;

  function toggleHot() {
    if (hotBusy) return;
    setHotBusy(true);
    setError("");
    toggleHotOptimistically(
      hot,
      (next) => setSourceLeadHot(source, leadKey, next, copySaveOptions(isAdmin, vendor.id)),
      (next) => {
        setHot(next);
        onHotChanged?.(vendor.id, next);
      },
    )
      .catch((err) => setError(err.message || "Couldn't change the hot star"))
      .finally(() => setHotBusy(false));
  }
  const id = `vendor-copy-${vendor.id}`;
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  async function save(e) {
    e.preventDefault();
    const changes = copyChanges(current, form);
    if (!Object.keys(changes).length) {
      setError("Nothing to save: no changes.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const next = await saveLeadCrm(source, leadKey, changes, context, copySaveOptions(isAdmin, vendor.id));
      const mine = copyOf(next, vendor.id) ?? { ...current, ...changes };
      setCurrent(mine);
      setForm(copyForm(mine));
      setSaved(true);
      onSaved?.(next);
    } catch (err) {
      setError(err.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 rounded-2xl bg-white/80 p-4 ring-1 ring-gray-100 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={`${id}-title`} className="min-w-0 break-words text-sm font-semibold text-gray-900">{vendor.name}</h4>
        <span className="flex items-center gap-1">
        <HotLeadStar isHot={hot} pending={hotBusy} onToggle={canEdit && isAdmin ? toggleHot : null} name={vendor.name} touch />
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${updateInfo(current.update_status).style}`}>
          {updateInfo(current.update_status).label}
        </span>
        </span>
      </div>
      {!canEdit ? (
        <ReadOnlyCopy copy={current} />
      ) : (
        <form onSubmit={save} className="mt-3 space-y-3" aria-label={`${vendor.name}: lead status`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-xs font-medium text-gray-600">Update</span>
              <select value={form.update_status} onChange={(e) => set("update_status", e.target.value)} className={`mt-1.5 ${fieldCls}`}>
                <option value="">{PENDING_UPDATE.label}</option>
                {UPDATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="text-xs font-medium text-gray-600">Follow-up date</span>
              <DateInput type="date" value={form.follow_up_date} onChange={(e) => set("follow_up_date", e.target.value)} className={`mt-1.5 ${fieldCls}`} />
            </label>
            <label className="block min-w-0">
              <span className="text-xs font-medium text-gray-600">Quoted amount (₹)</span>
              <input inputMode="numeric" value={form.quoted_amount} onChange={(e) => set("quoted_amount", e.target.value.replace(/[^\d,]/g, ""))} placeholder="e.g. 45000" className={`mt-1.5 ${fieldCls}`} />
            </label>
            <label className="block min-w-0">
              <span className="text-xs font-medium text-gray-600">Conversion amount (₹)</span>
              <input inputMode="numeric" value={form.conversion_amount} onChange={(e) => set("conversion_amount", e.target.value.replace(/[^\d,]/g, ""))} placeholder="e.g. 40000" className={`mt-1.5 ${fieldCls}`} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Notes</span>
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Calls, follow-ups, anything useful…" className={`mt-1.5 resize-y ${fieldCls}`} />
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
            <button
              type="submit"
              disabled={saving}
              aria-label={`Save ${vendor.name}`}
              className="min-h-11 rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-brand-700/25 transition disabled:opacity-60 sm:min-h-0"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
      {!canEdit && error && <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      {lastSaved(current) && <p className="mt-2 text-right text-xs text-gray-500">Last updated by {lastSaved(current)}</p>}
    </section>
  );
}
