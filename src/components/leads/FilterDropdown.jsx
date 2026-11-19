import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export default function FilterDropdown({ label, activeLabel, active = false, children, className = "" }) {
  const anchor = useRef(null);
  const panel = useRef(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const box = anchor.current?.getBoundingClientRect();
      if (box) setRect({ top: Math.max(8, Math.min(box.bottom + 6, window.innerHeight - 300)), left: Math.max(8, Math.min(box.left, window.innerWidth - Math.min(320, window.innerWidth - 16) - 8)), width: Math.min(320, window.innerWidth - 16) });
    };
    const outside = (event) => {
      if (!anchor.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false);
    };
    const key = (event) => event.key === "Escape" && setOpen(false);
    place();
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return <>
    <button ref={anchor} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={`inline-flex h-9 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm transition ${active || open ? "border-brand-300 bg-brand-50 text-brand-800" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"} ${className}`}>
      <span className="truncate">{active ? activeLabel || label : label}</span><ChevronDown size={14} className="shrink-0" />
    </button>
    {open && rect && createPortal(<div ref={panel} role="dialog" aria-label={`${label} filter`} style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }} className="z-[1000] max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl bg-white p-3 shadow-xl ring-1 ring-black/10">{children}</div>, document.body)}
  </>;
}
