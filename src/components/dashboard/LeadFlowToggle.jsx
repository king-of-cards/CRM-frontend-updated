import { ArrowLeftRight } from "lucide-react";

// The Dashboard's "Lead flow" switch, shown in the top bar next to the nav pill:
// KOC → Vendors (value "") | Vendors → KOC (value "vendors") | Dhruva leads (value "dhruva").
// Hidden for Dhruva logins (they have no other section to switch to). showDhruva false (vendor
// logins): no "Dhruva leads" option.
const FLOWS = [
  { value: "", label: "KOC → Vendors" },
  { value: "vendors", label: "Vendors → KOC" },
  { value: "dhruva", label: "Dhruva leads" },
];

// labels: flowLabels(…) ("KOC → Kraftyz" / "Kraftyz → KOC" for a vendor login)
export default function LeadFlowToggle({ value, onChange, showDhruva = true, labels = null }) {
  return (
    <div className="flex w-full min-w-0 items-center gap-1 rounded-full bg-linear-to-r from-amber-200 via-amber-300 to-orange-400 p-1 shadow-xl shadow-orange-500/25 ring-1 ring-white/40 sm:p-1.5 lg:w-auto">
      {/* Phones: no label, so the three options fit (the tablist keeps its name) */}
      <span className="hidden shrink-0 items-center gap-1.5 px-3 text-xs font-semibold text-amber-950/70 sm:flex">
        <ArrowLeftRight size={13} aria-hidden="true" />
        Lead flow
      </span>
      <div role="tablist" aria-label="Lead flow" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-none [&::-webkit-scrollbar]:hidden">
        {FLOWS.filter((f) => showDhruva || f.value !== "dhruva").map((f) => {
          const active = value === f.value;
          return (
            <button
              key={f.value || "koc"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(f.value)}
              className={`flex min-h-9 flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-medium min-[400px]:px-3 sm:min-h-0 sm:py-2 sm:gap-2 sm:px-4 sm:text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-300 lg:flex-none ${
                active
                  ? "bg-brand-800 text-white shadow-md shadow-brand-900/30"
                  : "text-amber-950 hover:bg-amber-950/10"
              }`}
            >
              {/* The dot only from sm: on phones the three options need the room */}
              {active && <span className="hidden h-1.5 w-1.5 rounded-full bg-amber-300 sm:block" aria-hidden="true" />}
              {f.value === "" && labels ? labels.koc : f.value === "vendors" && labels ? labels.vendors : f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
