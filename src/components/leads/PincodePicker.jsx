import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, X } from "lucide-react";
import { pincodeArea } from "./pincode.js";

// Pincode filter: type digits or open the list. Shows the pincodes your leads use, with
// their area and number of leads. Typing "560" + Enter filters every pincode starting with 560.
export default function PincodePicker({
  value,
  onChange,
  options = [],
  className = "",
}) {
  const [text, setText] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef(null);

  useEffect(() => setText(value ?? ""), [value]);

  // Close when clicking elsewhere
  useEffect(() => {
    if (!open) return;
    const onDown = (e) =>
      box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const list = useMemo(() => {
    const t = text.replace(/\D/g, "");
    return options.filter((o) => !t || o.value.startsWith(t)).slice(0, 60);
  }, [text, options]);

  useEffect(() => setActive(0), [text]);

  const pick = (v) => {
    setText(v);
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <div className="relative">
        <MapPin
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          inputMode="numeric"
          role="combobox"
          aria-expanded={open}
          aria-label="Pincode"
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value.replace(/\D/g, "").slice(0, 6));
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, list.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              // A highlighted pincode, or what was typed (a prefix like 560)
              pick(
                open &&
                  list[active] &&
                  text.length < 6 &&
                  list[active].value.startsWith(text) &&
                  text !== ""
                  ? list[active].value
                  : text,
              );
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          onBlur={() => {
            if (text !== (value ?? "") && text.length >= 3) onChange(text); // typed prefix applies on leaving
          }}
          placeholder="Any pincode"
          className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-14 text-sm text-gray-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {text && (
            <button
              type="button"
              aria-label="Clear pincode"
              onClick={() => pick("")}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            aria-label="Show pincodes"
            onClick={() => setOpen((o) => !o)}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <ChevronDown size={14} />
          </button>
        </span>
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-72 w-full min-w-[240px] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-gray-100"
        >
          {text && text.length < 6 && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(text)}
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-brand-700 hover:bg-brand-50"
              >
                All pincodes starting with{" "}
                <span className="font-semibold">{text}</span>
              </button>
            </li>
          )}
          {list.map((o, i) => {
            const area = pincodeArea(o.value);
            return (
              <li key={o.value} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                    i === active
                      ? "bg-brand-50 text-brand-900"
                      : "text-gray-700"
                  } ${o.value === value ? "font-semibold" : ""}`}
                >
                  <span>
                    <span className="tabular-nums">{o.value}</span>
                    {area && (
                      <span className="ml-2 text-xs text-gray-500">{area}</span>
                    )}
                  </span>
                  <span className="text-xs tabular-nums text-gray-400">
                    {o.count}
                  </span>
                </button>
              </li>
            );
          })}
          {!list.length && (
            <li className="px-3 py-3 text-sm text-gray-500">
              No leads with that pincode.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
