import { useState } from "react";
import { addDhruvaLead } from "../../api/dhruva.js";
import Drawer, { Alert, primaryBtn, secondaryBtn } from "../crmLeads/Drawer.jsx";
import { dhruvaErrors, dhruvaFormErrors, dhruvaFormOf, dhruvaNewLead, KOC_FIELDS, LEAD_FIELDS } from "../../pages/dhruvaUtils.js";
import { duplicateMessage } from "../shared/duplicates.js";
import { DhruvaFieldInput } from "./DhruvaFields.jsx";

// Add one Dhruva → KOC lead (POST /dhruva/leads): Dhruva logins the lead fields; admins also the
// KOC fields. sent_at is set by the CRM.
export default function DhruvaAddLeadDialog({ onClose, onAdded, isAdmin = false, whatsappStatuses = [] }) {
  const [form, setForm] = useState(() => dhruvaFormOf(null));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);
  const fields = isAdmin ? [...LEAD_FIELDS, ...KOC_FIELDS] : LEAD_FIELDS;

  async function submit(e, allowDuplicate = false) {
    e?.preventDefault();
    const local = dhruvaFormErrors(form, { koc: isAdmin });
    if (Object.keys(local).length) {
      setErrors(local);
      setMessage("Fix the highlighted fields.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const values = dhruvaNewLead(form, { koc: isAdmin });
      if (allowDuplicate) values.allow_duplicate = true;
      await addDhruvaLead(values);
      onAdded("Lead added.");
    } catch (err) {
      const parsed = dhruvaErrors(err);
      setErrors(parsed.fields);
      const isDuplicate = err.status === 409 && Boolean(parsed.duplicate) && !allowDuplicate;
      // A duplicate's message shows in its own box (with Save anyway), not twice
      setMessage(isDuplicate ? "" : parsed.message || Object.values(parsed.fields).join(" ") || err.message);
      setDuplicate(isDuplicate ? duplicateMessage(err.detail) : false);
    } finally {
      setSaving(false);
    }
  }

  return <Drawer kicker="Dhruva leads" title="Add lead" wide={isAdmin} onClose={onClose} footer={<><button type="button" onClick={onClose} className={secondaryBtn}>Cancel</button><button type="submit" form="dhruva-add-lead" disabled={saving} className={primaryBtn}>{saving ? "Adding…" : "Add lead"}</button></>}>
    <form id="dhruva-add-lead" onSubmit={submit} className="space-y-4" noValidate>
      {message && <Alert>{message}</Alert>}
      {duplicate && <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200"><p className="text-sm font-semibold text-amber-900">{duplicate}</p><p className="mt-1 text-sm text-amber-900">Add this lead anyway?</p><button type="button" disabled={saving} onClick={() => submit(undefined, true)} className={`${primaryBtn} mt-3`}>Save anyway</button></div>}
      <p className="text-xs text-gray-500">Name is required. Add one or more phone numbers (10 digits, +91 optional); the first is the main number, and a lead without a phone can still be added. Add one or more event dates.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <DhruvaFieldInput
            key={f.key}
            field={f}
            value={form[f.key]}
            onChange={(v) => { setForm((old) => ({ ...old, [f.key]: v })); setErrors((old) => ({ ...old, [f.key]: undefined })); setDuplicate(false); }}
            error={errors[f.key]}
            suggestions={f.key === "whatsapp_status" ? whatsappStatuses : []}
          />
        ))}
      </div>
    </form>
  </Drawer>;
}
