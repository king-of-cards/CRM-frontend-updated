import { describe, expect, test } from "bun:test";
import { CLOSE_DELAY_MS, HOVER_QUERY, canHover, focusHoldsOpen, hoverAction } from "./hoverOpen.js";

const hover = { hoverCapable: true };
const hoverOpen = { hoverCapable: true, open: true, hoverOpened: true };

// A tiny stand-in for a panel element and the focused element
const panelWith = (...children) => ({ contains: (el) => children.includes(el) });
const el = (tagName, extra = {}) => ({ tagName, ...extra });

describe("canHover", () => {
  test("asks matchMedia for (hover: hover) only", () => {
    const asked = [];
    const win = { matchMedia: (q) => { asked.push(q); return { matches: true }; } };
    expect(canHover(win)).toBe(true);
    expect(asked).toEqual([HOVER_QUERY]);
    expect(HOVER_QUERY).toBe("(hover: hover)");
  });
  test("false on touch devices, without matchMedia, or when it throws", () => {
    expect(canHover({ matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(canHover({})).toBe(false);
    expect(canHover(null)).toBe(false);
    expect(canHover({ matchMedia: () => { throw new Error("no"); } })).toBe(false);
  });
});

describe("focusHoldsOpen", () => {
  test("text, search, number and date inputs, selects and textareas inside the panel hold it open", () => {
    for (const field of [el("INPUT"), el("INPUT", { type: "search" }), el("INPUT", { type: "number" }), el("INPUT", { type: "date" }), el("input", { type: "text" }), el("SELECT"), el("TEXTAREA"), el("DIV", { isContentEditable: true })]) {
      expect(focusHoldsOpen(field, panelWith(field))).toBe(true);
    }
  });
  test("buttons, checkboxes and radios don't", () => {
    for (const field of [el("BUTTON"), el("INPUT", { type: "checkbox" }), el("INPUT", { type: "radio" }), el("DIV")]) {
      expect(focusHoldsOpen(field, panelWith(field))).toBe(false);
    }
  });
  test("focus outside the panel, or no panel, doesn't", () => {
    const input = el("INPUT");
    expect(focusHoldsOpen(input, panelWith())).toBe(false);
    expect(focusHoldsOpen(input, null)).toBe(false);
    expect(focusHoldsOpen(null, panelWith())).toBe(false);
  });
});

describe("hoverAction", () => {
  test("a mouse entering the button opens it on hover devices", () => {
    expect(hoverAction("pointerenter", hover)).toBe("open");
  });
  test("never opens without hover, when disabled, or for touch and pen pointers", () => {
    expect(hoverAction("pointerenter", {})).toBe("none");
    expect(hoverAction("pointerenter", { ...hover, disabled: true })).toBe("none");
    expect(hoverAction("pointerenter", { ...hover, pointerType: "touch" })).toBe("none");
    expect(hoverAction("pointerenter", { ...hover, pointerType: "pen" })).toBe("none");
  });
  test("re-entering (button → panel) cancels a pending close", () => {
    expect(hoverAction("pointerenter", hoverOpen)).toBe("cancel-close");
  });
  test("leaving schedules a close, which then closes if the pointer stayed out", () => {
    expect(hoverAction("pointerleave", hoverOpen)).toBe("schedule-close");
    expect(hoverAction("timer", hoverOpen)).toBe("close");
    expect(hoverAction("timer", { ...hoverOpen, pointerInside: true })).toBe("none");
    expect(CLOSE_DELAY_MS).toBeGreaterThan(0);
  });
  test("stays open while focus holds it (input, search, date picker) or the caller keeps it", () => {
    expect(hoverAction("pointerleave", { ...hoverOpen, holds: true })).toBe("none");
    expect(hoverAction("timer", { ...hoverOpen, holds: true })).toBe("none");
  });
  test("when focus leaves the field with the pointer outside, it closes after the delay", () => {
    expect(hoverAction("focusout", hoverOpen)).toBe("schedule-close");
    expect(hoverAction("focusout", { ...hoverOpen, pointerInside: true })).toBe("none");
    expect(hoverAction("focusout", { ...hoverOpen, holds: true })).toBe("none");
  });
  test("panels opened by click don't close on leave", () => {
    const clicked = { hoverCapable: true, open: true, hoverOpened: false };
    expect(hoverAction("pointerleave", clicked)).toBe("none");
    expect(hoverAction("timer", clicked)).toBe("none");
    expect(hoverAction("focusout", clicked)).toBe("none");
  });
  test("clicking a hover-opened panel pins it; otherwise a click toggles", () => {
    expect(hoverAction("click", hoverOpen)).toBe("pin");
    expect(hoverAction("click", { hoverCapable: true, open: true })).toBe("toggle");
    expect(hoverAction("click", { hoverCapable: true, open: false })).toBe("toggle");
    expect(hoverAction("click", { open: true, hoverOpened: true })).toBe("toggle");
  });
  test("nothing happens when closed, for leave and timer", () => {
    expect(hoverAction("pointerleave", hover)).toBe("none");
    expect(hoverAction("timer", hover)).toBe("none");
    expect(hoverAction("unknown", hoverOpen)).toBe("none");
  });
});
