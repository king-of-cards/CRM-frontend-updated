import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

// A dropdown with checkboxes. options: [{ value, label }]. The button shows the chosen
// labels (names, never ids), or `anyLabel` when nothing is chosen.
export default function MultiSelect({ label, options, value, onChange, anyLabel = "Any", className = "" }) {
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

  const chosen = options.filter((o) => value.includes(o.value));
  const text = chosen.length ? chosen.map((o) => o.name ?? o.label).join(", ") : anyLabel;
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        title={chosen.length ? text : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
      >
        <span className={`truncate ${chosen.length ? "" : "text-gray-500"}`}>{text}</span>
        <ChevronDown size={14} className="shrink-0 text-gray-400" />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 z-30 mt-1 max-h-64 w-full min-w-[200px] overflow-y-auto rounded-xl bg-white py-1 shadow-xl ring-1 ring-gray-100"
        >
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <li key={o.value} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300"}`}
                  >
                    {on && <Check size={12} />}
                  </span>
                  <span className="flex-1 truncate">{o.label}</span>
                </button>
              </li>
            );
          })}
          {!options.length && <li className="px-3 py-2 text-sm text-gray-400">No values</li>}
          {value.length > 0 && (
            <li className="border-t border-gray-100">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-50"
              >
                Clear selection
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
