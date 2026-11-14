import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { INTEREST_OPTIONS, interestInfo } from "../../api/leadCrm.js";
import { listVendors } from "../../api/vendors.js";

// The four editable CRM cells in every lead table: Assigned to, Interest, Quote, Converted.
// Each change is saved at once (only that field) and the row updates in place.

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
    </span>
  );
}

export function InterestCell({ crm, save }) {
  const { busy, error, run } = useSaver(save);
  const info = interestInfo(crm.interest);
  return (
    <span title={error || undefined}>
      <PillSelect
        label="Interest"
        value={crm.interest ?? ""}
        busy={busy}
        onChange={(v) => run({ interest: v || null })}
        className={`${info ? info.style : "bg-white text-gray-500 ring-gray-200"} ${error ? "ring-red-400" : ""}`}
      >
        <option value="">Select…</option>
        {INTEREST_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {info && !INTEREST_OPTIONS.includes(info) && (
          <option value={info.value}>{info.label}</option>
        )}
      </PillSelect>
    </span>
  );
}

export function QuoteCell({ crm, save }) {
  const { busy, error, run } = useSaver(save);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const input = useRef(null);

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const start = (e) => {
    e.stopPropagation();
    setValue(crm.quoted_amount != null ? String(crm.quoted_amount) : "");
    setEditing(true);
  };
  const commit = async () => {
    setEditing(false);
    const digits = value.replace(/\D/g, "");
    const amount = digits ? Number(digits) : null;
    if (amount === (crm.quoted_amount ?? null)) return;
    const changes = { quoted_amount: amount };
    // First quote: remember today as the quoted date
    if (amount != null && !crm.quoted_date)
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
          aria-label="Quoted amount"
          className="w-28 rounded-full border border-brand-300 bg-white py-1 pl-6 pr-2 text-right text-xs tabular-nums outline-none ring-2 ring-brand-600/20"
        />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={start}
      title={error || "Click to change the quoted amount"}
      className={`inline-flex min-w-[88px] items-center justify-end gap-1 rounded-full px-2.5 py-1 text-xs tabular-nums transition hover:bg-gray-100 ${error ? "ring-1 ring-red-400" : ""}`}
    >
      {busy && <Loader2 size={12} className="animate-spin text-gray-400" />}
      {crm.quoted_amount != null ? (
        <span className="text-sm font-semibold text-gray-900">
          {inr.format(crm.quoted_amount)}
        </span>
      ) : (
        <span className="text-gray-400">+ Add</span>
      )}
    </button>
  );
}

export function ConvertedCell({ crm, save }) {
  const { busy, error, run } = useSaver(save);
  return (
    <span title={error || undefined}>
      <PillSelect
        label="Converted"
        value={crm.converted ? "yes" : "no"}
        busy={busy}
        onChange={(v) => run({ converted: v === "yes" })}
        className={`${crm.converted ? "bg-emerald-500 text-white ring-emerald-500" : "bg-white text-gray-600 ring-gray-200"} ${error ? "ring-red-400" : ""}`}
      >
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </PillSelect>
    </span>
  );
}

export function CrmHeaderCells({ className }) {
  return (
    <>
      <th className={className}>Assigned to</th>
      <th className={className}>Interest</th>
      <th className={`${className} text-right`}>Quoted amount</th>
      <th className={className}>Converted</th>
    </>
  );
}

// The four cells for one row. save(changes) -> Promise
export function InlineCrmCells({ crm, save, className = "px-4 py-3" }) {
  if (!crm) {
    return [0, 1, 2, 3].map((i) => (
      <td key={i} className={`${className} text-gray-300`}>
        —
      </td>
    ));
  }
  return (
    <>
      <td className={`whitespace-nowrap ${className}`}>
        <VendorCell crm={crm} save={save} />
      </td>
      <td className={`whitespace-nowrap ${className}`}>
        <InterestCell crm={crm} save={save} />
      </td>
      <td className={`whitespace-nowrap text-right ${className}`}>
        <QuoteCell crm={crm} save={save} />
      </td>
      <td className={`whitespace-nowrap ${className}`}>
        <ConvertedCell crm={crm} save={save} />
      </td>
    </>
  );
}
