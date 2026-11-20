import { describe, expect, test } from "bun:test";
import { assignedText, AUTO_VENDOR_SOURCES, canEdit, NAMED_VENDOR_SOURCES, panelChanges } from "./crmAccess.js";

describe("who edits what", () => {
  test("admins: everything, including Assigned to", () => {
    for (const f of ["vendor_id", "notes", "update_status", "quoted_amount", "quoted_date", "conversion_amount"])
      expect(canEdit(true, f)).toBe(true);
  });
  test("vendors: update, amounts and notes; not Assigned to", () => {
    expect(canEdit(false, "vendor_id")).toBe(false);
    for (const f of ["update_status", "quoted_amount", "quoted_date", "conversion_amount", "notes"]) expect(canEdit(false, f)).toBe(true);
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
  const before = { vendor_id: null, update_status: null, quoted_amount: null, quoted_date: null, conversion_amount: null, notes: "" };
  test("admin: every changed field, Assigned to included", () => {
    const after = { ...before, vendor_id: 2, update_status: "interested", notes: "called" };
    expect(panelChanges(true, before, after)).toEqual({ vendor_id: 2, update_status: "interested", notes: "called" });
  });
  test("vendor: never vendor_id", () => {
    const after = { ...before, vendor_id: 3, update_status: "converted", quoted_amount: 45000, conversion_amount: 40000 };
    expect(panelChanges(false, before, after)).toEqual({ update_status: "converted", quoted_amount: 45000, conversion_amount: 40000 });
  });
  test("nothing changed", () => {
    expect(panelChanges(false, before, { ...before })).toEqual({});
  });
});

describe("Assigned to: automatic sources", () => {
  test("source_default (Wedding gifts → Kraftzy) is automatic, like the area rules", () => {
    expect(assignedText({ vendor: { id: 9, name: "Kraftzy" }, vendor_source: "source_default" })).toBe("Kraftzy · auto");
    expect(assignedText({ vendor: { id: 2, name: "Phodeo" }, vendor_source: "suggested" })).toBe("Phodeo · auto");
    expect(AUTO_VENDOR_SOURCES).toContain("source_default");
  });
  test("chosen vendors keep their plain name; no vendor is Unassigned", () => {
    for (const how of NAMED_VENDOR_SOURCES) expect(assignedText({ vendor: { id: 9, name: "Kraftzy" }, vendor_source: how })).toBe("Kraftzy");
    expect(assignedText({ vendor: null, vendor_source: "source_default" })).toBe("Unassigned");
  });
});
