import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";

// "Export ▾": one button that opens the formats (Excel, CSV). The same on every leads page
// (Spin, Vendors → KOC, Dhruva → KOC, KOC → Dhruva), so the buttons line up the same way.
const FORMATS = [
  ["xlsx", "Excel (.xlsx)"],
  ["csv", "CSV"],
];

export default function ExportMenu({ onExport, busy }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 sm:min-h-0"
      >
        <Download size={15} />
        {busy ? "Exporting…" : "Export"}
        <ChevronDown size={14} className="opacity-70" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1 ring-gray-100">
          {FORMATS.map(([f, label]) => (
            <button
              key={f}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExport(f);
              }}
              className="flex min-h-11 w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-brand-50 sm:min-h-0"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
