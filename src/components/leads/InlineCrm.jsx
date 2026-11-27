import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { PENDING_UPDATE, UPDATE_OPTIONS, updateInfo } from "../../api/leadCrm.js";
import { listVendors } from "../../api/vendors.js";
import { useAuth } from "../../auth/useAuth.js";
import { assignableVendors, assignmentChange, assignmentOf, automaticLabel, assignedText, AUTOMATIC_CHOICE, UNASSIGNED_CHOICE } from "./crmAccess.js";
import { isMultiVendor, vendorChips } from "./leadVendors.js";

// The editable CRM cells in every lead table: Assigned to, Update, Quoted amount, Conversion amount.
// Each change is saved at once (only that field) and the row updates in place.
// Who edits what: Assigned to = admins only (vendor logins don't get this column); Update and the
// amounts = admins and the assigned vendor. Save errors (403/404/422…) are shown under the cell.
// A lead with several vendors (docs section 19): Assigned to shows one chip per vendor, and Update
// and the amounts (the overall values) are read-only here: each vendor's copy is saved in the lead
// panel's cards (a save here couldn't say whose copy, which the API answers with 422).
const SEVERAL = "Several vendors: change each vendor's copy in the lead panel";

const CHIP_TONES = {
  manual: "bg-brand-700 text-white ring-brand-700",
  auto: "bg-brand-50 text-brand-800 ring-brand-200",
  none: "bg-amber-50 text-amber-700 ring-amber-200",
};

// "Assigned to" chips: one per vendor ("Unassigned" when none)
export function VendorChips({ crm }) {
  return (
    <span className="flex max-w-[16rem] flex-wrap gap-1 whitespace-normal" aria-label="Assigned to">
      {vendorChips(crm).map((c) => (
        <span key={c.key} className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${CHIP_TONES[c.tone]}`}>
          {c.text}
        </span>
      ))}
    </span>
  );
}

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
        className={`pill-select min-h-8 cursor-pointer appearance-none rounded-full py-1 pl-3 pr-7 text-xs font-medium outline-none sm:min-h-0 ring-1 transition focus:ring-2 focus:ring-brand-600/40 disabled:opacity-60 ${className}`}
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
  // Automatic, Unassigned or a vendor (crmAccess.js); Unassigned reads "Unassigned", never "· auto"
  const choice = assignmentOf(crm);
  const cls =
    crm.vendor_source === "manual"
      ? "bg-brand-700 text-white ring-brand-700"
      : crm.vendor
        ? "bg-brand-50 text-brand-800 ring-brand-200"
        : "bg-amber-50 text-amber-700 ring-amber-200";
  // View-only logins, and leads with several vendors: one chip per vendor (several vendors are
  // added or changed in the lead panel, so one pick here can't drop the others by accident)
  if (!isAdmin || !canEdit || isMultiVendor(crm)) {
    return (
      <span title={isMultiVendor(crm) && isAdmin && canEdit ? "Several vendors: change them in the lead panel" : undefined}>
        <VendorChips crm={crm} />
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
            : crm.vendor_source === "source_default"
              ? "Automatic (gift lead: Wedding Gifts & Return Gifts)"
              : "Automatic (area rules)")
      }
    >
      <PillSelect
        label="Assigned to"
        value={choice}
        busy={busy}
        onChange={(v) => run(assignmentChange(v))}
        className={`${cls} ${error ? "ring-red-400" : ""}`}
      >
        <option value={AUTOMATIC_CHOICE}>{choice === AUTOMATIC_CHOICE ? (crm.vendor ? assignedText(crm) : automaticLabel(crm)) : automaticLabel(crm)}</option>
        <option value={UNASSIGNED_CHOICE}>Unassigned</option>
        {/* Active vendors only; the lead's own inactive vendor stays visible but can't be picked */}
        {assignableVendors(vendors, crm.vendor_source === "manual" ? crm.vendor : null).map((v) => (
          <option key={v.id} value={v.id} disabled={v.inactive}>
            {v.inactive ? `${v.name} (inactive)` : v.name}
          </option>
        ))}
      </PillSelect>
      <SaveError error={error} />
    </span>
  );
}

// Update: Pending or one of the 7 values (null = Pending)
export function UpdateCell({ crm, save, readOnly = false }) {
  const { canEdit } = useAuth();
  const { busy, error, run } = useSaver(save);
  const info = updateInfo(crm.update_status);
  // View only (or several vendors): the status as a plain pill, not a picker
  if (!canEdit || readOnly) {
    return <span title={readOnly ? SEVERAL : undefined} className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${info.style}`}>{info.label}</span>;
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
export function AmountCell({ crm, save, field, label, setQuotedDate = true, readOnly = false }) {
  const { canEdit } = useAuth();
  const { busy, error, run } = useSaver(save);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const input = useRef(null);
  const current = crm[field] ?? null;

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  // View only (or several vendors): the amount as plain text, not clickable
  if (!canEdit || readOnly) {
    return (
      <span title={readOnly ? SEVERAL : undefined} className="inline-flex min-w-[88px] justify-end px-2.5 py-1 text-xs tabular-nums" aria-label={label}>
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

// swapHeader / swapCell: shown where the Update column normally is, when the page moves Update
// further left (Spin: Update swaps places with "Other wedding services")
export function CrmHeaderCells({ className, swapHeader }) {
  const { seesAll } = useAuth(); // vendor logins don't get the Assigned to column (admins and viewers do)
  return (
    <>
      {seesAll && <th className={className}>Assigned to</th>}
      <th className={className}>{swapHeader ?? "Update"}</th>
      <th className={`${className} text-right`}>Quoted amount</th>
      <th className={`${className} text-right`}>Conversion amount</th>
    </>
  );
}

// The four cells for one row. save(changes) -> Promise
export function InlineCrmCells({ crm, save, className = "px-4 py-3", swapCell }) {
  const { seesAll } = useAuth(); // vendor logins don't get the Assigned to column (admins and viewers do)
  const several = Boolean(seesAll) && isMultiVendor(crm); // vendor logins only ever see their own copy
  if (!crm) {
    return (seesAll ? [0, 1, 2, 3] : [1, 2, 3]).map((i) =>
      i === 1 && swapCell !== undefined ? (
        <td key={i} className={`whitespace-nowrap ${className}`}>{swapCell ?? <span className="text-gray-300">—</span>}</td>
      ) : (
        <td key={i} className={`${className} text-gray-300`}>
          —
        </td>
      ),
    );
  }
  return (
    <>
      {seesAll && (
        <td className={`${several ? "" : "whitespace-nowrap"} ${className}`}>
          <VendorCell crm={crm} save={save} />
        </td>
      )}
      <td className={`whitespace-nowrap ${className}`}>
        {swapCell !== undefined ? swapCell ?? <span className="text-gray-300">—</span> : <UpdateCell crm={crm} save={save} readOnly={several} />}
      </td>
      <td className={`whitespace-nowrap text-right ${className}`}>
        <AmountCell crm={crm} save={save} field="quoted_amount" label="Quoted amount" readOnly={several} />
      </td>
      <td className={`whitespace-nowrap text-right ${className}`}>
        <AmountCell crm={crm} save={save} field="conversion_amount" label="Conversion amount" readOnly={several} />
      </td>
    </>
  );
}
