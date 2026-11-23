import { useEffect, useState } from "react";
import { editCrmLead, getCrmLead, getCrmLeadFields, unarchiveCrmLead } from "../../api/crmLeads.js";
import Drawer, { Alert, primaryBtn, secondaryBtn, Spinner } from "./Drawer.jsx";
import LeadFieldInput from "./LeadFieldInput.jsx";
import { duplicateWhere, errorsByField, errorText, formToValues, SOURCE_NAMES, valuesToForm } from "./crmLeadUtils.js";
import { duplicateMessage } from "../shared/duplicates.js";

// Edit a lead added or imported in the CRM. Only changed fields are sent.
// An archived lead shows a banner with "Unarchive".
export default function EditLeadDialog({ source, leadKey, onClose, onChanged }) {
  const [meta, setMeta] = useState(null);
  const [lead, setLead] = useState(null);
  const [original, setOriginal] = useState({});
  const [form, setForm] = useState({});
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCrmLeadFields(source), getCrmLead(source, leadKey)])
      .then(([all, l]) => {
        if (cancelled) return;
        // "Assigned to" isn't edited here (PATCH ignores it; it's the "Assigned to" cell)
        const m = { ...all, fields: all.fields.filter((x) => x.type !== "assigned") };
        const f = valuesToForm(m.fields, l.values);
        setMeta(m);
        setLead(l);
        setOriginal(f);
        setForm(f);
      })
      .catch((err) => !cancelled && setLoadError(errorText(err)));
    return () => {
      cancelled = true;
    };
  }, [source, leadKey]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function save(e) {
    e.preventDefault();
    const values = formToValues(meta.fields, form, { onlyChanged: original });
    if (!Object.keys(values).length) return setError("Nothing to change.");
    if ("phone" in values && !values.phone) return setErrors({ phone: "Phone is required" });
    setSaving(true);
    setError("");
    try {
      await editCrmLead(source, leadKey, values);
      onChanged("Lead saved.");
    } catch (err) {
      if (err.status === 409 && err.detail?.duplicate) {
        setErrors({ phone: duplicateMessage(err.detail) });
        const where = duplicateWhere(err.detail.duplicate);
        setError(where ? `Existing lead: ${where}.` : "");
      } else {
        setErrors(errorsByField(err));
        setError(errorText(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function unarchive() {
    setSaving(true);
    setError("");
    try {
      const res = await unarchiveCrmLead(source, leadKey);
      setLead(res.lead);
      onChanged("Lead unarchived.", { keepOpen: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      kicker={SOURCE_NAMES[source]}
      title="Edit lead"
      onClose={onClose}
      footer={
        meta && (
          <>
            <button type="button" onClick={onClose} className={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" form="crm-edit-lead" disabled={saving} className={primaryBtn}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        )
      }
    >
      {!meta && !loadError && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {loadError && <Alert>{loadError}</Alert>}

      {meta && lead && (
        <form id="crm-edit-lead" noValidate onSubmit={save} className="space-y-4">
          <p className="text-xs text-gray-500">
            {lead.origin === "imported" ? "Imported" : "Added"} in the CRM · key {lead.lead_key}
          </p>
          {lead.archived && (
            <Alert kind="warning">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>This lead is archived: it's hidden from lists, counts and exports.</span>
                <button
                  type="button"
                  onClick={unarchive}
                  disabled={saving}
                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-60"
                >
                  Unarchive
                </button>
              </div>
            </Alert>
          )}
          {error && <Alert>{error}</Alert>}
          {meta.fields.map((f) => (
            <LeadFieldInput
              key={f.key}
              field={f}
              value={form[f.key] ?? ""}
              onChange={(v) => set(f.key, v)}
              error={errors[f.key]}
              branches={meta.branches ?? []}
            />
          ))}
        </form>
      )}
    </Drawer>
  );
}
