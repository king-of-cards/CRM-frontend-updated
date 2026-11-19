import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CLOSE_DELAY_MS, HOVER_QUERY, canHover, focusHoldsOpen, hoverAction } from "./hoverOpen.js";

// Hover-to-open for a button + floating panel (decisions in hoverOpen.js).
//   open / setOpen: the component's own state; onHoverOpen: runs before a hover opens it
//   keepOpen: hold it open (e.g. a half-picked date range); panelRef: the floating panel
// Returns props for the button and the panel, and click(toggle) for the button's onClick.
export default function useHoverOpen({ open, setOpen, onHoverOpen, keepOpen = false, disabled = false, panelRef }) {
  const [hoverCapable, setHoverCapable] = useState(() => canHover());
  useEffect(() => {
    const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(HOVER_QUERY) : null;
    if (!query) return undefined;
    const onChange = () => setHoverCapable(query.matches);
    onChange();
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  const timer = useRef(null);
  const pointerInside = useRef(false);
  const hoverOpened = useRef(false);
  // The latest props for the event handlers and the close timer (updated after each render)
  const latest = useRef({ open, setOpen, onHoverOpen, keepOpen, disabled, hoverCapable, panelRef });
  useLayoutEffect(() => {
    latest.current = { open, setOpen, onHoverOpen, keepOpen, disabled, hoverCapable, panelRef };
  });

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  // Closed by anything (outside click, Escape, a pick): forget how it was opened
  useEffect(() => {
    if (!open) {
      hoverOpened.current = false;
      clearTimer();
    }
  }, [open]);
  useEffect(() => clearTimer, []);

  const stateNow = (extra = {}) => {
    const l = latest.current;
    const active = typeof document !== "undefined" ? document.activeElement : null;
    return {
      hoverCapable: l.hoverCapable,
      open: l.open,
      disabled: l.disabled,
      hoverOpened: hoverOpened.current,
      pointerInside: pointerInside.current,
      holds: Boolean(l.keepOpen) || focusHoldsOpen(active, l.panelRef?.current),
      ...extra,
    };
  };
  const run = (action) => {
    const l = latest.current;
    if (action === "open") {
      clearTimer();
      hoverOpened.current = true;
      l.onHoverOpen?.();
      l.setOpen(true);
    } else if (action === "cancel-close" || action === "pin") {
      clearTimer();
      if (action === "pin") hoverOpened.current = false;
    } else if (action === "schedule-close") {
      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        run(hoverAction("timer", stateNow()));
      }, CLOSE_DELAY_MS);
    } else if (action === "close") {
      clearTimer();
      hoverOpened.current = false;
      l.setOpen(false);
    }
  };

  const onPointerEnter = (event) => {
    if (event.pointerType === "mouse") pointerInside.current = true;
    run(hoverAction("pointerenter", stateNow({ pointerType: event.pointerType })));
  };
  const onPointerLeave = (event) => {
    if (event.pointerType === "mouse") pointerInside.current = false;
    run(hoverAction("pointerleave", stateNow({ pointerType: event.pointerType })));
  };
  // Focus left a field: decide once the new focus is known
  const onBlur = () => setTimeout(() => run(hoverAction("focusout", stateNow())), 0);

  return {
    anchorProps: { onPointerEnter, onPointerLeave },
    panelProps: { onPointerEnter, onPointerLeave, onBlur },
    click: (toggle) => (hoverAction("click", stateNow()) === "pin" ? run("pin") : toggle()),
  };
}
