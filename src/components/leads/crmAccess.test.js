import { describe, expect, test } from "bun:test";
import { assignedText, canEdit, panelChanges } from "./crmAccess.js";

describe("who edits what", () => {
  test("admins: Assigned to and Notes only", () => {
    expect(canEdit(true, "vendor_id")).toBe(true);
    expect(canEdit(true, "notes")).toBe(true);
    for (const f of ["interest", "quoted_amount", "quoted_date", "converted"]) expect(canEdit(true, f)).toBe(false);
  });
  test("vendors: interest, quote, converted and notes; not Assigned to", () => {
    expect(canEdit(false, "vendor_id")).toBe(false);
    for (const f of ["interest", "quoted_amount", "quoted_date", "converted", "notes"]) expect(canEdit(false, f)).toBe(true);
  });
});

describe("assignedText", () => {
  test("chip text", () => {
    expect(assignedText({ vendor: { name: "Phodeo" }, vendor_source: "manual" })).toBe("Phodeo");
    expect(assignedText({ vendor: { name: "Phodeo" }, vendor_source: "branch" })).toBe("Phodeo");
    expect(assignedText({ vendor: { name: "RJ" }, vendor_source: "sheet" })).toBe("RJ");
    expect(assignedText({ vendor: { name: "OHP" }, vendor_source: "suggested" })).toBe("OHP · auto");
    expect(assignedText({ vendor: null })).toBe("Unassigned");
    expect(assignedText(null)).toBe("Unassigned");
  });
});

describe("panelChanges", () => {
  const before = { vendor_id: null, interest: null, quoted_amount: null, quoted_date: null, converted: false, notes: "" };
  test("admin: only vendor_id and notes, only when changed", () => {
    const after = { ...before, vendor_id: 2, interest: "interested", notes: "called" };
    expect(panelChanges(true, before, after)).toEqual({ vendor_id: 2, notes: "called" });
  });
  test("vendor: never vendor_id", () => {
    const after = { ...before, vendor_id: 3, interest: "interested", quoted_amount: 45000, converted: true };
    expect(panelChanges(false, before, after)).toEqual({ interest: "interested", quoted_amount: 45000, converted: true });
  });
  test("nothing changed", () => {
    expect(panelChanges(false, before, { ...before })).toEqual({});
  });
});
