// Hover-to-open for filter dropdowns and the period picker. Pure, no React: every open/close
// decision is made here so it can be tested without a browser (useHoverOpen.js wires it up).
//
// - Only devices whose main pointer can hover (matchMedia("(hover: hover)")); touch keeps tap.
// - Only mouse pointers: a touch tap also fires pointerenter, which must not open the panel.
// - Opened by hover: closes a moment after the pointer leaves both the button and the panel,
//   unless focus is in a text field, search box, select or date field inside the panel, or the
//   caller says to keep it open (a half-picked date range).
// - Opened by click: stays until an outside click or Escape (as before). Clicking a panel that
//   hover opened pins it open instead of closing it.

export const HOVER_QUERY = "(hover: hover)";
export const CLOSE_DELAY_MS = 150;

// Does the device's main pointer hover? false without matchMedia (tests, old browsers)
export function canHover(win = globalThis) {
  try {
    return Boolean(win?.matchMedia?.(HOVER_QUERY)?.matches);
  } catch {
    return false;
  }
}

// Inputs that are clicked rather than typed in don't hold the panel open
const NOT_TYPED = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"]);

// Is focus on a field inside the panel that should keep it open (text, search, number, date…)?
export function focusHoldsOpen(active, panel) {
  if (!active || !panel || typeof panel.contains !== "function" || !panel.contains(active)) return false;
  const tag = String(active.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return !NOT_TYPED.has(String(active.type || "text").toLowerCase());
  return Boolean(active.isContentEditable);
}

// What to do for an event: "open" | "schedule-close" | "close" | "cancel-close" | "pin" | "toggle" | "none"
//   event: "pointerenter" | "pointerleave" | "timer" (the close delay ended) | "focusout" | "click"
//   state: { hoverCapable, open, disabled, hoverOpened, pointerInside, holds, pointerType }
//   holds: focus holds it open (focusHoldsOpen) or the caller keeps it open
export function hoverAction(event, state = {}) {
  const {
    hoverCapable = false,
    open = false,
    disabled = false,
    hoverOpened = false,
    pointerInside = false,
    holds = false,
    pointerType = "mouse",
  } = state;
  if (event === "click") return hoverCapable && open && hoverOpened ? "pin" : "toggle";
  if (!hoverCapable || disabled) return "none";
  if ((event === "pointerenter" || event === "pointerleave") && pointerType && pointerType !== "mouse") return "none";
  const mayClose = open && hoverOpened && !holds;
  switch (event) {
    case "pointerenter":
      return open ? "cancel-close" : "open";
    case "pointerleave":
      return mayClose ? "schedule-close" : "none";
    case "timer":
    case "focusout":
      if (!mayClose || pointerInside) return "none";
      return event === "timer" ? "close" : "schedule-close";
    default:
      return "none";
  }
}
