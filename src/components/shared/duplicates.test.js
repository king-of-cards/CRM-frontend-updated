import { describe, expect, test } from "bun:test";
import { DUPLICATE_TEXT, duplicateMessage, duplicateText } from "./duplicates.js";
import { kocErrors, rowKind } from "../vendorToKoc/kocUtils.js";

describe("duplicate wording", () => {
  test("the app's wording when the API has none", () => {
    expect(DUPLICATE_TEXT).toBe("Already exists (same phone, no conflicting details)");
    expect(duplicateText({ reason: "existing_added", lead_key: "crm-7" })).toBe(DUPLICATE_TEXT);
    expect(duplicateText(true)).toBe(DUPLICATE_TEXT);
    expect(duplicateText(null)).toBe("");
  });
  test("the API's text wins", () => {
    expect(duplicateText("Same lead as row 3")).toBe("Same lead as row 3");
    expect(duplicateText({ reason: "existing_sheet", message: "In the sheet already." })).toBe("In the sheet already.");
    expect(duplicateMessage({ message: "This lead already exists (the same phone and every other field).", duplicate: {} }))
      .toBe("This lead already exists (the same phone and every other field).");
    expect(duplicateMessage({ duplicate: {} })).toBe(DUPLICATE_TEXT);
  });
  test("a repeat inside the file keeps its own wording", () => {
    expect(duplicateText({ reason: "in_file", duplicate_of_row: 2 })).toBe("Repeated in this file (same as row 2)");
  });
});

describe("Vendor → KOC previews and 409s", () => {
  test("a duplicate wins over field errors", () => {
    expect(rowKind({ duplicate: { reason: "existing" }, errors: [{ field: "date", message: "x" }] })).toBe("duplicate");
    expect(rowKind({ errors: [{ field: "date", message: "x" }] })).toBe("invalid");
    expect(rowKind({ errors: [] })).toBe("valid");
  });
  test("409: the API's message, else the app's wording", () => {
    expect(kocErrors({ status: 409, detail: { message: "Already sent by this vendor.", duplicate: {} } }).message).toBe("Already sent by this vendor.");
    expect(kocErrors({ status: 409, detail: null, message: "Request failed (409)" }).message).toBe(DUPLICATE_TEXT);
  });
});
