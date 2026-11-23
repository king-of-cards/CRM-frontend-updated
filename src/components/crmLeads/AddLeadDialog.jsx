import { useEffect, useState } from "react";
import { addCrmLead, getCrmLead, getCrmLeadFields } from "../../api/crmLeads.js";
import Drawer, { Alert, primaryBtn, secondaryBtn, Spinner } from "./Drawer.jsx";
import LeadFieldInput from "./LeadFieldInput.jsx";
import {
  duplicateWhere,
  errorsByField,
  errorText,
  formToValues,
  otherSources,
  SOURCE_NAMES,
  sourceList,
} from "./crmLeadUtils.js";
import { duplicateMessage } from "../shared/duplicates.js";

// Add one lead. On a duplicate phone (409) the existing lead is shown with "Add anyway".
export default function AddLeadDialog({ source, onClose, onAdded, onOpenLead }) {
  const [meta, setMeta] = useState(null); // GET fields answer
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState(null); // 409 detail
  const [existing, setExisting] = useState(null); // the existing lead, when it's a CRM one

  useEffect(() => {
    let cancelled = false;
    getCrmLeadFields(source)
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
        setForm(Object.fromEntries(m.fields.map((f) => [f.key, ""])));
      })
      .catch((err) => !cancelled && setLoadError(errorText(err)));
    return () => {
      cancelled = true;
    };
  }, [source]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setDuplicate(null);
    setExisting(null);
  };

  async function save(allowDuplicate) {
    const fields = meta.fields;
    const missing = fields.filter((f) => f.required && !String(form[f.key] ?? "").trim());
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((f) => [f.key, `${f.label} is required`])));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await addCrmLead(source, formToValues(fields, form), allowDuplicate);
      const also = otherSources(res.warnings);
      onAdded(also.length ? `Lead added. This phone is also in ${sourceList(also)}.` : "Lead added.");
    } catch (err) {
      if (err.status === 409 && err.detail?.duplicate) {
        setDuplicate(err.detail);
        if (err.detail.duplicate.reason === "existing_added") {
          getCrmLead(source, err.detail.duplicate.lead_key)
            .then(setExisting)
            .catch(() => {});
        }
      } else {
        setErrors(errorsByField(err));
        setError(errorText(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const branches = meta?.branches ?? [];
  const labelOf = (key) => meta?.fields.find((f) => f.key === key)?.label ?? key;
  const shown = (key, v) => {
    if (key === "branch") return branches.find((b) => b.id === v)?.name ?? v;
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return v;
  };

  return (
    <Drawer
      kicker={SOURCE_NAMES[source]}
      title="Add lead"
      onClose={onClose}
      footer={
        meta && (
          <>
            <button type="button" onClick={onClose} className={secondaryBtn}>
              Cancel
            </button>
            {duplicate ? (
              <button type="button" disabled={saving} onClick={() => save(true)} className={primaryBtn}>
                {saving ? "Adding…" : "Add anyway"}
              </button>
            ) : (
              <button type="submit" form="crm-add-lead" disabled={saving} className={primaryBtn}>
                {saving ? "Adding…" : "Add lead"}
              </button>
            )}
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

      {meta && (
        <form
          id="crm-add-lead"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
          className="space-y-4"
        >
          {error && <Alert>{error}</Alert>}

          {duplicate && (
            <Alert kind="warning">
              <p className="font-semibold">{duplicateMessage(duplicate)}</p>
              <p className="mt-1">
                {duplicateWhere(duplicate.duplicate)}
                {duplicate.duplicate.lead_key && (
                  <span className="text-amber-700/80"> · key {duplicate.duplicate.lead_key}</span>
                )}
              </p>
              {otherSources(duplicate.warnings).length > 0 && (
                <p className="mt-1">Also in {sourceList(otherSources(duplicate.warnings))}.</p>
              )}
              {existing && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  {Object.entries(existing.values)
                    .filter(([, v]) => v !== null && v !== "")
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-amber-700/80">{labelOf(k)}</dt>
                        <dd className="text-amber-900">{String(shown(k, v))}</dd>
                      </div>
                    ))}
                </dl>
              )}
              {existing && onOpenLead && (
                <button
                  type="button"
                  onClick={() => onOpenLead(existing.lead_key)}
                  className="mt-2 text-xs font-semibold text-amber-900 underline"
                >
                  {existing.archived ? "Open it (archived; you can unarchive it)" : "Open that lead"}
                </button>
              )}
              <p className="mt-2 text-xs">Change the phone, or click “Add anyway” to save a second lead.</p>
            </Alert>
          )}

          {meta.fields.map((f) => (
            <LeadFieldInput
              key={f.key}
              field={f}
              value={form[f.key] ?? ""}
              onChange={(v) => set(f.key, v)}
              error={errors[f.key]}
              branches={branches}
            />
          ))}
        </form>
      )}
    </Drawer>
  );
}
