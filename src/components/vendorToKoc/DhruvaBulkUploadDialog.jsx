import { useRef, useState } from "react";
import { downloadDhruvaTemplate, bulkAddDhruvaLeads, previewDhruvaUpload } from "../../api/dhruva.js";
import Drawer, { Alert, fieldCls, primaryBtn, secondaryBtn } from "../crmLeads/Drawer.jsx";
import { readSheetNames, defaultSheet } from "../crmLeads/xlsxSheets.js";
import { fieldErrors, mapDhruvaRecheck, phonesForApi, rowKind, rowsToDhruvaRecheck, dhruvaErrors, UPLOAD_COLUMNS, PENDING } from "../../pages/dhruvaUtils.js";
import { PhoneRows } from "./PhoneNumbers.jsx";
import { UPDATE_OPTIONS } from "../../api/leadCrm.js";
import { duplicateText } from "../shared/duplicates.js";

// Dhruva → KOC bulk upload (docs section 13): admins only (the page shows it to admins). The
// template's 15 columns; preview rows carry phones ("9845012345, 9845012346") and event_dates
// ("2026-12-04, 2026-12-05"); errors on the numbers use the field phones.
const MAX_BYTES = 5 * 1024 * 1024;
const COLS = UPLOAD_COLUMNS;
const rowValues = (r) => r.values ?? {};
const WIDE = ["response", "follow_up_notes", "comments", "message_sent"];

// One preview cell's input: Update and Needs intervention as choices, the rest as typed
function UploadCell({ field, label, row, value, onChange }) {
  const aria = `${label}, row ${row}`;
  const cls = "w-full rounded-lg border border-gray-200 px-2 py-1";
  if (field === "needs_intervention")
    return <select aria-label={aria} value={/^(yes|true)$/i.test(String(value ?? "")) || value === true ? "Yes" : "No"} onChange={(e) => onChange(e.target.value)} className={cls}><option>No</option><option>Yes</option></select>;
  const known = value == null || value === "" || value === PENDING || UPDATE_OPTIONS.some((o) => o.value === value);
  if (field === "update_status" && known)
    return <select aria-label={aria} value={value || PENDING} onChange={(e) => onChange(e.target.value === PENDING ? "" : e.target.value)} className={cls}><option value={PENDING}>Pending</option>{UPDATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
  if (field === "phones") return <PhoneRows value={value} onChange={onChange} label={aria} showErrors compact />;
  const text = Array.isArray(value) ? value.join(", ") : (value ?? "");
  return <input aria-label={aria} value={text} placeholder={field === "event_dates" ? "2026-12-04, 2026-12-05" : field === "phones" ? "9845012345, 9845012346" : undefined} onChange={(e) => onChange(e.target.value)} className={cls} />;
}

export default function DhruvaBulkUploadDialog({ onClose, onImported }) {
  const [step, setStep] = useState("choose");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState(null);
  const [sheet, setSheet] = useState("");
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const currentRef = useRef(rows);
  currentRef.current = rows;
  const fileInput = useRef(null);
  const isXlsx = Boolean(file && /\.xlsx$/i.test(file.name));
  const kinds = rows.map(rowKind);
  const counts = {
    valid: kinds.filter((k) => k === "valid" || k === "no_phone").length,
    noPhone: kinds.filter((k) => k === "no_phone").length,
    invalid: kinds.filter((k) => k === "invalid").length,
    duplicate: kinds.filter((k) => k === "duplicate").length,
  };

  async function template(format) {
    setBusy("template"); setError("");
    try { await downloadDhruvaTemplate(format); } catch (err) { setError(dhruvaErrors(err).message); }
    finally { setBusy(""); }
  }
  async function chooseFile(f) {
    setError(""); setFile(null); setSheets(null); setSheet("");
    if (!f) return;
    if (!/\.(xlsx|csv)$/i.test(f.name)) return setError("Choose an Excel (.xlsx) or CSV file.");
    if (f.size > MAX_BYTES) return setError("The file is larger than 5 MB.");
    setFile(f);
    if (/\.xlsx$/i.test(f.name)) {
      try { const names = await readSheetNames(f); setSheets(names); setSheet(defaultSheet(names)); }
      catch { setSheets(null); }
    }
  }
  async function preview() {
    setBusy("preview"); setError("");
    try {
      const res = await previewDhruvaUpload(file, { sheetName: isXlsx ? sheet : undefined });
      setRows(res.rows.map((r) => ({ ...r, rev: 0, dirty: false })));
      setStep("preview");
    } catch (err) { setError(dhruvaErrors(err).message || err.message); }
    finally { setBusy(""); }
  }
  async function recheck(current = currentRef.current) {
    if (!current.length) return current;
    setBusy("recheck"); setError("");
    try {
      const csv = new File([rowsToDhruvaRecheck(current)], "recheck.csv", { type: "text/csv" });
      const res = await previewDhruvaUpload(csv);
      const byRow = new Map(mapDhruvaRecheck(current, res.rows).map((r) => [r.row, r]));
      const next = current.map((r) => {
        const checked = byRow.get(r.row);
        if (!checked) return r;
        const values = rowValues(r);
        return { ...checked, values: { ...rowValues(checked), ...(r.dirty ? values : {}) }, rev: r.rev, dirty: false };
      });
      setRows(next); return next;
    } catch (err) { setError(dhruvaErrors(err).message || err.message); return null; }
    finally { setBusy(""); }
  }
  function edit(row, key, value) {
    setRows((list) => list.map((r) => r.row === row ? { ...r, values: { ...rowValues(r), [key]: value }, dirty: true, rev: (r.rev ?? 0) + 1 } : r));
  }
  async function remove(row) {
    const next = currentRef.current.filter((r) => r.row !== row);
    setRows(next);
    if (next.length) await recheck(next);
  }
  async function submit() {
    let current = currentRef.current;
    if (current.some((r) => r.dirty)) { current = await recheck(current); if (!current) return; }
    const valid = current.filter((r) => rowKind(r) === "valid" || rowKind(r) === "no_phone");
    if (!valid.length) return;
    setBusy("submit"); setError("");
    try {
      // The preview's values as edited (event_dates as text); never the old event_date / date
      const leads = valid.map((r) => {
        const { event_date: _e, date: _d, sent_at: _s, phone: _p, alt_phone: _a, ...values } = rowValues(r);
        if (values.phones != null) values.phones = phonesForApi(values.phones); // E.164, blanks dropped
        return values;
      });
      const res = await bulkAddDhruvaLeads(leads);
      const errors = (res.errors ?? []).map((e) => ({ ...e, row: valid[e.index]?.row }));
      setResult({ ...res, errors, notSent: current.length - valid.length });
      setStep("result");
      if (res.added) onImported();
    } catch (err) { setError(dhruvaErrors(err).message || err.message); }
    finally { setBusy(""); }
  }
  function reset() {
    setStep("choose"); setFile(null); setSheets(null); setSheet(""); setRows([]); setResult(null); setError("");
    if (fileInput.current) fileInput.current.value = "";
  }
  const footer = step === "choose" ? <><button type="button" onClick={onClose} className={secondaryBtn}>Cancel</button><button type="button" onClick={preview} disabled={!file || Boolean(busy)} className={primaryBtn}>{busy === "preview" ? "Checking…" : "Check file"}</button></>
    : step === "preview" ? <><button type="button" onClick={reset} className={secondaryBtn}>Choose another file</button><div className="text-right"><button type="button" onClick={submit} disabled={!counts.valid || Boolean(busy)} className={primaryBtn}>{busy === "submit" ? "Submitting…" : `Submit ${counts.valid} new ${counts.valid === 1 ? "lead" : "leads"}`}</button><p className="mt-1 text-xs text-gray-500">{counts.invalid} needs fixing · {counts.duplicate} duplicates · {counts.noPhone} without phone</p></div></>
    : <><button type="button" onClick={reset} className={secondaryBtn}>Upload another file</button><button type="button" onClick={onClose} className={primaryBtn}>Done</button></>;

  return <Drawer kicker="Dhruva leads" title="Bulk upload" onClose={onClose} wide={step !== "choose"} footer={footer}>
    <div className="space-y-5">
      {error && <Alert>{error}</Alert>}
      {step === "choose" && <>
        <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-100"><h3 className="text-sm font-semibold">1. Download a template</h3><p className="mt-1 text-xs text-gray-500">The template's 15 columns: {COLS.map(([, h]) => h).join(", ")}. Name is required. Phone numbers: one or more numbers of 10 digits each, comma-separated (9845012345, 9845012346); Event date takes one or more dates as YYYY-MM-DD, comma-separated. Every column is Text. Delete the example row before uploading.</p><div className="mt-3 flex gap-2">{[["xlsx", "Excel template"], ["csv", "CSV template"]].map(([fmt, label]) => <button key={fmt} type="button" onClick={() => template(fmt)} disabled={Boolean(busy)} className={secondaryBtn}>{label}</button>)}</div></section>
        <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-100"><h3 className="text-sm font-semibold">2. Choose a file</h3><input ref={fileInput} type="file" accept=".xlsx,.csv" onChange={(e) => chooseFile(e.target.files?.[0])} className="mt-3 block w-full text-sm" /><p className="mt-1 text-xs text-gray-500">Excel or CSV, up to 5 MB and 5,000 rows.</p>{sheets && <label className="mt-3 block text-xs font-medium">Sheet<select value={sheet} onChange={(e) => setSheet(e.target.value)} className={`${fieldCls} mt-1`}>{sheets.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>}</section>
      </>}
      {step === "preview" && <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Valid", kinds.filter((k) => k === "valid").length], ["Needs fixing", counts.invalid], ["Duplicates", counts.duplicate], ["No phone", counts.noPhone]].map(([label, n]) => <div key={label} className="rounded-xl bg-white p-3 ring-1 ring-gray-100"><b className="block text-xl">{n}</b><span className="text-xs text-gray-500">{label}</span></div>)}</div>
        <div className="overflow-x-auto rounded-xl ring-1 ring-gray-100"><table className="min-w-[2400px] w-full text-left text-xs"><thead className="bg-gray-50"><tr><th className="p-2">Row</th><th className="p-2">Status</th>{COLS.map(([,label]) => <th key={label} className="p-2">{label}</th>)}<th className="p-2">Action</th></tr></thead><tbody>{rows.map((r) => { const kind = rowKind(r); const v = rowValues(r); return <tr key={r.row} className="border-t border-gray-100 align-top"><td className="p-2">{r.row}</td><td className="p-2"><span title={kind === "duplicate" ? duplicateText(r.duplicate) : undefined} className={`rounded-full px-2 py-1 ${kind === "duplicate" ? "bg-amber-50 text-amber-800" : kind === "invalid" ? "bg-red-50 text-red-700" : kind === "no_phone" ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"}`}>{kind === "valid" ? "Valid" : kind === "invalid" ? "Needs fixing" : kind === "duplicate" ? "Duplicate" : "No phone"}</span>{kind === "duplicate" && <p className="mt-1 max-w-[220px] text-gray-500">{duplicateText(r.duplicate)}</p>}</td>{COLS.map(([key,label]) => <td key={key} className={`${WIDE.includes(key) ? "min-w-56" : key === "event_dates" || key === "phones" ? "min-w-48" : "min-w-32"} p-2`}><UploadCell field={key} label={label} row={r.row} value={v[key]} onChange={(value) => edit(r.row,key,value)} />{fieldErrors(r,key).map((msg,i)=><p key={i} className="mt-1 text-red-600">{msg}</p>)}</td>)}<td className="p-2"><button type="button" onClick={() => remove(r.row)} className="text-red-600">Remove</button></td></tr>; })}</tbody></table></div>
        <button type="button" onClick={() => recheck()} disabled={Boolean(busy)} className={secondaryBtn}>{busy === "recheck" ? "Re-checking…" : "Re-check edits"}</button>
      </>}
      {step === "result" && result && <><Alert kind="success">Added {result.added} leads. Skipped {result.duplicates_skipped} duplicates; {result.failed} failed.</Alert>{result.errors?.length > 0 && <ul className="space-y-1 rounded-xl bg-white p-4 text-sm ring-1 ring-gray-100">{result.errors.map((e,i)=><li key={i} className="text-red-700">Row {e.row ?? e.index + 1} · {e.field}: {e.message}</li>)}</ul>}</>}
    </div>
  </Drawer>;
}
