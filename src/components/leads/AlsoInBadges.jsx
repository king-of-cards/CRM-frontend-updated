import { Copy } from "lucide-react";
import { alsoInLine, alsoInPlaces, alsoInTooltip } from "./alsoIn.js";

// "Also in" badges: one per place the API lists in also_in, with a tooltip naming every place,
// its count and (admins only, when the API sends them) the vendors. Renders nothing when empty.
// variant "row": compact chips under a lead's name; "panel": a details row with one line per place.
export default function AlsoInBadges({ alsoIn, variant = "row" }) {
  const places = alsoInPlaces(alsoIn);
  if (!places.length) return null;
  const tooltip = alsoInTooltip(alsoIn);
  if (variant === "panel") {
    return (
      <ul className="space-y-1" aria-label="Also in">
        {places.map((p) => (
          <li key={p.source} className="flex items-center gap-2 text-sm text-gray-800">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
              <Copy size={10} aria-hidden="true" />
              Also in {p.label}
            </span>
            <span className="text-xs text-gray-500">{alsoInLine(p).slice(p.label.length + 2)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <span className="mt-1 flex flex-wrap gap-1" title={tooltip} aria-label={tooltip.replace(/\n/g, "; ")}>
      {places.map((p) => (
        <span
          key={p.source}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200"
        >
          <Copy size={9} aria-hidden="true" />
          Also in {p.label}
          {p.count > 1 && <span className="tabular-nums text-amber-700/80">×{p.count}</span>}
        </span>
      ))}
    </span>
  );
}
