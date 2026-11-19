import { useState } from "react";
import { Info, MapPin } from "lucide-react";
import { Panel } from "./DashboardParts.jsx";
import { topCitiesSubtitleFor, topCityRows } from "../../pages/topCities.js";

// sources: the API's top_cities_sources (the subtitle lists them); without that list the
// subtitle names the flow's default sources ("" = KOC → Vendors, "vendors" = Vendors → KOC)
export default function TopCities({ rows, sources, defaultSource = null, flow = "" }) {
  const [open, setOpen] = useState(null);
  const cities = topCityRows(rows, defaultSource);
  const max = Math.max(1, ...cities.map((city) => city.count));
  return (
    <Panel title="Top cities" subtitle={topCitiesSubtitleFor(sources, flow)} icon={MapPin}>
      {cities.length ? <ul className="space-y-3">
        {cities.map((city) => (
          <li key={city.city}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-gray-700">{city.city}</span>
                <span className="group relative">
                  <button type="button" aria-label={`Source breakdown for ${city.city}`} aria-expanded={open === city.city} onClick={() => setOpen((current) => current === city.city ? null : city.city)} title={city.bySource.map((part) => `${part.label}: ${part.count}`).join(" · ")} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-brand-600"><Info size={13} /></button>
                  <span role="tooltip" className={`${open === city.city ? "block" : "hidden group-hover:block group-focus-within:block"} absolute left-0 top-full z-20 mt-1 w-48 rounded-xl bg-gray-900 px-3 py-2 text-xs text-white shadow-lg`}>
                    {city.bySource.length ? city.bySource.map((part) => <span key={part.source} className="flex justify-between gap-3"><span>{part.label}</span><span>{part.count}</span></span>) : "No source breakdown"}
                  </span>
                </span>
              </span>
              <span className="tabular-nums font-medium text-gray-900">{Number(city.count).toLocaleString("en-IN")}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true"><div className="h-full rounded-full bg-linear-to-r from-brand-600 to-brand-800" style={{ width: `${(city.count / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul> : <p className="text-sm text-gray-500">No city data yet.</p>}
    </Panel>
  );
}
