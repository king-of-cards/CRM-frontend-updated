import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import useHoverOpen from "../shared/useHoverOpen.js";

export default function FilterDropdown({ label, activeLabel, active = false, children, className = "" }) {
  const anchor = useRef(null);
  const panel = useRef(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  // Phones (below sm): the choices open as a bottom sheet instead of a small floating box
  const sheet = typeof window !== "undefined" && window.innerWidth < 640;
  // Hover devices: opens on hover, stays open while a field inside has focus (see hoverOpen.js)
  const hover = useHoverOpen({ open, setOpen, panelRef: panel });
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
    <button ref={anchor} type="button" aria-haspopup="dialog" aria-expanded={open} {...hover.anchorProps} onClick={() => hover.click(() => setOpen((value) => !value))} className={`inline-flex h-10 max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap sm:h-9 rounded-full border px-3 text-sm transition ${active || open ? "border-brand-300 bg-brand-50 text-brand-800" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"} ${className}`}>
      <span className="truncate">{active ? activeLabel || label : label}</span><ChevronDown size={14} className="shrink-0" />
    </button>
    {open && rect && createPortal(sheet ? (
      // Phones: a bottom sheet (easy to reach with a thumb) over a dimmed page; tap outside or Done to close
      <div className="fixed inset-0 z-[1000]">
        <div aria-hidden="true" className="absolute inset-0 bg-gray-900/30" />
        <div ref={panel} role="dialog" aria-label={`${label} filter`} className="absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col rounded-t-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-gray-200" />
            <p className="pt-1 text-base font-semibold text-gray-900">{label}</p>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white">Done</button>
          </div>
          <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{children}</div>
        </div>
      </div>
    ) : <div ref={panel} role="dialog" aria-label={`${label} filter`} {...hover.panelProps} style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }} className="z-[1000] max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl bg-white p-3 shadow-xl ring-1 ring-black/10">{children}</div>, document.body)}
  </>;
}
