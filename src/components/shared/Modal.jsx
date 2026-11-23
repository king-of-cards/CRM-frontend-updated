import { useEffect } from "react";
import { X } from "lucide-react";

// A dialog: full-screen on phones, a centred card from 640 px. Escape and the backdrop close it.
export default function Modal({ title, onClose, children, footer, role = "dialog", size = "sm:max-w-md" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4" role={role} aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]" />
      <div className={`relative flex h-full w-full flex-col bg-white shadow-2xl ring-1 ring-gray-100 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl ${size}`}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 sm:px-6">
          <h2 className="min-w-0 truncate text-base font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-5 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

export const modalBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition disabled:opacity-60";
export const modalCancelBtn = `${modalBtn} text-gray-600 hover:bg-gray-100`;
export const modalPrimaryBtn = `${modalBtn} bg-brand-700 font-semibold text-white hover:bg-brand-800`;
export const modalDangerBtn = `${modalBtn} bg-red-600 font-semibold text-white hover:bg-red-700`;
