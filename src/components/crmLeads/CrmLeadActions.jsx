import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileUp, Plus, UserPlus, X } from "lucide-react";
import { archiveCrmLead, exportCrmLeads, unarchiveCrmLead } from "../../api/crmLeads.js";
import AddLeadDialog from "./AddLeadDialog.jsx";
import BulkUploadDialog from "./BulkUploadDialog.jsx";
import EditLeadDialog from "./EditLeadDialog.jsx";
import { onCrmLeadEvent } from "./crmLeadEvents.js";
import { errorText } from "./crmLeadUtils.js";
import { useAuth } from "../../auth/useAuth.js";

// "Add lead" and "Export" for a source's list header. Also opens the Edit drawer and runs
// Archive for the row badges (see crmLeadEvents.js), and shows their messages.
//   exportParams: the list's current params (object), or a function returning them
//   onChanged:    reload the list and its counts
function Menu({ label, icon: Icon, primary, items, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={
          primary
            ? "flex items-center gap-1.5 rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-700/25 transition hover:opacity-95 disabled:opacity-60"
            : "flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
        }
      >
        <Icon size={15} />
        {label}
        <ChevronDown size={14} className="opacity-70" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1 ring-gray-100">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-brand-50"
            >
              {it.icon && <it.icon size={15} className="text-gray-400" />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onClose, toast.undo ? 10000 : 6000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={`fixed bottom-6 right-6 z-[60] flex max-w-sm items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-xl ring-1 ${
        toast.kind === "error" ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"
      }`}
    >
      <span className="flex-1">{toast.text}</span>
      {toast.undo && (
        <button type="button" onClick={toast.undo} className="font-semibold underline">
          Undo
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  );
}

export default function CrmLeadActions({ source, exportParams, onChanged }) {
  const { isAdmin } = useAuth(); // vendor logins: Export only (their own leads)
  const [dialog, setDialog] = useState(null); // "single" | "bulk" | null
  const [editKey, setEditKey] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null); // { kind, text, undo? }
  const closeToast = useCallback(() => setToast(null), []);
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeEdit = useCallback(() => setEditKey(null), []);

  const archive = useCallback(
    async (leadKey) => {
      try {
        await archiveCrmLead(source, leadKey);
        onChanged?.();
        setToast({
          kind: "success",
          text: "Lead archived.",
          undo: async () => {
            setToast(null);
            try {
              await unarchiveCrmLead(source, leadKey);
              onChanged?.();
              setToast({ kind: "success", text: "Lead unarchived." });
            } catch (err) {
              setToast({ kind: "error", text: errorText(err) });
            }
          },
        });
      } catch (err) {
        setToast({ kind: "error", text: errorText(err) });
      }
    },
    [source, onChanged],
  );

  useEffect(
    () =>
      onCrmLeadEvent((e) => {
        if (e.source !== source) return;
        if (e.type === "edit") setEditKey(e.leadKey);
        else if (e.type === "archive") archive(e.leadKey);
      }),
    [source, archive],
  );

  async function runExport(format) {
    setExporting(true);
    try {
      const params = typeof exportParams === "function" ? exportParams() : exportParams;
      const name = await exportCrmLeads(source, format, params ?? {});
      setToast({ kind: "success", text: `Downloaded ${name}.` });
    } catch (err) {
      setToast({ kind: "error", text: errorText(err) });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Adding leads: admins only. Spin leads can only be added by bulk upload. */}
      {isAdmin && source === "spin" && (
        <button
          type="button"
          onClick={() => setDialog("bulk")}
          className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-700/25 transition hover:opacity-95"
        >
          <FileUp size={15} />
          Bulk upload
        </button>
      )}
      {isAdmin && source !== "spin" && (
        <Menu
          label="Add lead"
          icon={Plus}
          primary
          items={[
            { label: "Single lead", icon: UserPlus, onClick: () => setDialog("single") },
            { label: "Bulk upload", icon: FileUp, onClick: () => setDialog("bulk") },
          ]}
        />
      )}
      <Menu
        label={exporting ? "Exporting…" : "Export"}
        icon={Download}
        disabled={exporting}
        items={[
          { label: "Excel (.xlsx)", onClick: () => runExport("xlsx") },
          { label: "CSV", onClick: () => runExport("csv") },
        ]}
      />

      {dialog === "single" && (
        <AddLeadDialog
          source={source}
          onClose={closeDialog}
          onAdded={(text) => {
            setDialog(null);
            onChanged?.();
            setToast({ kind: "success", text });
          }}
          onOpenLead={(key) => {
            setDialog(null);
            setEditKey(key);
          }}
        />
      )}
      {dialog === "bulk" && <BulkUploadDialog source={source} onClose={closeDialog} onImported={() => onChanged?.()} />}
      {editKey && (
        <EditLeadDialog
          source={source}
          leadKey={editKey}
          onClose={closeEdit}
          onChanged={(text, opts) => {
            if (!opts?.keepOpen) setEditKey(null);
            onChanged?.();
            setToast({ kind: "success", text });
          }}
        />
      )}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
