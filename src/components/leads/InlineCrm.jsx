import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { PENDING_UPDATE, UPDATE_OPTIONS, updateInfo } from "../../api/leadCrm.js";
import { listVendors } from "../../api/vendors.js";
import { useAuth } from "../../auth/useAuth.js";
import { assignedText } from "./crmAccess.js";

// The editable CRM cells in every lead table: Assigned to, Update, Quoted amount, Conversion amount.
// Each change is saved at once (only that field) and the row updates in place.
// Who edits what: Assigned to = admins only (vendor logins don't get this column); Update and the
// amounts = admins and the assigned vendor. Save errors (403/404/422…) are shown under the cell.

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// Vendors for the dropdowns: loaded once and shared by every row
let vendorsPromise = null;
export function useVendors() {
  const [vendors, setVendors] = useState(() => listVendors.peek() ?? []);
  useEffect(() => {
    if (!vendorsPromise) {
      vendorsPromise = listVendors().catch(() => {
        vendorsPromise = null; // try again next time
        return [];
      });
    }
    let alive = true;
    vendorsPromise.then((v) => alive && v && setVendors(v));
    return () => {
      alive = false;
    };
  }, []);
  return vendors;
}

const stop = (e) => e.stopPropagation();

// Pill-shaped <select>
function PillSelect({ value, onChange, className, children, label, busy }) {
  return (
    <span className="relative inline-flex items-center" onClick={stop}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        className={`cursor-pointer appearance-none rounded-full py-1 pl-3 pr-7 text-xs font-medium outline-none ring-1 transition focus:ring-2 focus:ring-brand-600/40 disabled:opacity-60 ${className}`}
      >
        {children}
      </select>
      {busy ? (
        <Loader2
          size={12}
          className="pointer-events-none absolute right-2 animate-spin text-gray-400"
        />
      ) : (
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-2 text-current opacity-60"
        />
      )}
    </span>
  );
}

// A save error, shown under the cell (not only as a tooltip)
function SaveError({ error }) {
  if (!error) return null;
  return (
    <span role="alert" className="mt-1 block max-w-[200px] whitespace-normal text-[11px] leading-tight text-red-600">
      {error}
    </span>
  );
}

function useSaver(save) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (changes) => {
    setBusy(true);
    setError("");
    try {
      await save(changes);
    } catch (err) {
      setError(err.message || "Couldn't save");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function VendorCell({ crm, save }) {
  const { isAdmin, canEdit } = useAuth();
  const vendors = useVendors();
  const { busy, error, run } = useSaver(save);
  const manual =
    crm.vendor_source === "manual" && crm.vendor ? String(crm.vendor.id) : "";
  const auto =
    crm.vendor_source !== "manual" ? crm.vendor : crm.suggested_vendor;
  const cls =
    crm.vendor_source === "manual"
      ? "bg-brand-700 text-white ring-brand-700"
      : crm.vendor
        ? "bg-brand-50 text-brand-800 ring-brand-200"
        : "bg-amber-50 text-amber-700 ring-amber-200";
  // Vendors and view-only logins: read-only chip
  if (!isAdmin || !canEdit) {
    return (
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${cls}`}
      >
        {assignedText(crm)}
      </span>
    );
  }
  return (
    <span
      title={
        error ||
        (crm.vendor_source === "manual"
          ? "Assigned in the CRM"
          : crm.vendor_source === "sheet"
            ? "From the sheet"
            : "Automatic (area rules)")
      }
    >
      <PillSelect
        label="Assigned to"
        value={manual}
        busy={busy}
        onChange={(v) => run({ vendor_id: v ? Number(v) : null })}
        className={`${cls} ${error ? "ring-red-400" : ""}`}
      >
        <option value="">{auto ? `${auto.name} · auto` : "Unassigned"}</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </PillSelect>
      <SaveError error={error} />
    </span>
  );
}

// Update: Pending or one of the 7 values (null = Pending)
export function UpdateCell({ crm, save }) {
  const { canEdit } = useAuth();
  const { busy, error, run } = useSaver(save);
  const info = updateInfo(crm.update_status);
  // View only: the status as a plain pill, not a picker
  if (!canEdit) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${info.style}`}>{info.label}</span>;
  }
  return (
    <span title={error || undefined}>
      <PillSelect
        label="Update"
        value={crm.update_status ?? ""}
        busy={busy}
        onChange={(v) => run({ update_status: v || null })}
        className={`${info.style} ${error ? "ring-red-400" : ""}`}
      >
        <option value="">{PENDING_UPDATE.label}</option>
        {UPDATE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </PillSelect>
      <SaveError error={error} />
    </span>
  );
}

// An amount in rupees (quoted_amount or conversion_amount): click to edit, Enter / blur saves,
// Escape cancels, empty clears. The first quote also sets today as the quoted date
// (setQuotedDate: false where the lead has no quoted date, e.g. Vendors → KOC).
export function AmountCell({ crm, save, field, label, setQuotedDate = true }) {
  const { canEdit } = useAuth();
  const { busy, error, run } = useSaver(save);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const input = useRef(null);
  const current = crm[field] ?? null;

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  // View only: the amount as plain text, not clickable
  if (!canEdit) {
    return (
      <span className="inline-flex min-w-[88px] justify-end px-2.5 py-1 text-xs tabular-nums" aria-label={label}>
        {current != null ? <span className="text-sm font-semibold text-gray-900">{inr.format(current)}</span> : <span className="text-gray-400">—</span>}
      </span>
    );
  }

  const start = (e) => {
    e.stopPropagation();
    setValue(current != null ? String(current) : "");
    setEditing(true);
  };
  const commit = async () => {
    setEditing(false);
    const digits = value.replace(/\D/g, "");
    const amount = digits ? Number(digits) : null;
    if (amount === current) return;
    const changes = { [field]: amount };
    // First quote: remember today as the quoted date
    if (setQuotedDate && field === "quoted_amount" && amount != null && !crm.quoted_date)
      changes.quoted_date = new Date().toISOString().slice(0, 10);
    await run(changes);
  };

  if (editing) {
    return (
      <span className="relative inline-flex items-center" onClick={stop}>
        <span className="pointer-events-none absolute left-2.5 text-xs text-gray-400">
          ₹
        </span>
        <input
          ref={input}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d,]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Amount"
          aria-label={label}
          className="w-28 rounded-full border border-brand-300 bg-white py-1 pl-6 pr-2 text-right text-xs tabular-nums outline-none ring-2 ring-brand-600/20"
        />
      </span>
    );
  }
  return (
    <>
    <button
      type="button"
      onClick={start}
      title={error || `Click to change the ${label.toLowerCase()}`}
      className={`inline-flex min-w-[88px] items-center justify-end gap-1 rounded-full px-2.5 py-1 text-xs tabular-nums transition hover:bg-gray-100 ${error ? "ring-1 ring-red-400" : ""}`}
    >
      {busy && <Loader2 size={12} className="animate-spin text-gray-400" />}
      {current != null ? (
        <span className="text-sm font-semibold text-gray-900">
          {inr.format(current)}
        </span>
      ) : (
        <span className="text-gray-400">+ Add</span>
      )}
    </button>
    <SaveError error={error} />
    </>
  );
}

export function CrmHeaderCells({ className }) {
  const { seesAll } = useAuth(); // vendor logins don't get the Assigned to column (admins and viewers do)
  return (
    <>
      {seesAll && <th className={className}>Assigned to</th>}
      <th className={className}>Update</th>
      <th className={`${className} text-right`}>Quoted amount</th>
      <th className={`${className} text-right`}>Conversion amount</th>
    </>
  );
}

// The four cells for one row. save(changes) -> Promise
export function InlineCrmCells({ crm, save, className = "px-4 py-3" }) {
  const { seesAll } = useAuth(); // vendor logins don't get the Assigned to column (admins and viewers do)
  if (!crm) {
    return (seesAll ? [0, 1, 2, 3] : [1, 2, 3]).map((i) => (
      <td key={i} className={`${className} text-gray-300`}>
        —
      </td>
    ));
  }
  return (
    <>
      {seesAll && (
        <td className={`whitespace-nowrap ${className}`}>
          <VendorCell crm={crm} save={save} />
        </td>
      )}
      <td className={`whitespace-nowrap ${className}`}>
        <UpdateCell crm={crm} save={save} />
      </td>
      <td className={`whitespace-nowrap text-right ${className}`}>
        <AmountCell crm={crm} save={save} field="quoted_amount" label="Quoted amount" />
      </td>
      <td className={`whitespace-nowrap text-right ${className}`}>
        <AmountCell crm={crm} save={save} field="conversion_amount" label="Conversion amount" />
      </td>
    </>
  );
}
