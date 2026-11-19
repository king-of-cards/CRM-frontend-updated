import { useState } from "react";
import { addDhruvaLead } from "../../api/dhruva.js";
import Drawer, { Alert, fieldCls, primaryBtn, secondaryBtn } from "../crmLeads/Drawer.jsx";
import { dhruvaErrors } from "../../pages/dhruvaUtils.js";
import DateInput from "../shared/DateInput.jsx";

const FIELDS = [
  ["name", "Name", "text"], ["venue", "Venue", "text"], ["date", "Event date", "text"],
  ["phone", "Phone", "tel"], ["alt_phone", "Alt phone", "tel"], ["event_type", "Event type", "text"],
];

export default function DhruvaAddLeadDialog({ onClose, onAdded }) {
  const [form, setForm] = useState(Object.fromEntries(FIELDS.map(([key]) => [key, ""])));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e, allowDuplicate = false) {
    e?.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const values = Object.fromEntries(FIELDS.map(([key]) => [key, form[key].trim() || null]));
      if (allowDuplicate) values.allow_duplicate = true;
      await addDhruvaLead(values);
      onAdded("Lead added.");
    } catch (err) {
      const parsed = dhruvaErrors(err);
      setErrors(parsed.fields);
      setMessage(parsed.message || Object.values(parsed.fields).join(" ") || err.message);
      setDuplicate(err.status === 409 && Boolean(parsed.duplicate) && !allowDuplicate);
    } finally {
      setSaving(false);
    }
  }

  return <Drawer kicker="Dhruva leads" title="Add lead" onClose={onClose} footer={<><button type="button" onClick={onClose} className={secondaryBtn}>Cancel</button><button type="submit" form="dhruva-add-lead" disabled={saving} className={primaryBtn}>{saving ? "Adding…" : "Add lead"}</button></>}>
    <form id="dhruva-add-lead" onSubmit={submit} className="space-y-4">
      {message && <Alert>{message}</Alert>}
      {duplicate && <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200"><p className="text-sm text-amber-900">A matching lead exists. Add this lead anyway?</p><button type="button" disabled={saving} onClick={() => submit(undefined, true)} className={`${primaryBtn} mt-3`}>Save anyway</button></div>}
      <p className="text-xs text-gray-500">Enter a name or phone. Leads without a phone can still be added.</p>
      {FIELDS.map(([key, label, type]) => {
        const FieldInput = key === "date" ? DateInput : "input";
        return <label key={key} className="block"><span className="text-xs font-medium text-gray-600">{label}</span><FieldInput picker={key === "date"} type={type} value={form[key]} maxLength={key === "venue" ? 300 : 200} onChange={(e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setErrors((old) => ({ ...old, [key]: undefined })); setDuplicate(false); }} className={`${fieldCls} mt-1.5 ${errors[key] ? "border-red-300" : ""}`} aria-invalid={Boolean(errors[key])} />{errors[key] && <span className="mt-1 block text-xs text-red-600">{errors[key]}</span>}</label>;
      })}
    </form>
  </Drawer>;
}
