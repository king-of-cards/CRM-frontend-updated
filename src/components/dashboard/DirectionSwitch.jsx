import { ArrowRight } from "lucide-react";
import { DIRECTIONS } from "../../data/leads.js";

// Sits at the top of the dashboard: KOC -> Vendors / Vendors -> KOC.
// The selected side is filled with a green gradient.
export default function DirectionSwitch({ value, onChange, counts }) {
  const current = DIRECTIONS.find((d) => d.id === value);
  const hint = current.hint.charAt(0).toLowerCase() + current.hint.slice(1);

  return (
    <div className="flex flex-col items-center">
      <div
        role="group"
        aria-label="Lead direction"
        className="flex w-full gap-1.5 rounded-full bg-white p-2 shadow-md shadow-gray-200/70 ring-1 ring-gray-100 sm:w-auto"
      >
        {DIRECTIONS.map((d) => {
          const active = d.id === value;
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(d.id)}
              className={`flex flex-1 items-center justify-center gap-2.5 rounded-full px-8 py-3.5 text-base font-semibold whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:flex-none ${
                active
                  ? "bg-linear-to-r from-emerald-500 via-brand-600 to-brand-800 text-white shadow-md shadow-brand-700/30"
                  : "text-gray-600 hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              {d.from}
              <ArrowRight className="size-5" aria-hidden="true" />
              {d.to}
              <span
                className={`rounded-full px-2.5 py-0.5 text-sm ${
                  active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {counts[d.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-gray-500">Showing {hint}</p>
    </div>
  );
}