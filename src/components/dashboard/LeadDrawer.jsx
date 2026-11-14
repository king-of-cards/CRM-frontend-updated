import { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Eye,
  FileText,
  History,
  IndianRupee,
  ListChecks,
  LoaderCircle,
  Mail,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  UserPen,
  UserPlus,
  X,
} from "lucide-react";
import LeadAvatar from "./LeadAvatar.jsx";
import { DIRECTIONS, SERVICES, SOURCES, STATUSES, VENDORS } from "../../data/leads.js";
import { STATUS_STYLES } from "../../data/statusStyles.js";
import { formatDate, formatDateTime, formatDay, formatINR, formatTime, timeAgo } from "../../utils/format.js";

const vendorById = Object.fromEntries(VENDORS.map((v) => [v.id, v]));
const serviceById = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
const sourceById = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
const directionById = Object.fromEntries(DIRECTIONS.map((d) => [d.id, d]));
const statusById = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

// Statuses that move to "Quotation sent" automatically when the first quotation is added.
const BEFORE_QUOTATION = new Set(["new", "contacted", "qualified"]);

const EVENT_STYLES = {
  added: { icon: UserPlus, tint: "bg-sky-100 text-sky-700" },
  status: { icon: ArrowRightLeft, tint: "bg-amber-100 text-amber-700" },
  quotation: { icon: IndianRupee, tint: "bg-violet-100 text-violet-700" },
  note: { icon: StickyNote, tint: "bg-emerald-100 text-emerald-700" },
  details: { icon: UserPen, tint: "bg-gray-100 text-gray-700" },
};

const TIMELINE_PREVIEW = 6;

const TIMELINE_KINDS = [
  { id: "all", label: "All", types: [] },
  { id: "status", label: "Status", types: ["status", "added"] },
  { id: "quotation", label: "Quotations", types: ["quotation"] },
  { id: "note", label: "Notes", types: ["note"] },
  { id: "details", label: "Details", types: ["details"] },
];

const inputClass =
  "w-full rounded-xl bg-white px-4 py-2.5 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 hover:ring-gray-300 focus:ring-2 focus:ring-brand-600 focus:outline-none";
const primaryButton =
  "rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500";
const secondaryButton =
  "rounded-xl px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50";
const iconButton =
  "rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-brand-600";




function statusLabel(id) {
  return statusById[id]?.label ?? id;
}

// Older leads only have a single quotation amount; turn it into a list.
// "2026-11-11T11:25:16.032735" -> "11 Nov, 11:25 am"; "2027-02-08" -> "8 Feb 2027"
function readable(value) {
  if (typeof value !== "string") return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(new Date(`${value}T00:00:00`));
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return formatDateTime(d);
  }
  return value;
}

function quotationsOf(lead) {
  if (lead.quotations) return lead.quotations;
  return lead.quotation != null ? [{ id: `${lead.id}-q0`, amount: lead.quotation, when: lead.added ?? "Earlier" }] : [];
}

function notesOf(lead) {
  return lead.notes ?? [];
}

// ── Small building blocks ───────────────────────────────────────────────
const sectionCard = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100";

function SectionHeader({ title, count, action, icon: Icon, tint }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2.5 text-base font-semibold text-gray-900">
        {Icon && (
          <span className={`flex size-8 items-center justify-center rounded-lg ${tint}`}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
        {title}
        {count > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{count}</span>
        )}
      </h3>
      {action}
    </div>
  );
}

function AddButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
    >
      <Plus className="size-4" aria-hidden="true" />
      {children}
    </button>
  );
}

// Quotation files: same rules as the backend (PDF, images, Word, Excel; up to 10 MB)
const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx";
const FILE_MAX_BYTES = 10 * 1024 * 1024;

function fileProblem(file) {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!FILE_ACCEPT.split(",").includes(ext)) return "Choose a PDF, image (PNG, JPG, WEBP), Word or Excel file.";
  if (file.size > FILE_MAX_BYTES) return "The file is larger than 10 MB.";
  if (file.size === 0) return "The file is empty.";
  return null;
}

function fileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// A button that opens the file picker
function FileButton({ label, onFile, disabled, className = "" }) {
  const inputRef = useRef(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow picking the same file again
          if (file) onFile(file);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <Paperclip className="size-4" aria-hidden="true" />
        {label}
      </button>
    </>
  );
}

function AmountForm({ initial, submitLabel, onSave, onCancel, allowFile = false, busy = false }) {
  const [digits, setDigits] = useState(initial != null ? String(initial) : "");
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const value = digits ? Number(digits) : 0;
  const valid = value > 0 && value !== initial && !busy;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(value, file);
      }}
      className="flex flex-wrap gap-2"
    >
      <div className="relative min-w-40 flex-1">
        <label className="sr-only" htmlFor="amount-input">
          Quotation amount in rupees
        </label>
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-gray-500">₹</span>
        <input
          id="amount-input"
          autoFocus
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={digits ? Number(digits).toLocaleString("en-IN") : ""}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation(); // close this form, not the whole panel
              onCancel();
            }
          }}
          placeholder="Enter amount"
          className={`${inputClass} pl-8 font-medium tabular-nums`}
        />
      </div>
      <button type="submit" disabled={!valid} className={primaryButton}>
        {busy ? "Saving…" : submitLabel}
      </button>
      <button type="button" onClick={onCancel} className={secondaryButton}>
        Cancel
      </button>
      {allowFile && (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-2">
          {file ? (
            <>
              <FileText className="size-4 shrink-0 text-violet-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                {file.name} <span className="text-gray-400">({fileSize(file.size)})</span>
              </span>
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label="Remove chosen file"
                className={iconButton}
              >
                <X className="size-4" />
              </button>
            </>
          ) : (
            <>
              <FileButton
                label="Attach quotation file"
                onFile={(f) => {
                  const problem = fileProblem(f);
                  setFileError(problem);
                  if (!problem) setFile(f);
                }}
              />
              <span className="text-xs text-gray-400">PDF, image, Word or Excel, up to 10 MB (optional)</span>
            </>
          )}
          {fileError && <p className="w-full text-xs text-rose-600">{fileError}</p>}
        </div>
      )}
    </form>
  );
}

function NoteForm({ initial = "", submitLabel, onSave, onCancel, busy = false }) {
  const [text, setText] = useState(initial);
  const valid = text.trim() !== "" && text.trim() !== initial.trim() && !busy;

  function submit() {
    if (valid) onSave(text.trim());
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="sr-only" htmlFor="note-input">
        Note
      </label>
      <textarea
        id="note-input"
        autoFocus
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder="Write a note about this lead…"
        className={`${inputClass} resize-none`}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-gray-400">Ctrl + Enter to save</span>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={!valid} className={primaryButton}>
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function JumpTile({ label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl bg-white/10 px-4 py-3 text-left ring-1 ring-white/15 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
    >
      <span className="flex items-center justify-between text-xs text-white/65">
        {label}
        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
      <span className="mt-1 block truncate text-sm font-semibold tabular-nums">{value}</span>
    </button>
  );
}

function LoadState({ error, onRetry, what }) {
  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Couldn’t load saved {what}.{" "}
        <button type="button" onClick={onRetry} className="font-medium underline hover:no-underline">
          Try again
        </button>
      </div>
    );
  }
  return (
    <p className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      Loading {what}…
    </p>
  );
}

function DetailTile({ label, children }) {
  return (
    <div className="min-w-0 rounded-xl bg-gray-50 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="mt-1 truncate text-sm font-medium text-gray-900">{children}</div>
    </div>
  );
}

const DETAIL_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "company", label: "Company" },
  { key: "phone", label: "Number", type: "tel" },
  { key: "email", label: "Mail ID", type: "email" },
  { key: "service", label: "Looking for" },
  { key: "source", label: "Source" },
  { key: "vendor", label: "Vendor" },
];

function displayValue(lead, key) {
  if (key === "service") return serviceById[lead.service]?.label ?? lead.service;
  if (key === "source") return sourceById[lead.source]?.label ?? lead.source;
  if (key === "vendor") return vendorById[lead.vendorId]?.name ?? lead.vendor;
  return lead[key];
}

function DetailsForm({ lead, onSave, onCancel }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(DETAIL_FIELDS.map((f) => [f.key, displayValue(lead, f.key) ?? ""])),
  );
  const nameMissing = !values.name.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!nameMissing) onSave(values);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {DETAIL_FIELDS.map((f) => (
          <div key={f.key} className={f.key === "name" ? "col-span-2" : ""}>
            <label htmlFor={`detail-${f.key}`} className="mb-1 block text-xs text-gray-500">
              {f.label}
            </label>
            <input
              id={`detail-${f.key}`}
              type={f.type ?? "text"}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={inputClass}
            />
          </div>
        ))}
      </div>
      {nameMissing && <p className="mt-2 text-xs text-rose-600">Enter a name for this lead.</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Cancel
        </button>
        <button type="submit" disabled={nameMissing} className={primaryButton}>
          Save details
        </button>
      </div>
    </form>
  );
}

// ── Panel content ───────────────────────────────────────────────────────
// Keyed by lead id, so open forms reset whenever a different lead is opened.
function DrawerBody({ lead, actions, loadError, onRetry, onPreview, onClose, closeRef }) {
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const loading = !lead.activityLoaded && !loadError;
  const [editingDetails, setEditingDetails] = useState(false);
  const [quotationForm, setQuotationForm] = useState(null); // null | "new" | quotation id
  const [noteForm, setNoteForm] = useState(null); // null | "new" | note id
  const [showAll, setShowAll] = useState(false);
  const [timelineKind, setTimelineKind] = useState("all");
  const [flash, setFlash] = useState(null);
  const sectionRefs = { quotations: useRef(null), notes: useRef(null) };
  const [timelineOpen, setTimelineOpen] = useState(false);
  const timelineCloseRef = useRef(null);

  useEffect(() => {
    if (!timelineOpen) return;
    timelineCloseRef.current?.focus();
    // Capture phase: Esc closes the timeline only, not the whole lead panel
    function handleKey(e) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setTimelineOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [timelineOpen]);

  function jumpTo(id) {
    if (id === "timeline") {
      setTimelineOpen(true);
      return;
    }
    sectionRefs[id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlash(id);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 1200);
  }

  const cardFor = (id) =>
    `${sectionCard} scroll-mt-5 transition-shadow duration-500 ${flash === id ? "ring-2 ring-brand-500" : ""}`;

  const direction = directionById[lead.direction];
  const quotations = quotationsOf(lead);
  const notes = notesOf(lead);

  // Every change is saved to the backend; the panel then shows the saved result.
  async function run(task, after) {
    if (!actions) return;
    setBusy(true);
    setSaveError(null);
    try {
      await task();
      after?.();
    } catch (err) {
      setSaveError(err?.message || "Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Status
  function changeStatus(next) {
    if (next !== lead.status) run(() => actions.setStatus(next));
  }

  // ── Details: send only what changed ("" goes back to the original value)
  function saveDetails(values) {
    const changes = {};
    for (const f of DETAIL_FIELDS) {
      if ((displayValue(lead, f.key) ?? "") !== values[f.key]) changes[f.key] = values[f.key].trim();
    }
    if (Object.keys(changes).length === 0) {
      setEditingDetails(false);
      return;
    }
    run(
      () => actions.saveDetails(changes),
      () => setEditingDetails(false),
    );
  }

  // ── Quotations
  function addQuotation(amount, file) {
    run(
      () => actions.addQuotation(amount, file),
      () => setQuotationForm(null),
    );
  }

  function editQuotation(id, amount) {
    run(
      () => actions.editQuotation(id, amount),
      () => setQuotationForm(null),
    );
  }

  function deleteQuotation(q) {
    const extra = q.document ? " Its file will be deleted too." : "";
    if (window.confirm(`Delete the ${formatINR(q.amount)} quotation?${extra}`))
      run(() => actions.deleteQuotation(q.id));
  }

  function attachFile(q, file) {
    const problem = fileProblem(file);
    if (problem) {
      setSaveError(problem);
      return;
    }
    run(() => actions.uploadDocument(q.id, file));
  }

  function removeFile(q) {
    if (window.confirm(`Remove ${q.document.file_name} from this quotation?`)) run(() => actions.removeDocument(q.id));
  }

  // ── Notes
  function addNote(text) {
    run(
      () => actions.addNote(text),
      () => setNoteForm(null),
    );
  }

  function editNote(id, text) {
    run(
      () => actions.editNote(id, text),
      () => setNoteForm(null),
    );
  }

  function deleteNote(note) {
    if (window.confirm("Delete this note?")) run(() => actions.deleteNote(note.id));
  }

  // Newest first, optionally one kind only; the latest few unless "Show more" is pressed.
  const allEvents = [...lead.timeline].reverse();
  const kinds = TIMELINE_KINDS.filter((k) => k.id === "all" || allEvents.some((e) => k.types.includes(e.type)));
  const events =
    timelineKind === "all"
      ? allEvents
      : allEvents.filter((e) => TIMELINE_KINDS.find((k) => k.id === timelineKind).types.includes(e.type));
  const shownEvents = showAll ? events : events.slice(0, TIMELINE_PREVIEW);
  const hiddenCount = events.length - TIMELINE_PREVIEW;

  // Group shown events under "Today", "Yesterday", "10 Nov 2026"
  const groups = [];
  for (const event of shownEvents) {
    const day = event.at ? formatDay(new Date(event.at)) : "Earlier";
    if (groups.at(-1)?.day !== day) groups.push({ day, events: [] });
    groups.at(-1).events.push(event);
  }
  const latestQuotationId = quotations.at(-1)?.id;

  return (
    <>
      {/* Header */}
      <div className="relative bg-linear-to-br from-brand-600 via-brand-700 to-emerald-950 px-6 pt-6 pb-5 text-white">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close lead details"
          className="absolute top-4 right-4 rounded-lg p-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="size-5" />
        </button>

        <div className="flex flex-col gap-5 pr-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="rounded-full ring-4 ring-white/20">
              <LeadAvatar lead={lead} size="lg" />
            </span>
            <div className="min-w-0">
              <h2 id="lead-drawer-title" className="truncate text-2xl font-semibold">
                {lead.name}
              </h2>
              <p className="truncate text-sm text-white/70">
                {[lead.company, lead.added && `Added ${lead.added}`].filter(Boolean).join(", ")}
              </p>
            </div>
          </div>

          {(lead.phone || lead.email) && (
            <div className="grid shrink-0 grid-cols-2 gap-3 lg:w-72">
              {lead.phone && (
                <a
                  href={`tel:${lead.phone.replace(/\s/g, "")}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-50"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  Call
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/20"
                >
                  <Mail className="size-4" aria-hidden="true" />
                  Email
                </a>
              )}
            </div>
          )}
        </div>

        {/* At a glance: tap a tile to jump to that section */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
            <p className="text-xs text-white/65">Status</p>
            <p className="mt-1 flex items-center gap-2 truncate text-sm font-semibold">
              <span
                className={`size-2 shrink-0 rounded-full ${(STATUS_STYLES[lead.status] ?? STATUS_STYLES.new).dot}`}
                aria-hidden="true"
              />
              {statusLabel(lead.status)}
            </p>
          </div>
          <JumpTile
            label="Latest quotation"
            value={lead.quotation != null ? formatINR(lead.quotation) : "Not sent"}
            onClick={() => jumpTo("quotations")}
          />
          <JumpTile label="Notes" value={lead.notesCount ?? notes.length} onClick={() => jumpTo("notes")} />
          <JumpTile
            label="Timeline"
            value={`${lead.timeline.length} ${lead.timeline.length === 1 ? "event" : "events"}`}
            onClick={() => jumpTo("timeline")}
          />
        </div>
      </div>

      {/* One scroll area: Details | More details, then Quotations | Notes */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-5 py-5">
        {(busy || saveError) && (
          <div
            role={saveError ? "alert" : "status"}
            className={`sticky top-0 z-10 mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm shadow-sm ring-1 ${
              saveError ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-white text-gray-700 ring-gray-200"
            }`}
          >
            {saveError ? (
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            )}
            <span className="flex-1">{saveError ?? "Saving…"}</span>
            {saveError && (
              <button type="button" onClick={() => setSaveError(null)} aria-label="Dismiss" className={iconButton}>
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {/* Details */}
          <section className={sectionCard}>
            <SectionHeader
              title="Details"
              icon={ClipboardList}
              tint="bg-sky-100 text-sky-700"
              action={
                !editingDetails && (
                  <button
                    type="button"
                    onClick={() => setEditingDetails(true)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit details
                  </button>
                )
              }
            />
            <div className="mb-3 flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3">
              <label htmlFor="lead-status" className="text-sm font-medium text-gray-700">
                Status
              </label>
              <div className="relative">
                <span
                  className={`pointer-events-none absolute top-1/2 left-3.5 size-2 -translate-y-1/2 rounded-full ${
                    (STATUS_STYLES[lead.status] ?? STATUS_STYLES.new).dot
                  }`}
                  aria-hidden="true"
                />
                <select
                  id="lead-status"
                  value={lead.status}
                  onChange={(e) => changeStatus(e.target.value)}
                  disabled={busy || loading}
                  className="cursor-pointer appearance-none rounded-lg bg-white py-2 pr-9 pl-8 text-sm font-medium text-gray-900 ring-1 ring-gray-200 hover:ring-gray-300 focus:ring-2 focus:ring-brand-600 focus:outline-none"
                >
                  {STATUSES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
              </div>
            </div>
            {editingDetails ? (
              <DetailsForm lead={lead} onSave={saveDetails} onCancel={() => setEditingDetails(false)} />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <DetailTile label="Number">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="hover:text-brand-700">
                      {lead.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailTile>
                <DetailTile label="Mail ID">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} title={lead.email} className="hover:text-brand-700">
                      {lead.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailTile>
                <DetailTile label="Looking for">
                  <span title={displayValue(lead, "service") ?? undefined}>{displayValue(lead, "service") ?? "—"}</span>
                </DetailTile>
                <DetailTile label="Source">{displayValue(lead, "source") ?? "—"}</DetailTile>
                <DetailTile label="Vendor">{displayValue(lead, "vendor") ?? "—"}</DetailTile>
                {direction && <DetailTile label="Direction">{`${direction.from} → ${direction.to}`}</DetailTile>}
              </div>
            )}
          </section>

          {/* Every other column from the database */}
          {lead.extra?.length > 0 && (
            <section className={sectionCard}>
              <SectionHeader
                title="More details"
                count={lead.extra.length}
                icon={ListChecks}
                tint="bg-gray-100 text-gray-700"
              />
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {lead.extra.map((item) => (
                  <div key={item.label} className="min-w-0 rounded-xl bg-gray-50 px-4 py-3">
                    <dt className="text-xs text-gray-500">{item.label}</dt>
                    <dd className="mt-1 text-sm font-medium break-words whitespace-pre-wrap text-gray-900">
                      {readable(item.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {/* Quotations */}
          <section ref={sectionRefs.quotations} className={cardFor("quotations")}>
            <SectionHeader
              title="Quotations"
              icon={IndianRupee}
              tint="bg-violet-100 text-violet-700"
              count={loading ? 0 : quotations.length}
              action={
                !loading &&
                !loadError &&
                quotationForm !== "new" && <AddButton onClick={() => setQuotationForm("new")}>Add quotation</AddButton>
              }
            />
            {loading || loadError ? (
              <LoadState error={loadError} onRetry={onRetry} what="quotations" />
            ) : (
              <>
                {quotationForm === "new" && (
                  <div className="mb-3">
                    <AmountForm
                      submitLabel="Add"
                      allowFile
                      busy={busy}
                      onSave={addQuotation}
                      onCancel={() => setQuotationForm(null)}
                    />
                    {BEFORE_QUOTATION.has(lead.status) && (
                      <p className="mt-2 text-xs text-gray-500">Adding a quotation moves the lead to Quotation sent.</p>
                    )}
                  </div>
                )}
                {quotations.length === 0 && quotationForm !== "new" ? (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">No quotation sent yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {[...quotations].reverse().map((q) =>
                      quotationForm === q.id ? (
                        <li key={q.id}>
                          <AmountForm
                            initial={q.amount}
                            submitLabel="Save"
                            busy={busy}
                            onSave={(amount) => editQuotation(q.id, amount)}
                            onCancel={() => setQuotationForm(null)}
                          />
                        </li>
                      ) : (
                        <li
                          key={q.id}
                          className={`rounded-xl px-4 py-3 ring-1 ${
                            q.id === latestQuotationId ? "bg-violet-50/60 ring-violet-200" : "bg-white ring-gray-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-base font-semibold text-gray-900 tabular-nums">
                                {formatINR(q.amount)}
                                {q.id === latestQuotationId && quotations.length > 1 && (
                                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                                    Latest
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-500">
                                Sent {q.when}
                                {q.by && ` by ${q.by}`}
                                {q.edited && `, edited ${q.edited}`}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => setQuotationForm(q.id)}
                                aria-label={`Edit ${formatINR(q.amount)} quotation`}
                                className={iconButton}
                              >
                                <Pencil className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteQuotation(q)}
                                aria-label={`Delete ${formatINR(q.amount)} quotation`}
                                className={`${iconButton} hover:bg-rose-50 hover:text-rose-600`}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>

                          {/* The quotation file */}
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            {q.document ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onPreview(q)}
                                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-white px-3 py-2 text-left ring-1 ring-gray-200 transition-colors hover:bg-violet-50 hover:ring-violet-200"
                                >
                                  <FileText className="size-4 shrink-0 text-violet-600" aria-hidden="true" />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-gray-900">
                                      {q.document.file_name}
                                    </span>
                                    <span className="block text-xs text-gray-500">{fileSize(q.document.size)}</span>
                                  </span>
                                  <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-violet-700">
                                    <Eye className="size-4" aria-hidden="true" />
                                    Preview
                                  </span>
                                </button>
                                <FileButton label="Replace" disabled={busy} onFile={(file) => attachFile(q, file)} />
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => removeFile(q)}
                                  aria-label={`Remove ${q.document.file_name}`}
                                  className={`${iconButton} hover:bg-rose-50 hover:text-rose-600`}
                                >
                                  <X className="size-4" />
                                </button>
                              </div>
                            ) : (
                              <FileButton
                                label="Attach quotation file"
                                disabled={busy}
                                onFile={(file) => attachFile(q, file)}
                                className="-ml-2.5"
                              />
                            )}
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </>
            )}
          </section>

          {/* Notes */}
          <section ref={sectionRefs.notes} className={cardFor("notes")}>
            <SectionHeader
              title="Notes"
              icon={StickyNote}
              tint="bg-amber-100 text-amber-700"
              count={loading ? (lead.notesCount ?? 0) : notes.length}
              action={
                !loading &&
                !loadError &&
                noteForm !== "new" && <AddButton onClick={() => setNoteForm("new")}>Add note</AddButton>
              }
            />
            {loading || loadError ? (
              <LoadState error={loadError} onRetry={onRetry} what="notes" />
            ) : (
              <>
                {noteForm === "new" && (
                  <div className="mb-3">
                    <NoteForm submitLabel="Add note" busy={busy} onSave={addNote} onCancel={() => setNoteForm(null)} />
                  </div>
                )}
                {notes.length === 0 && noteForm !== "new" ? (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">No notes yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {[...notes].reverse().map((n) =>
                      noteForm === n.id ? (
                        <li key={n.id}>
                          <NoteForm
                            initial={n.text}
                            submitLabel="Save"
                            busy={busy}
                            onSave={(text) => editNote(n.id, text)}
                            onCancel={() => setNoteForm(null)}
                          />
                        </li>
                      ) : (
                        <li key={n.id} className="rounded-xl bg-amber-50/60 px-4 py-3 ring-1 ring-amber-100">
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 text-sm break-words whitespace-pre-wrap text-gray-800">{n.text}</p>
                            <div className="-mt-1 -mr-2 flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => setNoteForm(n.id)}
                                aria-label="Edit note"
                                className={iconButton}
                              >
                                <Pencil className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteNote(n)}
                                aria-label="Delete note"
                                className={`${iconButton} hover:bg-rose-50 hover:text-rose-600`}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                          <p className="mt-1.5 text-xs text-gray-500">
                            {n.when}
                            {n.by && ` by ${n.by}`}
                            {n.edited && `, edited ${n.edited}`}
                          </p>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Timeline: its own panel, opened from the Timeline tile at the top */}
      <div className={`absolute inset-0 z-20 ${timelineOpen ? "" : "pointer-events-none"}`} inert={!timelineOpen}>
        <div
          className={`absolute inset-0 bg-gray-900/25 transition-opacity duration-300 ${
            timelineOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setTimelineOpen(false)}
          aria-hidden="true"
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="timeline-title"
          className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
            timelineOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <History className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 id="timeline-title" className="text-base font-semibold text-gray-900">
                Timeline
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {allEvents.length}
                </span>
              </h3>
              <p className="truncate text-sm text-gray-500">{lead.name}</p>
            </div>
            <button
              ref={timelineCloseRef}
              type="button"
              onClick={() => setTimelineOpen(false)}
              aria-label="Close timeline"
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50 px-5 py-5">
            {kinds.length > 2 && (
              <div role="group" aria-label="Show in timeline" className="mb-4 flex flex-wrap gap-1.5">
                {kinds.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={timelineKind === k.id}
                    onClick={() => {
                      setTimelineKind(k.id);
                      setShowAll(false);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      timelineKind === k.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-5">
              {groups.map((group) => (
                <div key={group.day}>
                  <p className="mb-3 text-xs font-semibold text-gray-500">{group.day}</p>
                  <ol>
                    {group.events.map((event, i) => {
                      const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.status;
                      const Icon = style.icon;
                      const last = i === group.events.length - 1;
                      const at = event.at ? new Date(event.at) : null;
                      const deleted = event.label === "Note deleted";
                      return (
                        <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                          {!last && (
                            <span
                              className="absolute top-10 bottom-0 left-[1.1rem] w-px bg-gray-200"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`relative flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${style.tint}`}
                          >
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 ring-1 ring-gray-100">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="text-sm font-medium text-gray-900">
                                {event.type === "note" ? (event.label ?? "Note added") : event.text}
                              </p>
                              <time
                                dateTime={event.at}
                                title={at ? formatDateTime(at) : event.when}
                                className="shrink-0 text-xs text-gray-400"
                              >
                                {at ? formatTime(at) : event.when}
                              </time>
                            </div>
                            {event.type === "note" && (
                              <p
                                className={`mt-2 rounded-lg bg-amber-50/70 px-3 py-2 text-sm break-words whitespace-pre-wrap ${
                                  deleted ? "text-gray-400 line-through" : "text-gray-700"
                                }`}
                              >
                                {event.text}
                              </p>
                            )}
                            {at && (
                              <p className="mt-1 text-xs text-gray-400">
                                {timeAgo(at)}
                                {event.by && ` by ${event.by}`}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>

            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-sm font-medium text-brand-700 ring-1 ring-gray-200 transition-colors hover:bg-brand-50"
              >
                {showAll ? "Show less" : `Show ${hiddenCount} more`}
                <ChevronDown
                  className={`size-4 transition-transform ${showAll ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

// Slides in from the right when a lead row is clicked.
export default function LeadDrawer({ lead, open, onClose, actions, loadError, onRetry, onPreview }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // stop the page scrolling behind the panel
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div
        className={`absolute inset-0 bg-gray-900/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-drawer-title"
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl sm:max-w-xl lg:max-w-6xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {lead && (
          <DrawerBody
            key={lead.id}
            lead={lead}
            actions={actions}
            loadError={loadError}
            onRetry={onRetry}
            onPreview={onPreview}
            onClose={onClose}
            closeRef={closeRef}
          />
        )}
      </aside>
    </div>
  );
}