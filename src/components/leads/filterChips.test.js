import { describe, expect, test } from "bun:test";
import { filterChips } from "./filterChips.js";
import { readFilters } from "./leadFilters.js";

const chips = (qs, source, options, isAdmin = true) =>
  filterChips(readFilters(new URLSearchParams(qs), source), source, options, isAdmin).map((c) => c.label);

describe("filter chips use names, never ids", () => {
  test("spin: branch and vendor names, interest, quote, origin", () => {
    expect(
      chips(
        "branch=1&vendor_id=2&unassigned=true&interest=interested&interest=not_set&quote=gt:50000&origin=workflow&date_from=2026-11-01&date_to=2026-11-05",
        "spin",
        { branches: [{ id: "1", name: "Chamrajpet", count: 233 }], vendors: [{ id: 2, name: "Phodeo" }] },
      ),
    ).toEqual([
      "Arrived: 1 – 5 Nov 2026",
      "Branch: Chamrajpet",
      "Assigned to: Unassigned, Phodeo",
      "Interest: Interested, Not set",
      "Quote more than ₹50,000",
      "Origin: Spin game",
    ]);
  });
  test("unknown ids never show as numbers", () => {
    expect(chips("branch=99&vendor_id=7", "spin", { branches: [], vendors: [] })).toEqual([
      "Branch: Unknown branch",
      "Assigned to: Unknown vendor",
    ]);
  });
  test("vendor logins get no Assigned to chip", () => {
    expect(chips("vendor_id=2&converted=yes", "whatsapp", { vendors: [] }, false)).toEqual(["Converted: Yes"]);
  });
  test("wedding planner ranges and partner", () => {
    expect(
      chips("guests_min=100&budget_max=500000&fits_budget=false&shared_with=__none__&upcoming_days=30", "wedding_planner", {}),
    ).toEqual(["Event: upcoming 30 days", "Guests: at least 100", "Budget: at most ₹5,00,000", "Over budget", "Sheet partner: Not shared yet"]);
  });
  test("Vendors → KOC: received, vendor, update, follow-up due, source", () => {
    expect(
      chips(
        "date_from=2026-11-16&vendor_id=2&update_status=pending&update_status=purchased_with_us&follow_up_due=true&source=bulk_upload",
        "vendor_to_koc",
        { vendors: [{ id: 2, name: "Phodeo" }] },
      ),
    ).toEqual([
      "Received: 16 Nov 2026",
      "Vendor: Phodeo",
      "Update: Pending, Already purchased with us",
      "Follow-up due",
      "Source: Bulk upload",
    ]);
  });
  test("each chip knows which keys it removes", () => {
    const [c] = filterChips(readFilters(new URLSearchParams("event_from=2026-12-01"), "wedding"), "wedding", {}, true);
    expect(c.label).toBe("Event: from 1 Dec 2026");
    expect(c.keys).toEqual(["upcoming_days", "event_from", "event_to"]);
  });
});
