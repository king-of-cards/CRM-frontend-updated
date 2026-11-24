import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { displayPhone } from "./contact.js";
import { contactLinks, copyClick } from "./contactLinks.js";

// Quick-contact buttons for a lead, the same everywhere (lists, panels, dashboards):
// Call (tel:), Email (mailto:, only with an email), WhatsApp (wa.me), and Copy for the number
// (10 digits, no +91) and the email (with a ~1.5 s "Copied" state). A button whose data is
// missing is left out. Clicks never reach the row or card around it (no panel opens). Tap targets
// are 44 px on phones.
//   phone:  one number (any format), or phones: several (Call, WhatsApp and Copy per number, Email once)
//   variant "row" (default): the number and round icon buttons; "panel": wide labelled buttons
//   showNumber: show the number beside the buttons (row only)

const ROW_BTN = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition sm:h-8 sm:w-8";
const PANEL_BTN = "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition";
const TONES = {
  row: {
    call: "bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700",
    mail: "bg-violet-50 text-violet-600 hover:bg-violet-100 hover:text-violet-700",
    wa: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-600",
    copy: "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700",
  },
  panel: {
    call: "bg-sky-50 text-sky-700 ring-1 ring-sky-100 hover:bg-sky-100",
    mail: "bg-violet-50 text-violet-700 ring-1 ring-violet-100 hover:bg-violet-100",
    wa: "bg-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-600",
    copy: "bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100",
  },
};

// Copy button: the icon turns into a tick ("Copied") for about 1.5 s; "Copy failed" if it didn't work
export function CopyButton({ value, label, text, variant = "row" }) {
  const [state, setState] = useState("idle");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onClick = async (event) => {
    const ok = await copyClick(event, value);
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1500);
  };
  const panel = variant === "panel";
  const status = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "";
  return (
    <button type="button" onClick={onClick} aria-label={label} title={status || `${label}: ${value}`} className={`${panel ? PANEL_BTN : ROW_BTN} ${TONES[variant].copy}`}>
      {state === "copied" ? <Check size={panel ? 16 : 14} aria-hidden="true" className="text-emerald-600" /> : <Copy size={panel ? 16 : 14} aria-hidden="true" />}
      {panel && (status || text)}
      <span role="status" aria-live="polite" className="sr-only">{status}</span>
    </button>
  );
}

const stop = (e) => e.stopPropagation();

function Buttons({ links, variant }) {
  const base = variant === "panel" ? PANEL_BTN : ROW_BTN;
  return links.map(({ kind, href, label, title, text, Icon, external, copy }) => (copy ? <CopyButton key={kind} value={copy} label={label} text={text} variant={variant} /> : (
    <a
      key={kind}
      href={href}
      aria-label={label}
      title={title ?? label}
      onClick={stop}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={`${base} ${TONES[variant][kind]}`}
    >
      <Icon size={variant === "panel" ? 16 : 14} aria-hidden="true" />
      {variant === "panel" && text}
    </a>
  )));
}

export default function ContactActions({ phone, phones, email, name, showNumber = true, variant = "row", className = "" }) {
  const numbers = (phones ?? [phone]).filter((p) => String(p ?? "").trim());
  const lines = numbers.length ? numbers : [null];
  const stopKeys = (e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); };

  if (variant === "panel") {
    // Several numbers: one line of buttons per number, each labelled with its number
    const many = numbers.length > 1;
    const groups = lines
      .map((p, i) => contactLinks({ phone: p, email, name, withMail: i === 0 }).map((l) => (many && l.kind !== "mail" && l.kind !== "copyMail" ? { ...l, text: `${l.text} ${displayPhone(p)}` } : l)))
      .filter((links) => links.length);
    if (!groups.length) return null;
    return (
      <div className={`space-y-2 ${className}`} onClick={stop} onKeyDown={stopKeys}>
        {groups.map((links, i) => <div key={i} className="flex flex-wrap gap-2"><Buttons links={links} variant="panel" /></div>)}
      </div>
    );
  }

  const rows = lines.map((p, i) => ({ phone: p, links: contactLinks({ phone: p, email, name, withMail: i === 0 }) }));
  if (!showNumber && !rows.some((r) => r.links.length)) return null;
  return (
    <div className={`flex flex-col gap-1 ${className}`} onClick={stop} onKeyDown={stopKeys}>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          {showNumber && (
            <span className="min-w-[96px] tabular-nums text-sm text-gray-800">
              {displayPhone(r.phone) || <span className="text-gray-300">No number</span>}
            </span>
          )}
          {r.links.length > 0 && <div className="flex items-center gap-1"><Buttons links={r.links} variant="row" /></div>}
        </div>
      ))}
    </div>
  );
}
