import { useState } from "react";
import { addKocLead } from "../../api/vendorToKoc.js";
import Drawer, { Alert, fieldCls, primaryBtn, secondaryBtn } from "../crmLeads/Drawer.jsx";
import { kocErrors } from "./kocUtils.js";

// Add one Vendors → KOC lead: Name, Date, Phone (required), City; admins also pick the Vendor.
// Errors are shown exactly as the API returns them (409 duplicate, 422 per field).
const FIELDS = [
  { key: "name", label: "Name", type: "text", max: 100 },
  { key: "date", label: "Date", type: "date" },
  { key: "phone", label: "Phone", type: "tel", required: true, help: "10-digit Indian mobile number" },
  { key: "city", label: "City", type: "text", max: 100 },
];

export default function KocAddLeadDialog({ isAdmin, vendors, onClose, onAdded }) {
  const [form, setForm] = useState({ name: "", date: "", phone: "", city: "", vendor_id: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function save(e) {
    e.preventDefault();
    const missing = {};
    if (!form.phone.trim()) missing.phone = "Phone is required";
    if (isAdmin && !form.vendor_id) missing.vendor_id = "Pick a vendor";
    if (Object.keys(missing).length) return setErrors(missing);
    setSaving(true);
    setMessage("");
    try {
      await addKocLead({
        name: form.name.trim() || null,
        date: form.date || null, // YYYY-MM-DD from the date input
        phone: form.phone.trim(),
        city: form.city.trim() || null,
        ...(isAdmin ? { vendor_id: Number(form.vendor_id) } : {}),
      });
      onAdded("Lead added.");
    } catch (err) {
      const { fields, message: text } = kocErrors(err);
      setErrors(fields);
      setMessage(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      kicker="Vendors → KOC"
      title="Add lead"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
          <button type="submit" form="koc-add-lead" disabled={saving} className={primaryBtn}>
            {saving ? "Adding…" : "Add lead"}
          </button>
        </>
      }
    >
      <form id="koc-add-lead" noValidate onSubmit={save} className="space-y-4">
        {message && <Alert>{message}</Alert>}
        {isAdmin && (
          <div>
            <label htmlFor="koc-vendor" className="text-xs font-medium text-gray-600">
              Vendor<span className="ml-0.5 text-red-600">*</span>
            </label>
            <select
              id="koc-vendor"
              value={form.vendor_id}
              onChange={(e) => set("vendor_id", e.target.value)}
              className={`mt-1.5 ${fieldCls}`}
            >
              <option value="">Pick a vendor</option>
              {vendors.filter((v) => v.is_active !== false).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            {errors.vendor_id && <p className="mt-1 text-[11px] text-red-600">{errors.vendor_id}</p>}
          </div>
        )}
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`koc-${f.key}`} className="text-xs font-medium text-gray-600">
              {f.label}
              {f.required && <span className="ml-0.5 text-red-600">*</span>}
            </label>
            <input
              id={`koc-${f.key}`}
              type={f.type}
              value={form[f.key]}
              maxLength={f.max}
              onChange={(e) => set(f.key, e.target.value)}
              aria-invalid={Boolean(errors[f.key])}
              className={`mt-1.5 ${fieldCls} ${errors[f.key] ? "border-red-300" : ""}`}
            />
            {errors[f.key] ? (
              <p className="mt-1 text-[11px] text-red-600">{errors[f.key]}</p>
            ) : (
              f.help && <p className="mt-1 text-[11px] text-gray-500">{f.help}</p>
            )}
          </div>
        ))}
      </form>
    </Drawer>
  );
}
