import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, MoreHorizontal, Pencil } from "lucide-react";
import { emitCrmLeadEvent } from "./crmLeadEvents.js";
import { isCrmLead } from "./crmLeadUtils.js";

// "Added" / "Imported" badge with Edit and Archive, shown only on leads added or imported in
// the CRM. Sheet and spin-game leads get nothing (renders null).
// The page's CrmLeadActions does the work (see crmLeadEvents.js).
export default function CrmRowBadge({ source, lead, leadKey }) {
  const [menu, setMenu] = useState(null); // { top, right } when open
  const button = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onDown = (e) => !e.target.closest?.("[data-crm-row-menu]") && close();
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  if (!isCrmLead(lead)) return null;
  const key = leadKey ?? lead.lead_key;

  const toggle = () => {
    if (menu) return setMenu(null);
    const r = button.current.getBoundingClientRect();
    setMenu({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };
  const run = (type) => {
    setMenu(null);
    emitCrmLeadEvent({ type, source, leadKey: key });
  };

  return (
    // Clicks here (and in the menu) must not open the lead's side panel
    <span className="inline-flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <span
        title={lead.origin === "imported" ? "Imported in the CRM" : "Added in the CRM"}
        className="rounded bg-brand-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brand-700"
      >
        {lead.origin === "imported" ? "Imported" : "Added"}
      </span>
      <button
        ref={button}
        type="button"
        data-crm-row-menu
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        aria-label="Lead actions"
        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <MoreHorizontal size={14} />
      </button>
      {menu &&
        createPortal(
          <div
            role="menu"
            data-crm-row-menu
            style={{ top: menu.top, right: menu.right }}
            className="fixed z-40 w-40 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-gray-100"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => run("edit")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50"
            >
              <Pencil size={14} className="text-gray-400" /> Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => run("archive")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50"
            >
              <Archive size={14} className="text-gray-400" /> Archive
            </button>
          </div>,
          document.body,
        )}
    </span>
  );
}
