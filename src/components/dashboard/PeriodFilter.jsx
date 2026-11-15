import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { MODES, modeOf, periodError, presetPeriod } from "../../pages/dashboardPeriod.js";

// The Dashboard's date filter: Last 7 / 15 / 30 days, Single date, or Date range (from–to).
// No future dates, at most 1 year. A period is only sent (onChange) once it's valid.
const inputCls =
  "rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

export default function PeriodFilter({ period, today, onChange, disabled }) {
  const [mode, setMode] = useState(() => modeOf(period, today));
  const [draft, setDraft] = useState(period);
  const [error, setError] = useState("");

  // Follow the period when it changes from outside (URL, back/forward)
  useEffect(() => {
    setMode(modeOf(period, today));
    setDraft(period);
    setError("");
  }, [period.from, period.to, today]); // eslint-disable-line react-hooks/exhaustive-deps

  function send(next) {
    setDraft(next);
    const problem = periodError(next, today);
    setError(problem ?? "");
    if (!problem) onChange(next);
  }

  function pickMode(value) {
    setMode(value);
    setError("");
    if (value === "single") send({ from: period.to, to: period.to });
    else if (value === "range") setDraft(period);
    else send(presetPeriod(value, today));
  }

  return (
    <div className="flex flex-col items-end gap-1">
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
