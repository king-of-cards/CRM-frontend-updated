import { useRef, useState } from "react";
import { Download, FileSpreadsheet, RefreshCw, Trash2, Upload } from "lucide-react";
import { bulkAddKocLeads, downloadKocTemplate, previewKocUpload } from "../../api/vendorToKoc.js";
import Drawer, { Alert, fieldCls, primaryBtn, secondaryBtn } from "../crmLeads/Drawer.jsx";
import { readSheetNames } from "../crmLeads/xlsxSheets.js";
import { fieldErrors, kocErrors, mapKocRecheck, rowKind, rowsToKocCsv } from "./kocUtils.js";

// Vendors → KOC bulk upload (docs section 11): template → (admins: vendor) → file (+ sheet) →
// preview (nothing saved) → fix / remove rows, re-checked on blur or with "Re-check" →
// submit the valid ones (POST /leads/bulk) → result. Errors are shown exactly as the API
// returns them, matched by field, never by their text.
const MAX_BYTES = 5 * 1024 * 1024;
const COLS = [
  { key: "name", label: "Name" },
  { key: "date", label: "Date" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
];

function Count({ label, n, cls }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 ${cls}`}>
      <p className="text-2xl font-semibold">{n}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

export default function KocBulkUploadDialog({ isAdmin, vendors, onClose, onImported }) {
  const [step, setStep] = useState("choose"); // choose | preview | result
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState(null);
  const [sheet, setSheet] = useState("");
  const [rows, setRows] = useState([]); // preview rows + { rev, dirty, fixable }
  const [result, setResult] = useState(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const checkId = useRef(0);
  const fileInput = useRef(null);

  const isXlsx = file && /\.xlsx$/i.test(file.name);
  const vendorName = vendors.find((v) => String(v.id) === String(vendorId))?.name;
  const kinds = rows.map(rowKind);
  const counts = {
    valid: kinds.filter((k) => k === "valid").length,
    invalid: kinds.filter((k) => k === "invalid").length,
    duplicate: kinds.filter((k) => k === "duplicate").length,
  };

  async function template(format) {
    setBusy("template");
    setError("");
    try {
      await downloadKocTemplate(format);
    } catch (err) {
      setError(kocErrors(err).message);
    } finally {
      setBusy("");
    }
  }

  async function pickFile(f) {
    setError("");
    setSheets(null);
    setSheet("");
    setFile(null);
    if (!f) return;
    if (!/\.(xlsx|csv)$/i.test(f.name)) return setError("Choose an Excel (.xlsx) or CSV file.");
    if (f.size > MAX_BYTES) return setError("The file is larger than 5 MB.");
    setFile(f);
    if (/\.xlsx$/i.test(f.name)) {
      try {
        const names = await readSheetNames(f);
        setSheets(names);
        setSheet(names[0] ?? ""); // the API reads the first sheet by default
      } catch {
        setSheets(null); // can't list them: the first sheet is read
      }
    }
  }

  async function check() {
    if (isAdmin && !vendorId) return setError("Pick the vendor these leads are for.");
    setBusy("preview");
    setError("");
    try {
      const res = await previewKocUpload(file, { sheetName: isXlsx ? sheet : undefined, vendorId: isAdmin ? vendorId : undefined });
      setRows(res.rows.map((r) => ({ ...r, rev: 0, dirty: false, fixable: rowKind(r) !== "valid" })));
      setStep("preview");
    } catch (err) {
      setError(kocErrors(err).message);
    } finally {
      setBusy("");
    }
  }

  // Send the rows again (as a CSV) to the preview; nothing is saved. Returns the new rows.
  async function recheck(current = rowsRef.current) {
    if (!current.length) return current;
    const id = ++checkId.current;
    const sent = current.map((r) => ({ row: r.row, rev: r.rev }));
    setBusy("recheck");
    setError("");
    try {
      const csv = new File([rowsToKocCsv(current)], "recheck.csv", { type: "text/csv" });
      const res = await previewKocUpload(csv, { vendorId: isAdmin ? vendorId : undefined });
      if (id !== checkId.current) return null;
      const byRow = new Map(mapKocRecheck(current, res.rows).map((r) => [r.row, r]));
      const next = rowsRef.current.map((r) => {
        const before = sent.find((x) => x.row === r.row);
        const c = byRow.get(r.row);
        if (!before || !c) return r; // not in this check (e.g. an empty row the file skips)
        const changedSince = r.rev !== before.rev;
        return {
          ...c,
          ...(changedSince ? { name: r.name, date: r.date, phone: r.phone, city: r.city } : {}),
          rev: r.rev,
          dirty: changedSince,
          fixable: r.fixable,
        };
      });
      setRows(next);
      return next;
    } catch (err) {
      if (id === checkId.current) setError(kocErrors(err).message);
      return null;
    } finally {
      if (id === checkId.current) setBusy("");
    }
  }

  function edit(row, key, value) {
    setRows((list) => list.map((r) => (r.row === row ? { ...r, [key]: value, rev: r.rev + 1, dirty: true } : r)));
  }
  function blur(row) {
    if (rowsRef.current.find((r) => r.row === row)?.dirty) recheck();
  }
  function remove(row) {
    const next = rowsRef.current.filter((r) => r.row !== row);
    setRows(next);
    if (next.length) recheck(next); // removing a row can change the duplicates
  }

  async function submit() {
    let current = rowsRef.current;
    if (current.some((r) => r.dirty)) {
      current = await recheck(current);
      if (!current) return;
    }
    const valid = current.filter((r) => rowKind(r) === "valid");
    if (!valid.length) return;
    setBusy("submit");
    setError("");
    try {
      // Valid preview dates are YYYY-MM-DD, as the JSON endpoint takes them
      const leads = valid.map((r) => ({ name: r.name, date: r.date, phone: r.phone, city: r.city }));
      const res = await bulkAddKocLeads(leads, isAdmin ? vendorId : undefined);
      const errors = (res.errors ?? []).map((e) => ({ ...e, row: valid[e.index]?.row }));
      setResult({ ...res, errors, notSent: current.filter((r) => rowKind(r) !== "valid") });
      setStep("result");
      if (res.added) onImported();
    } catch (err) {
      setError(kocErrors(err).message);
    } finally {
      setBusy("");
    }
  }

  function reset() {
    setStep("choose");
    setFile(null);
    setSheets(null);
    setSheet("");
    setRows([]);
    setResult(null);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  const footer =
    step === "choose" ? (
      <>
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Cancel
        </button>
        <button type="button" onClick={check} disabled={!file || busy === "preview"} className={primaryBtn}>
          {busy === "preview" ? "Checking…" : "Check file"}
        </button>
      </>
    ) : step === "preview" ? (
      <>
        <button type="button" onClick={reset} className={secondaryBtn}>
          Choose another file
        </button>
        <div className="flex flex-col items-end">
          <button type="button" onClick={submit} disabled={!counts.valid || Boolean(busy)} className={primaryBtn}>
            {busy === "submit" ? "Submitting…" : `Submit ${counts.valid} ${counts.valid === 1 ? "lead" : "leads"}`}
          </button>
          {(counts.invalid > 0 || counts.duplicate > 0) && (
            <p className="mt-1 text-[11px] text-gray-500">
              Skipping {[counts.invalid && `${counts.invalid} invalid`, counts.duplicate && `${counts.duplicate} duplicate`]
                .filter(Boolean)
                .join(" and ")}
              .
            </p>
          )}
        </div>
      </>
    ) : (
      <>
        <button type="button" onClick={reset} className={secondaryBtn}>
          Upload another file
        </button>
        <button type="button" onClick={onClose} className={primaryBtn}>
          Done
        </button>
      </>
    );

  return (
    <Drawer
      kicker={isAdmin && vendorName ? `Vendors → KOC · ${vendorName}` : "Vendors → KOC"}
      title="Bulk upload"
      onClose={onClose}
      wide={step !== "choose"}
      footer={footer}
    >
      <div className="space-y-5">
        {error && <Alert>{error}</Alert>}

        {step === "choose" && (
          <>
            <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">1. Download the template</h3>
              <p className="mt-1 text-xs text-gray-500">Name, Date, Phone and City. Delete the example row before uploading.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["xlsx", "Excel template"],
                  ["csv", "CSV template"],
                ].map(([fmt, label]) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => template(fmt)}
                    disabled={busy === "template"}
                    className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    <Download size={14} /> {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">2. Choose your file</h3>
              {isAdmin && (
                <label className="mt-3 block">
                  <span className="text-xs font-medium text-gray-600">
                    Vendor<span className="ml-0.5 text-red-600">*</span>
                  </span>
                  <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={`mt-1.5 ${fieldCls}`}>
                    <option value="">Pick the vendor these leads are for</option>
                    {vendors.filter((v) => v.is_active !== false).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="mt-3 text-xs text-gray-500">Excel (.xlsx) or CSV, up to 5 MB. Nothing is saved until you submit.</p>
              <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-600 hover:border-brand-600 hover:bg-brand-50/40">
                {file ? <FileSpreadsheet size={20} className="text-brand-700" /> : <Upload size={20} />}
                <span className="truncate">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : "Choose a file…"}</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {isXlsx && sheets && (
                <label className="mt-3 block">
                  <span className="text-xs font-medium text-gray-600">Sheet</span>
                  <select value={sheet} onChange={(e) => setSheet(e.target.value)} className={`mt-1.5 ${fieldCls}`}>
                    {sheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          </>
        )}

        {step === "preview" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Count label="Valid" n={counts.valid} cls="bg-emerald-50 text-emerald-700 ring-emerald-100" />
              <Count label="Invalid" n={counts.invalid} cls="bg-red-50 text-red-700 ring-red-100" />
              <Count label="Duplicate (skipped)" n={counts.duplicate} cls="bg-gray-50 text-gray-700 ring-gray-100" />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => recheck()}
                disabled={Boolean(busy)}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <RefreshCw size={14} className={busy === "recheck" ? "animate-spin" : ""} />
                {busy === "recheck" ? "Re-checking…" : "Re-check"}
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-gray-100">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50/80">
                  <tr>
                    {["Row", "Status", ...COLS.map((c) => c.label), ""].map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const kind = rowKind(r);
                    return (
                      <tr key={r.row} className="border-b border-gray-50 align-top">
                        <td className="px-3 py-2 text-gray-500">{r.row}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                              kind === "valid"
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : kind === "invalid"
                                  ? "bg-red-50 text-red-700 ring-red-200"
                                  : "bg-gray-100 text-gray-700 ring-gray-200"
                            }`}
                          >
                            {kind === "valid" ? "Valid" : kind === "invalid" ? "Invalid" : "Duplicate"}
                          </span>
                          {r.dirty && <span className="mt-1 block text-[10px] text-gray-500">Edited · not re-checked</span>}
                        </td>
                        {COLS.map((c) => {
                          const errs = fieldErrors(r, c.key);
                          return (
                            <td key={c.key} className="px-3 py-2">
                              {r.fixable ? (
                                <input
                                  value={r[c.key] ?? ""}
                                  onChange={(e) => edit(r.row, c.key, e.target.value)}
                                  onBlur={() => blur(r.row)}
                                  aria-label={`${c.label}, row ${r.row}`}
                                  aria-invalid={errs.length > 0}
                                  className={`${fieldCls} min-w-[120px] py-1.5 ${errs.length ? "border-red-300" : ""}`}
                                />
                              ) : (
                                (r[c.key] ?? <span className="text-gray-300">—</span>)
                              )}
                              {errs.map((m) => (
                                <p key={m} className="mt-0.5 max-w-[240px] text-[11px] text-red-600">
                                  {m}
                                </p>
                              ))}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2">
                          {r.fixable && (
                            <button
                              type="button"
                              onClick={() => remove(r.row)}
                              aria-label={`Remove row ${r.row}`}
                              title="Remove this row"
                              className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {step === "result" && result && (
          <>
            <Alert kind={result.added ? "success" : "warning"}>
              <p className="font-semibold">{result.added === 1 ? "1 lead added." : `${result.added} leads added.`}</p>
              <p className="mt-0.5">
                {result.duplicates_skipped} duplicates skipped · {result.failed} failed
                {result.notSent.length ? ` · ${result.notSent.length} not sent (invalid or duplicate in the preview)` : ""}
              </p>
            </Alert>
            {result.errors.length > 0 && (
              <ul className="space-y-1 rounded-2xl bg-white p-4 text-sm ring-1 ring-gray-100">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-red-700">
                    Row {e.row ?? e.index + 1} · {e.field}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
