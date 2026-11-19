import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { MAX_DAYS, PRESETS, addDays, daysInclusive, periodError, periodLabel, presetPeriod } from "../../pages/dashboardPeriod.js";

const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
const shiftMonth = (iso, amount) => {
  const d = new Date(`${monthStart(iso)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + amount);
  return d.toISOString().slice(0, 10);
};
const monthName = (iso) => new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const calendarDays = (iso) => {
  const first = monthStart(iso);
  const offset = new Date(`${first}T00:00:00Z`).getUTCDay();
  return Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
};
const shortDay = (iso) => String(Number(iso.slice(-2)));

export default function PeriodFilter({ period, today, onChange, disabled, alignStart = false }) {
  const anchor = useRef(null);
  const panel = useRef(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [month, setMonth] = useState(monthStart(period.all ? today : period.from));
  const [selection, setSelection] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const box = anchor.current?.getBoundingClientRect();
      if (box) setRect({ top: Math.max(8, Math.min(box.bottom + 6, window.innerHeight - 390)), left: Math.max(8, Math.min(alignStart ? box.left : box.right - Math.min(440, window.innerWidth - 16), window.innerWidth - Math.min(440, window.innerWidth - 16) - 8)), width: Math.min(440, window.innerWidth - 16) });
    };
    const outside = (event) => { if (!anchor.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false); };
    const key = (event) => { if (event.key === "Escape") setOpen(false); };
    place(); document.addEventListener("mousedown", outside); document.addEventListener("keydown", key);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, alignStart]);
  const label = period.all ? "All time" : periodLabel(period.from, period.to);
  function begin() {
    setMonth(monthStart(period.all ? today : period.from)); setSelection(null); setError(""); setOpen((value) => !value);
  }
  function pickPreset(value) {
    if (value === "all") onChange({ all: true });
    else onChange(presetPeriod(value, today));
    setOpen(false); setError("");
  }
  function pickDate(date) {
    const next = !selection?.from || selection.to || date < selection.from
      ? { from: date, to: "" }
      : { from: selection.from, to: date };
    setSelection(next);
    if (next.to) {
      const problem = periodError(next, today) || (daysInclusive(next.from, next.to) > MAX_DAYS ? "The period can be at most 1 year." : "");
      if (problem) { setError(problem); return; }
      onChange(next); setOpen(false); setError("");
    }
  }
  return <>
    <button ref={anchor} type="button" onClick={begin} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition ${open || !period.all ? "border-brand-300 bg-brand-50 text-brand-800" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"} disabled:opacity-50`}>
      <CalendarDays size={15} aria-hidden="true" /><span>{label}</span>
    </button>
    {open && rect && createPortal(<div ref={panel} role="dialog" aria-label="Date range" style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }} className="z-[1000] rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/10">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-36 sm:grid-cols-1">
          <button type="button" onClick={() => pickPreset("all")} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50">All time</button>
          {PRESETS.map((preset) => <button key={preset.value} type="button" onClick={() => pickPreset(preset.value)} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50">{preset.label}</button>)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} className="rounded p-1 hover:bg-gray-100"><ChevronLeft size={17} /></button>
            <span className="text-sm font-semibold text-gray-700">{monthName(month)}</span>
            <button type="button" aria-label="Next month" disabled={month >= monthStart(today)} onClick={() => setMonth(shiftMonth(month, 1))} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={17} /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] text-gray-400">{"SMTWTFS".split("").map((day, i) => <span key={`${day}-${i}`} className="py-1">{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-y-1">{calendarDays(month).map((date) => {
            const outsideMonth = date.slice(0, 7) !== month.slice(0, 7);
            const selected = selection?.from === date || selection?.to === date;
            const inRange = selection?.from && selection?.to && date >= selection.from && date <= selection.to;
            return <button key={date} type="button" disabled={date > today} onClick={() => pickDate(date)} aria-label={date} className={`mx-auto h-8 w-8 rounded-full text-xs ${selected ? "bg-brand-600 text-white" : inRange ? "bg-brand-100 text-brand-900" : "hover:bg-gray-100"} ${outsideMonth ? "text-gray-300" : "text-gray-700"} disabled:cursor-not-allowed disabled:opacity-30`}>{shortDay(date)}</button>;
          })}</div>
          <p className="mt-2 min-h-4 text-xs text-gray-500">{selection?.from ? selection.to ? periodLabel(selection.from, selection.to) : `Start: ${periodLabel(selection.from, selection.from)} · choose an end date` : "Choose a start date, then an end date"}</p>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>, document.body)}
  </>;
}
