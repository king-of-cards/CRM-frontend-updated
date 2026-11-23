import { ArrowRight } from "lucide-react";
import { DHRUVA_DIRECTIONS } from "../layout/leadFlow.js";

// The Dhruva flow's direction switch: Dhruva → KOC | KOC → Dhruva. Shown on the Dashboard and
// both Dhruva lists (Dhruva logins too); the direction lives in the URL (see leadFlow.js).
export default function DhruvaDirectionSwitch({ value, onChange }) {
  return (
    <div role="tablist" aria-label="Dhruva direction" className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-sm ring-1 ring-gray-200 [scrollbar-width:none]">
      {DHRUVA_DIRECTIONS.map((d) => {
        const active = value === d.value;
        const [from, to] = d.label.split(" → ");
        return (
          <button
            key={d.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => !active && onChange(d.value)}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium sm:min-h-0 sm:px-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
              active ? "bg-brand-800 text-white shadow" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {from}
            <ArrowRight size={13} aria-hidden="true" />
            {to}
          </button>
        );
      })}
    </div>
  );
}
