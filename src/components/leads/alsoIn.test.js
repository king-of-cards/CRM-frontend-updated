import { describe, expect, test } from "bun:test";
import { alsoInLabel, alsoInLine, alsoInPlaces, alsoInTooltip, isAlsoIn } from "./alsoIn.js";
import { sourceList } from "../crmLeads/crmLeadUtils.js";

const adminAlsoIn = [
  { source: "spin", count: 1 },
  { source: "whatsapp", count: 1 },
  { source: "vendor_to_koc", count: 2, vendors: ["OHP", "Phodeo"] },
  { source: "dhruva", count: 1 },
  { source: "koc_to_dhruva", count: 1 },
];

describe("also_in badges", () => {
  test("every place the API sends gets a label, in the API's order", () => {
    expect(alsoInPlaces(adminAlsoIn).map((p) => p.label)).toEqual(["Spin", "International", "Vendors → KOC", "Dhruva → KOC", "KOC → Dhruva"]);
    expect(alsoInLabel("wedding_gifts")).toBe("wedding_gifts"); // gone (docs section 17): no label of its own
    expect(alsoInLabel("wedding_planner")).toBe("Wedding planner");
  });
  test("the tooltip lists all places with counts, vendors only when sent", () => {
    expect(alsoInTooltip(adminAlsoIn)).toBe(
      "Also in:\nSpin: 1 lead\nInternational: 1 lead\nVendors → KOC: 2 leads (OHP, Phodeo)\nDhruva → KOC: 1 lead\nKOC → Dhruva: 1 lead",
    );
    // A vendor login: the API leaves vendors out (and never sends dhruva / koc_to_dhruva)
    expect(alsoInLine(alsoInPlaces([{ source: "vendor_to_koc", count: 2 }])[0])).toBe("Vendors → KOC: 2 leads");
  });
  test("nothing to show when the phone is nowhere else (or also_in is missing)", () => {
    expect(alsoInPlaces([])).toEqual([]);
    expect(alsoInPlaces(undefined)).toEqual([]);
    expect(alsoInTooltip(null)).toBe("");
  });
  test("Also in KOC → Dhruva where the API says so", () => {
    expect(isAlsoIn(adminAlsoIn, "koc_to_dhruva")).toBe(true);
    expect(isAlsoIn([{ source: "spin", count: 1 }], "koc_to_dhruva")).toBe(false);
  });
  test("upload warnings name the new places too", () => {
    expect(sourceList(["spin", "koc_to_dhruva", "dhruva"])).toBe("Spin leads, KOC → Dhruva, Dhruva → KOC");
  });
});
