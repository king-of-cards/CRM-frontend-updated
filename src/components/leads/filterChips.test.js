import { describe, expect, test } from "bun:test";
import { filterChips } from "./filterChips.js";
import { readFilters } from "./leadFilters.js";

const chips = (qs, source, options, isAdmin = true) =>
  filterChips(readFilters(new URLSearchParams(qs), source), source, options, isAdmin).map((c) => c.label);

describe("filter chips use names, never ids", () => {
  test("spin: branch and vendor names, update, quote, conversion, origin", () => {
    expect(
      chips(
        "branch=1&vendor_id=2&unassigned=true&update_status=interested&update_status=pending&quote=gt:50000&conversion=has&origin=workflow&date_from=2026-11-01&date_to=2026-11-05",
        "spin",
        { branches: [{ id: "1", name: "Chamrajpet", count: 233 }], vendors: [{ id: 2, name: "Phodeo" }] },
      ),
    ).toEqual([
      "Arrived: 1 – 5 Nov 2026",
      "Branch: Chamrajpet",
      "Assigned to: Unassigned, Phodeo",
      "Update: Interested, Pending",
      "Quote more than ₹50,000",
      "Has a conversion amount",
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
    expect(chips("vendor_id=2&conversion=lt:10000", "whatsapp", { vendors: [] }, false)).toEqual(["Conversion less than ₹10,000"]);
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
  test("Vendors → KOC: quote and conversion chips read like the other lists", () => {
    expect(chips("quote=has&conversion=gt:50000", "vendor_to_koc", {}, false)).toEqual([
      "Has a quote",
      "Conversion more than ₹50,000",
    ]);
    expect(chips("quote=lt:10000&conversion=none", "vendor_to_koc", {}, true)).toEqual([
      "Quote less than ₹10,000",
      "No conversion amount",
    ]);
    const [quote] = filterChips(readFilters(new URLSearchParams("quote=has"), "vendor_to_koc"), "vendor_to_koc", {}, true);
    expect(quote.keys).toEqual(["quote"]);
  });
  test("Dhruva chips show received date, venue, event type and update labels", () => {
    expect(chips("date_from=2026-11-16&venue=Palace&event_type=wedding&update_status=pending&has_phone=no", "dhruva")).toEqual([
      "Received: 16 Nov 2026", "Venue: Palace", "Event type: wedding", "Update: Pending", "No phone",
    ]);
  });
  test("Dhruva dashboard KPI filters appear as removable chips", () => {
    expect(chips("date_from=2026-11-01&date_to=2026-11-05&quote=has", "dhruva")).toEqual([
      "Received: 1 – 5 Nov 2026", "Quote: has",
    ]);
    expect(chips("upcoming_days=30&update_status=not_interested", "dhruva")).toEqual([
      "Event: upcoming 30 days", "Update: Not interested",
    ]);
  });
  test("Update filter chips use the existing labels across every list", () => {
    for (const source of ["spin", "whatsapp", "wedding", "wedding_planner", "vendor_to_koc", "dhruva"]) {
      const result = filterChips(
        readFilters(new URLSearchParams("update_status=interested&update_status=pending"), source),
        source,
      );
      expect(result.find((chip) => chip.id === "update")).toEqual({
        id: "update",
        label: "Update: Interested, Pending",
        keys: ["update_status"],
      });
    }
  });
  test("Hot only chip is removable on all five supported lists and absent for Dhruva", () => {
    for (const source of ["spin", "whatsapp", "wedding", "wedding_planner", "vendor_to_koc"]) {
      const chip = filterChips(readFilters(new URLSearchParams("hot=yes"), source), source).find((item) => item.id === "hot");
      expect(chip).toEqual({ id: "hot", label: "Hot only", keys: ["hot"] });
    }
    expect(filterChips(readFilters(new URLSearchParams("hot=yes"), "dhruva"), "dhruva")).toEqual([]);
  });
  test("each chip knows which keys it removes", () => {
    const [c] = filterChips(readFilters(new URLSearchParams("event_from=2026-12-01"), "wedding"), "wedding", {}, true);
    expect(c.label).toBe("Event: from 1 Dec 2026");
    expect(c.keys).toEqual(["upcoming_days", "event_from", "event_to"]);
  });
});
