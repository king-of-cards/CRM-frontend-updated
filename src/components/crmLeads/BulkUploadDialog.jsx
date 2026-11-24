import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, RefreshCw, Trash2, Upload } from "lucide-react";
import { KOC_TO_DHRUVA_SOURCE, uploadApi } from "../../api/uploads.js";
import { fillInfo, KOC_TO_DHRUVA_UPLOAD_HINT, kocToDhruvaFields, spinCountChips, spinMatch } from "./kocToDhruvaUpload.js";
import Drawer, { Alert, fieldCls, primaryBtn, secondaryBtn } from "./Drawer.jsx";
import { defaultSheet, readSheetNames } from "./xlsxSheets.js";
import { formatDay } from "../shared/dates.js";
import { useVendors } from "../leads/InlineCrm.jsx";
import { assignableVendors } from "../leads/crmAccess.js";
import { PENDING_UPDATE, UPDATE_OPTIONS, updateInfo } from "../../api/leadCrm.js";
import {
  assignedChoice,
  assignedForUpload,
  AUTOMATIC,
  previewColumns,
  SPIN_ASSIGNED_HINT,
  wrapsInPreview,
  screenFieldKeys,
  uploadFields,
  duplicateLabel,
  duplicateWhere,
  errorText,
  fieldErrors,
  mapRecheck,
  otherSources,
  rowsToCsv,
  skippedText,
  SOURCE_NAMES,
  sourceList,
  submitLabel,
  summarize,
} from "./crmLeadUtils.js";
import { FormSkeleton } from "../shared/Skeleton.jsx";

// Bulk upload: template → file (+ sheet) → preview (nothing saved) → fix/remove rows → import → result.
// source: one of the four KOC → Vendors sources (/crm-leads/{source}), or "koc_to_dhruva"
// (/koc-to-dhruva/leads, admins only: docs section 18), whose rows also show whether they are in
// Spin (an upload never changes Spin).
const MAX_BYTES = 5 * 1024 * 1024;
const PAGE = 100;

const inrAmount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const editable = (r) => r.status === "error" || r.status === "duplicate";

function Badge({ tone, title, children }) {
  const cls = {
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    error: "bg-red-50 text-red-700 ring-red-200",
    dup: "bg-gray-100 text-gray-700 ring-gray-200",
    warn: "bg-amber-50 text-amber-800 ring-amber-200",
  }[tone];
  return (
    <span title={title} className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>
      {children}
    </span>
  );
}

function RowBadges({ row }) {
  const also = otherSources(row.warnings);
  return (
    <div className="flex flex-col items-start gap-1">
      {row.status === "ok" && <Badge tone="ok">Valid</Badge>}
      {row.status === "error" && (
        <Badge tone="error" title={(row.errors ?? []).map((e) => `${e.field}: ${e.message}`).join("\n")}>
          Needs fixing
        </Badge>
      )}
      {row.status === "duplicate" && (
        <Badge tone="dup" title={[duplicateLabel(row.duplicate), duplicateWhere(row.duplicate)].filter(Boolean).join(" · ")}>
          {duplicateLabel(row.duplicate)}
        </Badge>
      )}
      {also.length > 0 && <Badge tone="warn">Also in {sourceList(also)}</Badge>}
      {row.dirty && <span className="text-[10px] text-gray-500">Edited · not re-checked</span>}
    </div>
  );
}

const SPIN_TONES = {
  match: "bg-sky-50 text-sky-800 ring-sky-200",
  dhruva: "bg-violet-50 text-violet-800 ring-violet-200",
  none: "",
};

// KOC → Dhruva: the row's Spin link (spin.action matched / not_in_spin, spin.leads[].vendors, also_in)
export function SpinMatchCell({ row }) {
  const m = spinMatch(row);
  if (m.tone === "none") return <span className="text-gray-300">—</span>;
  return (
    <div className="flex min-w-[180px] max-w-[260px] flex-col items-start gap-1 whitespace-normal">
      <span title={m.detail} className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${SPIN_TONES[m.tone]}`}>
        {m.label}
      </span>
      {m.detail && <span className="text-[11px] leading-tight text-gray-600">{m.detail}</span>}
      {m.leads.length > 0 && m.tone === "match" && (
        <ul className="text-[11px] leading-tight text-gray-500">
          {m.leads.map((l) => (
            <li key={l.key}>
              {[l.name || l.key, l.vendors.length ? l.vendors.join(", ") : "Unassigned"].join(" · ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SpinChips({ chips }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Spin">
      {chips.map(([label, n]) => (
        <span key={label} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-100">
          {label}: <span className="font-semibold tabular-nums">{n}</span>
        </span>
      ))}
    </div>
  );
}

function CellInput({ field, value, onChange, onBlur, errors, branches, vendors }) {
  const invalid = errors.length > 0;
  const cls = `${fieldCls} min-w-[140px] py-1.5 ${invalid ? "border-red-300" : ""}`;
  let input;
  if (field.type === "update") {
    // Update: Pending (empty) or one of the 7 values; the preview sends the code (null = Pending)
    const known = !value || UPDATE_OPTIONS.some((o) => o.value === value);
    input = (
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        onBlur={onBlur}
        className={cls}
        aria-invalid={invalid}
      >
        <option value="">{PENDING_UPDATE.label}</option>
        {!known && <option value={String(value)}>{String(value)} (unknown)</option>}
        {UPDATE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "assigned") {
    // Unassigned, each active vendor, Automatic ("<vendor> · auto" in the file shows as Automatic)
    const choice = assignedChoice(value);
    // Active vendors only: an inactive vendor in the file shows as unknown (the API's row error)
    const active = assignableVendors(vendors);
    const known = choice === "Unassigned" || choice === AUTOMATIC || active.some((v) => v.name === choice);
    input = (
      <select
        value={choice}
        onChange={(e) => onChange(assignedForUpload(e.target.value))}
        onBlur={onBlur}
        className={cls}
        aria-invalid={invalid}
      >
        <option value="Unassigned">Unassigned</option>
        {!known && <option value={choice}>{choice} (unknown)</option>}
        {active.map((v) => (
          <option key={v.id} value={v.name}>
            {v.name}
          </option>
        ))}
        <option value={AUTOMATIC}>Automatic</option>
      </select>
    );
  } else if (field.type === "branch") {
    const known = branches.some((b) => String(b.id) === String(value ?? ""));
    input = (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={cls} aria-invalid={invalid}>
        <option value="">No branch</option>
        {!known && value !== null && value !== undefined && value !== "" && (
          <option value={String(value)}>{String(value)} (unknown)</option>
        )}
        {branches.map((b) => (
          <option key={b.id} value={String(b.id)}>
            {b.name}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "bool") {
    const v = value === true ? "Yes" : value === false ? "No" : (value ?? "");
    input = (
      <select value={v} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={cls} aria-invalid={invalid}>
        <option value="">—</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
        {v && v !== "Yes" && v !== "No" && <option value={v}>{v}</option>}
      </select>
    );
  } else if (wrapsInPreview(field)) {
    // Long text (e.g. Other wedding services): a small box that wraps
    input = (
      <textarea
        rows={2}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={field.label}
        aria-invalid={invalid}
        className={`${cls} min-w-[200px] resize-y`}
      />
    );
  } else {
    input = (
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={field.label}
        aria-invalid={invalid}
        inputMode={field.type === "int" ? "numeric" : undefined}
        className={cls}
      />
    );
  }
  return (
    <div>
      {input}
      {errors.map((m) => (
        <p key={m} className="mt-0.5 max-w-[220px] whitespace-normal text-[11px] text-red-600">
          {m}
        </p>
      ))}
    </div>
  );
}

function cellText(field, value, branches) {
  if (field.type === "assigned") return assignedChoice(value);
  if (field.type === "update") return updateInfo(value).label;
  if (field.type === "amount" && value != null && value !== "" && /^\d+$/.test(String(value)))
    return inrAmount.format(Number(value));
  if (value === null || value === undefined || value === "") return null;
  if (field.type === "branch") return branches.find((b) => String(b.id) === String(value))?.name ?? String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

// KOC → Dhruva: the fields filled from the workflow and Received (fill), or why not (fill_skipped)
export function FillCell({ row, fields = [], branches = [] }) {
  const f = fillInfo(row, fields);
  if (!f) return <span className="text-gray-300">—</span>;
  if (f.kind === "skipped") {
    return (
      <div className="flex min-w-[160px] max-w-[240px] flex-col items-start gap-1 whitespace-normal">
        <span className="inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
          Not filled
        </span>
        <span className="text-[11px] leading-tight text-gray-600">{f.text}</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-[180px] max-w-[260px] flex-col items-start gap-1 whitespace-normal">
      <span
        title={f.workflowId != null ? `Workflow lead ${f.workflowId}` : undefined}
        className="inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
      >
        {f.items.length ? `Filled from workflow (${f.items.length})` : "From workflow"}
      </span>
      {f.items.length > 0 && (
        <ul className="text-[11px] leading-tight text-gray-600">
          {f.items.map((i) => (
            <li key={i.key}>
              <span className="text-gray-500">{i.label}:</span> {i.field.type === "date" ? formatDay(i.value) : (cellText(i.field, i.value, branches) ?? String(i.value))}
            </li>
          ))}
        </ul>
      )}
      {f.received && <span className="text-[11px] leading-tight text-gray-500">{`Received: ${f.received}`}</span>}
    </div>
  );
}

export default function BulkUploadDialog({ source, onClose, onImported }) {
  const api = useMemo(() => uploadApi(source), [source]);
  const isKd = source === KOC_TO_DHRUVA_SOURCE;
  const [meta, setMeta] = useState(null);
  const [step, setStep] = useState("choose"); // choose | preview | result
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(""); // what's running: template | preview | recheck | import

  // Step 1: file and sheet
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState(null); // sheet names, or null
  const [sheetText, setSheetText] = useState(false); // couldn't read the names: type it
  const [sheet, setSheet] = useState("");
  const fileInput = useRef(null);

  // Step 2: preview
  const [preview, setPreview] = useState(null); // { columns, ignored_columns }
  const [checkCounts, setCheckCounts] = useState(null); // the last check's counts (KOC → Dhruva: spin_…)
  const [rows, setRows] = useState([]); // preview rows + { rev, dirty }
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const checkId = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Step 3: result
  const [result, setResult] = useState(null);

  // The list screen's columns (the CSV template's header row); null = not known
  const [templateHeaders, setTemplateHeaders] = useState(null);
  const vendors = useVendors(); // active vendors, for "Assigned to"
  useEffect(() => {
    let cancelled = false;
    api
      .templateHeaders()
      .then((h) => !cancelled && setTemplateHeaders(h))
      .catch(() => {}); // without it, the preview shows the file's columns
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    api
      .fields()
      .then((m) => !cancelled && setMeta(m))
      .catch((err) => !cancelled && setError(errorText(err)));
    return () => {
      cancelled = true;
    };
  }, [api]);

  // Every field a row can have: the source's fields (+ Update and amounts); KOC → Dhruva: the
  // columns its preview names, typed like Spin's fields
  const fieldsFor = (list) =>
    !meta ? [] : isKd ? kocToDhruvaFields(meta.fields, preview?.columns, list) : uploadFields(meta.fields);

  const branches = meta?.branches ?? [];
  const isXlsx = file && /\.xlsx$/i.test(file.name);

  async function template(format) {
    setBusy("template");
    setError("");
    try {
      await api.template(format);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy("");
    }
  }

  async function pickFile(f) {
    setError("");
    setSheets(null);
    setSheetText(false);
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
        setSheet(defaultSheet(names));
      } catch {
        setSheetText(true);
        setSheet("Leads");
      }
    }
  }

  function startRows(list) {
    setRows(list.map((r) => ({ ...r, rev: 0, dirty: false, fixable: editable(r) })));
    setShown(PAGE);
  }

  async function check() {
    setBusy("preview");
    setError("");
    try {
      const res = await api.preview(file, isXlsx ? sheet.trim() : undefined);
      setPreview({
        columns: res.columns,
        ignored: res.ignored_columns ?? [],
        readOnly: res.read_only_columns ?? [],
      });
      startRows(res.rows);
      setCheckCounts(res.counts ?? null);
      setOnlyProblems(false);
      setStep("preview");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy("");
    }
  }

  // Columns: the list screen's (from the template), plus other fields in the file or with an error
  const columns = useMemo(() => {
    if (!meta || !preview) return [];
    const fields = fieldsFor(rows);
    return previewColumns(fields, {
      screenKeys: templateHeaders ? screenFieldKeys(fields, templateHeaders) : null,
      fileKeys: Object.values(preview.columns),
      errorKeys: rows.flatMap((r) => (r.errors ?? []).map((e) => e.field)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, preview, rows, templateHeaders, isKd]);

  const counts = useMemo(() => summarize(rows), [rows]);
  const anyDirty = rows.some((r) => r.dirty);

  // Send every row again (as a CSV) to the preview; nothing is saved. Returns the new rows.
  async function recheck(current = rowsRef.current) {
    if (!current.length) return current;
    const id = ++checkId.current;
    const sent = current.map((r) => ({ row: r.row, rev: r.rev }));
    setBusy("recheck");
    setError("");
    try {
      const csv = rowsToCsv(fieldsFor(current), current, branches, { headers: isKd ? "label" : "key" });
      const res = await api.preview(new File([csv], "recheck.csv", { type: "text/csv" }));
      if (id !== checkId.current) return null; // a newer check was started
      setCheckCounts(res.counts ?? null);
      const checked = mapRecheck(current, res.rows);
      const byRow = new Map(checked.map((r) => [r.row, r]));
      const next = rowsRef.current.map((r) => {
        const before = sent.find((s) => s.row === r.row);
        if (!before) return r; // not in this check
        const c = byRow.get(r.row) ?? {
          // an all-empty row is skipped by the check
          row: r.row,
          status: "error",
          values: r.values,
          errors: [{ field: "phone", message: "Phone is required" }],
          duplicate: null,
          warnings: [],
        };
        const changedSince = r.rev !== before.rev;
        return {
          ...c,
          values: changedSince ? r.values : c.values,
          rev: r.rev,
          dirty: changedSince,
          fixable: r.fixable,
        };
      });
      setRows(next);
      return next;
    } catch (err) {
      if (id === checkId.current) setError(errorText(err));
      return null;
    } finally {
      if (id === checkId.current) setBusy("");
    }
  }

  function edit(row, key, value) {
    setRows((list) =>
      list.map((r) => (r.row === row ? { ...r, values: { ...r.values, [key]: value }, rev: r.rev + 1, dirty: true } : r)),
    );
  }

  function blur(row) {
    const r = rowsRef.current.find((x) => x.row === row);
    if (r?.dirty) recheck();
  }

  function remove(row) {
    const next = rowsRef.current.filter((r) => r.row !== row);
    setRows(next);
    // Removing a row can change "repeated in this file" for the others
    if (next.length) recheck(next);
  }

  async function submit() {
    let current = rowsRef.current;
    if (current.some((r) => r.dirty)) {
      current = await recheck(current);
      if (!current) return;
    }
    const ok = current.filter((r) => r.status === "ok");
    if (!ok.length) return;
    setBusy("import");
    setError("");
    try {
      const res = await api.importRows(ok.map((r) => ({ row: r.row, values: r.values })));
      const notSent = current.filter((r) => r.status !== "ok");
      setResult({ ...res, notSent });
      setStep("result");
      if (res.counts.imported) onImported();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy("");
    }
  }

  function reset() {
    setStep("choose");
    setFile(null);
    setSheets(null);
    setSheetText(false);
    setSheet("");
    setPreview(null);
    setCheckCounts(null);
    setRows([]);
    setResult(null);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  const visible = (onlyProblems ? rows.filter((r) => r.status !== "ok" || otherSources(r.warnings).length) : rows).slice(
    0,
    shown,
  );
  const totalVisible = onlyProblems ? rows.filter((r) => r.status !== "ok" || otherSources(r.warnings).length).length : rows.length;

  let footer = null;
  if (step === "choose") {
    footer = (
      <>
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Cancel
        </button>
        <button type="button" onClick={check} disabled={!file || !meta || busy === "preview"} className={primaryBtn}>
          {busy === "preview" ? "Checking…" : "Check file"}
        </button>
      </>
    );
  } else if (step === "preview") {
    const skipped = skippedText(counts);
    footer = (
      <>
        <button type="button" onClick={reset} className={secondaryBtn}>
          Choose another file
        </button>
        <div className="flex flex-col items-end">
          <button
            type="button"
            onClick={submit}
            disabled={!counts.ok || Boolean(busy)}
            className={primaryBtn}
          >
            {busy === "import" ? "Importing…" : submitLabel(counts.ok)}
          </button>
          {skipped && <p className="mt-1 text-[11px] text-gray-500">{skipped}</p>}
        </div>
      </>
    );
  } else if (step === "result") {
    footer = (
      <>
        <button type="button" onClick={reset} className={secondaryBtn}>
          Upload another file
        </button>
        <button type="button" onClick={onClose} className={primaryBtn}>
          Done
        </button>
      </>
    );
  }

  return (
    <Drawer kicker={SOURCE_NAMES[source] ?? (isKd ? "KOC → Dhruva" : source)} title="Bulk upload" onClose={onClose} wide={step !== "choose"} footer={footer}>
      <div className="space-y-5">
        {error && <Alert>{error}</Alert>}

        {step === "choose" && (
          <>
            <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">1. Download the template</h3>
              <p className="mt-1 text-xs text-gray-500">
                Fill in one lead per row. Phone is required. Delete the example row before uploading.
              </p>
              {isKd && <p className="mt-1 text-xs text-gray-500">{KOC_TO_DHRUVA_UPLOAD_HINT}</p>}
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
              <p className="mt-1 text-xs text-gray-500">Excel (.xlsx) or CSV, up to 5 MB. Nothing is saved until you submit.</p>
              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-600 hover:border-brand-600 hover:bg-brand-50/40">
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
              {isXlsx && sheetText && (
                <label className="mt-3 block">
                  <span className="text-xs font-medium text-gray-600">Sheet name</span>
                  <input
                    value={sheet}
                    maxLength={31}
                    onChange={(e) => setSheet(e.target.value)}
                    placeholder="Leads"
                    className={`mt-1.5 ${fieldCls}`}
                  />
                  <span className="mt-1 block text-[11px] text-gray-500">
                    Couldn't list the sheets in this file. Type the sheet name, or leave it empty for “Leads” (else the first sheet).
                  </span>
                </label>
              )}
            </section>
          </>
        )}

        {step === "preview" && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Valid", counts.ok, "bg-emerald-50 text-emerald-700 ring-emerald-100"],
                ["Needs fixing", counts.errors, "bg-red-50 text-red-700 ring-red-100"],
                ["Repeated in this file", counts.inFile, "bg-gray-50 text-gray-700 ring-gray-100"],
                ["Already exists", counts.existing, "bg-gray-50 text-gray-700 ring-gray-100"],
                ["Also in another source", counts.otherSource, "bg-amber-50 text-amber-800 ring-amber-100"],
              ].map(([label, n, cls]) => (
                <div key={label} className={`rounded-2xl px-4 py-3 ring-1 ${cls}`}>
                  <p className="text-2xl font-semibold">{n}</p>
                  <p className="text-xs">{label}</p>
                </div>
              ))}
            </div>

            {isKd && <SpinChips chips={spinCountChips(checkCounts)} />}

            {preview.readOnly.length > 0 && (
              <p className="text-xs text-gray-500">
                Read-only columns, ignored on upload: {preview.readOnly.join(", ")}
              </p>
            )}
            {preview.ignored.length > 0 && (
              <p className="text-xs text-gray-500">Columns not used: {preview.ignored.join(", ")}</p>
            )}
            {source === "spin" && columns.some((f) => f.type === "assigned") && (
              <p className="text-xs text-gray-500">{SPIN_ASSIGNED_HINT}</p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
                Only rows that need attention
              </label>
              <button
                type="button"
                onClick={() => recheck()}
                disabled={Boolean(busy)}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <RefreshCw size={14} className={busy === "recheck" ? "animate-spin" : ""} />
                {busy === "recheck" ? "Re-checking…" : "Re-check"}
              </button>
              {anyDirty && busy !== "recheck" && <span className="text-xs text-gray-500">Some edits aren't re-checked yet.</span>}
            </div>

            <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-gray-100">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50/80">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Row</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    {isKd && <th className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Spin</th>}
                    {isKd && <th className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">From workflow</th>}
                    {columns.map((f) => (
                      <th key={f.key} className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        {f.label}
                      </th>
                    ))}
                    <th className="w-10 px-3 py-2.5" aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.row} className="border-b border-gray-50 align-top">
                      <td className="px-3 py-2 text-gray-500">{r.row}</td>
                      <td className="px-3 py-2">
                        <RowBadges row={r} />
                      </td>
                      {isKd && (
                        <td className="px-3 py-2">
                          <SpinMatchCell row={r} />
                        </td>
                      )}
                      {isKd && (
                        <td className="px-3 py-2">
                          <FillCell row={r} fields={columns} branches={branches} />
                        </td>
                      )}
                      {columns.map((f) => (
                        <td key={f.key} className={`px-3 py-2 ${wrapsInPreview(f) ? "min-w-[12rem] max-w-[18rem] whitespace-normal break-words" : "whitespace-nowrap"}`}>
                          {r.fixable ? (
                            <CellInput
                              field={f}
                              value={r.values?.[f.key]}
                              errors={fieldErrors(r, f.key)}
                              branches={branches}
                              vendors={vendors}
                              onChange={(v) => edit(r.row, f.key, v)}
                              onBlur={() => blur(r.row)}
                            />
                          ) : (
                            (cellText(f, r.values?.[f.key], branches) ?? <span className="text-gray-300">—</span>)
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {(r.fixable) && (
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
                  ))}
                  {!visible.length && (
                    <tr>
                      <td colSpan={columns.length + (isKd ? 5 : 3)} className="px-3 py-6 text-center text-gray-500">
                        No rows to show.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalVisible > shown && (
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className={secondaryBtn}>
                Show {Math.min(PAGE, totalVisible - shown)} more of {totalVisible - shown}
              </button>
            )}
          </>
        )}

        {step === "result" && result && (
          <>
            <Alert kind={result.counts.imported ? "success" : "warning"}>
              <p className="font-semibold">
                {result.counts.imported === 1 ? "1 lead imported." : `${result.counts.imported} leads imported.`}
              </p>
              {result.counts.skipped + result.notSent.length > 0 && (
                <p className="mt-0.5">
                  {result.counts.skipped + result.notSent.length} skipped (listed below).
                </p>
              )}
            </Alert>
            {isKd && <SpinChips chips={spinCountChips(result.counts)} />}
            {isKd && result.rows.some((r) => r.status === "imported") && (
              <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-gray-100">
                <table className="w-full text-sm" aria-label="Imported rows">
                  <thead className="border-b border-gray-100 bg-gray-50/80">
                    <tr>
                      {["Row", "Phone", "Spin", "From workflow"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows
                      .filter((r) => r.status === "imported")
                      .sort((a, b) => a.row - b.row)
                      .map((r) => (
                        <tr key={r.row} className="border-b border-gray-50 align-top">
                          <td className="px-3 py-2 text-gray-500">{r.row}</td>
                          <td className="px-3 py-2">{r.values?.phone ?? "—"}</td>
                          <td className="px-3 py-2">
                            <SpinMatchCell row={r} />
                          </td>
                          <td className="px-3 py-2">
                            <FillCell row={r} fields={columns} branches={branches} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            {[...result.rows.filter((r) => r.status !== "imported"), ...result.notSent].length > 0 && (
              <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-gray-100">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50/80">
                    <tr>
                      {["Row", "Phone", "Why skipped"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.rows.filter((r) => r.status !== "imported"), ...result.notSent]
                      .sort((a, b) => a.row - b.row)
                      .map((r) => (
                        <tr key={r.row} className="border-b border-gray-50">
                          <td className="px-3 py-2 text-gray-500">{r.row}</td>
                          <td className="px-3 py-2">{r.values?.phone ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {r.status === "error"
                              ? `Needs fixing: ${(r.errors ?? []).map((e) => e.message).join("; ")}`
                              : r.message
                                ? r.message // the API's own text, as returned
                              : `${duplicateLabel(r.duplicate)}${r.duplicate?.reason !== "in_file" ? ` · ${duplicateWhere(r.duplicate)}` : ""}`}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!meta && !error && (
          <FormSkeleton fields={3} />
        )}
      </div>
    </Drawer>
  );
}
