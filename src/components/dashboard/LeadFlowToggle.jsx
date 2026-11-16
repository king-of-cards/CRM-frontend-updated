import { ArrowLeftRight } from "lucide-react";

// The Dashboard's "Lead flow" switch, shown in the top bar next to the nav pill:
// KOC → Vendors (value "") or Vendors → KOC (value "vendors", ?flow=vendors).
const FLOWS = [
  { value: "", label: "KOC → Vendors" },
  { value: "vendors", label: "Vendors → KOC" },
];

export default function LeadFlowToggle({ value, onChange }) {
  return (
    <div className="flex w-full items-center gap-1 rounded-full bg-linear-to-r from-amber-200 via-amber-300 to-orange-400 p-1.5 shadow-xl shadow-orange-500/25 ring-1 ring-white/40 lg:w-auto">
      <span className="flex shrink-0 items-center gap-1.5 px-3 text-xs font-semibold text-amber-950/70">
        <ArrowLeftRight size={13} aria-hidden="true" />
        Lead flow
      </span>
      <div role="tablist" aria-label="Lead flow" className="flex flex-1 items-center gap-1 lg:flex-none">
        {FLOWS.map((f) => {
          const active = value === f.value;
          return (
            <button
              key={f.value || "koc"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(f.value)}
              className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-300 lg:flex-none ${
                active
                  ? "bg-brand-800 text-white shadow-md shadow-brand-900/30"
                  : "text-amber-950 hover:bg-amber-950/10"
              }`}
            >
              {active && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />}
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
