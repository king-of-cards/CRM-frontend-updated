import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  downloadCrmLeadTemplate,
  getCrmLeadFields,
  importCrmLeads,
  previewCrmLeadImport,
} from "../../api/crmLeads.js";
import Drawer, { Alert, fieldCls, primaryBtn, secondaryBtn, Spinner } from "./Drawer.jsx";
import { defaultSheet, readSheetNames } from "./xlsxSheets.js";
import {
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

// Bulk upload: template → file (+ sheet) → preview (nothing saved) → fix/remove rows → import → result.
const MAX_BYTES = 5 * 1024 * 1024;
const PAGE = 100;

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
        <Badge tone="dup" title={duplicateWhere(row.duplicate)}>
          {duplicateLabel(row.duplicate)}
        </Badge>
      )}
      {also.length > 0 && <Badge tone="warn">Also in {sourceList(also)}</Badge>}
      {row.dirty && <span className="text-[10px] text-gray-500">Edited · not re-checked</span>}
    </div>
  );
}

function CellInput({ field, value, onChange, onBlur, errors, branches }) {
  const invalid = errors.length > 0;
  const cls = `${fieldCls} min-w-[140px] py-1.5 ${invalid ? "border-red-300" : ""}`;
  let input;
  if (field.type === "branch") {
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
  } else {
    input = (
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={field.label}
        aria-invalid={invalid}
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
  if (value === null || value === undefined || value === "") return null;
  if (field.type === "branch") return branches.find((b) => String(b.id) === String(value))?.name ?? String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default function BulkUploadDialog({ source, onClose, onImported }) {
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
  const [rows, setRows] = useState([]); // preview rows + { rev, dirty }
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const checkId = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Step 3: result
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCrmLeadFields(source)
      .then((m) => !cancelled && setMeta(m))
      .catch((err) => !cancelled && setError(errorText(err)));
    return () => {
      cancelled = true;
    };
  }, [source]);

  const branches = meta?.branches ?? [];
  const isXlsx = file && /\.xlsx$/i.test(file.name);

  async function template(format) {
    setBusy("template");
    setError("");
    try {
      await downloadCrmLeadTemplate(source, format);
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
      const res = await previewCrmLeadImport(source, file, isXlsx ? sheet.trim() : undefined);
      setPreview({ columns: res.columns, ignored: res.ignored_columns ?? [] });
      startRows(res.rows);
      setOnlyProblems(false);
      setStep("preview");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy("");
    }
  }

  // Columns: the ones matched in the file, plus any field with an error, in the fields' order
  const columns = useMemo(() => {
    if (!meta || !preview) return [];
    const keys = new Set(["phone", ...Object.values(preview.columns)]);
    for (const r of rows) for (const e of r.errors ?? []) keys.add(e.field);
    return meta.fields.filter((f) => keys.has(f.key));
  }, [meta, preview, rows]);

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
      const csv = rowsToCsv(meta.fields, current, branches);
      const res = await previewCrmLeadImport(source, new File([csv], "recheck.csv", { type: "text/csv" }));
      if (id !== checkId.current) return null; // a newer check was started
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
      const res = await importCrmLeads(
        source,
        ok.map((r) => ({ row: r.row, values: r.values })),
      );
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
    <Drawer kicker={SOURCE_NAMES[source]} title="Bulk upload" onClose={onClose} wide={step !== "choose"} footer={footer}>
      <div className="space-y-5">
        {error && <Alert>{error}</Alert>}

        {step === "choose" && (
          <>
            <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">1. Download the template</h3>
              <p className="mt-1 text-xs text-gray-500">
                Fill in one lead per row. Phone is required. Delete the example row before uploading.
              </p>
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

            {preview.ignored.length > 0 && (
              <p className="text-xs text-gray-500">Columns not used: {preview.ignored.join(", ")}</p>
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
                      {columns.map((f) => (
                        <td key={f.key} className="whitespace-nowrap px-3 py-2">
                          {r.fixable ? (
                            <CellInput
                              field={f}
                              value={r.values?.[f.key]}
                              errors={fieldErrors(r, f.key)}
                              branches={branches}
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
                      <td colSpan={columns.length + 3} className="px-3 py-6 text-center text-gray-500">
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
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
      </div>
    </Drawer>
  );
}
