import { useEffect, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { MODES, modeOf, periodError, presetPeriod } from "../../pages/dashboardPeriod.js";

// A date filter: All time, Last 7 / 15 / 30 days, Single date, or Date range (from–to), and a ×
// that clears it back to All time. Used by the Dashboard and the lead lists' "Arrived" filter.
// No future dates, at most 1 year. A period is only sent (onChange) once it's valid.
const inputCls =
  "rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

export default function PeriodFilter({ period, today, onChange, disabled, alignStart = false }) {
  const [mode, setMode] = useState(() => modeOf(period, today));
  const [draft, setDraft] = useState(period.all ? { from: today, to: today } : period);
  const [error, setError] = useState("");

  // Follow the period when it changes from outside (URL, back/forward)
  useEffect(() => {
    setMode(modeOf(period, today));
    setDraft(period.all ? { from: today, to: today } : period);
    setError("");
  }, [period.all, period.from, period.to, today]); // eslint-disable-line react-hooks/exhaustive-deps

  function send(next) {
    setDraft(next);
    const problem = periodError(next, today);
    setError(problem ?? "");
    if (!problem) onChange(next);
  }

  function pickMode(value) {
    setMode(value);
    setError("");
    if (value === "all") onChange({ all: true });
    else if (value === "single") send({ from: draft.to, to: draft.to });
    else if (value === "range") setDraft(draft);
    else send(presetPeriod(value, today));
  }

  return (
    <div className={`flex flex-col gap-1 ${alignStart ? "items-start" : "items-end"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-500">
          <CalendarDays size={15} aria-hidden="true" />
          <span className="sr-only">Period</span>
          <select
            value={mode}
            onChange={(e) => pickMode(e.target.value)}
            disabled={disabled}
            className={inputCls}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {!period.all && (
          <button
            type="button"
            onClick={() => onChange({ all: true })}
            disabled={disabled}
            aria-label="Clear the date (All time)"
            title="Clear the date (All time)"
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={14} />
          </button>
        )}
        {mode === "single" && (
          <input
            type="date"
            aria-label="Date"
            value={draft.to}
            max={today}
            onChange={(e) => send({ from: e.target.value, to: e.target.value })}
            disabled={disabled}
            className={inputCls}
          />
        )}
        {mode === "range" && (
          <>
            <input
              type="date"
              aria-label="From"
              value={draft.from}
              max={draft.to && draft.to < today ? draft.to : today}
              onChange={(e) => send({ ...draft, from: e.target.value })}
              disabled={disabled}
              className={inputCls}
            />
            <span className="text-sm text-gray-400">–</span>
            <input
              type="date"
              aria-label="To"
              value={draft.to}
              min={draft.from || undefined}
              max={today}
              onChange={(e) => send({ ...draft, to: e.target.value })}
              disabled={disabled}
              className={inputCls}
            />
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
