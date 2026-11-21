import { describe, expect, test } from "bun:test";
import { buildFilterButtons } from "./filterButtons.js";
import { activeCount, keysFor, KOC_TO_DHRUVA, readFilters, toApiQuery } from "./leadFilters.js";

describe("KOC → Dhruva filters (docs section 18)", () => {
  test("the shared filters plus branch, pincode, budget, occasion, quantity and reason; never vendor_id / unassigned", () => {
    const keys = keysFor(KOC_TO_DHRUVA);
    for (const k of ["branch", "pincode", "budget", "occasion", "quantity_min", "quantity_max", "reason", "follow_up", "update_status", "quote", "conversion", "hot", "also_in", "origin"])
      expect(keys).toContain(k);
    expect(keys).not.toContain("vendor_id");
    expect(keys).not.toContain("unassigned");
  });
  test("URL -> API query keeps them (and drops other sources' keys)", () => {
    const filters = readFilters(new URLSearchParams("reason=budget&quantity_min=1000&occasion=Wedding&vendor_id=3&follow_up=overdue"), KOC_TO_DHRUVA);
    expect(toApiQuery(filters, KOC_TO_DHRUVA)).toEqual({ follow_up: "overdue", occasion: "Wedding", quantity_min: "1000", reason: "budget" });
    expect(activeCount(filters, KOC_TO_DHRUVA)).toBe(4);
  });
  test("buttons: its own set; In other sources only for admins and view-only logins", () => {
    const admin = buildFilterButtons(KOC_TO_DHRUVA, {}, {}, true).map((b) => b.kind);
    expect(admin).toEqual(["event", "branch", "pincode", "budget", "quantity", "reason", "occasion", "update", "hot", "quote", "conversion", "follow_when", "origin", "also_in"]);
    expect(buildFilterButtons(KOC_TO_DHRUVA, {}, {}, false).map((b) => b.kind)).not.toContain("also_in");
  });
  test("active labels for reason, quantity and follow-up", () => {
    const buttons = buildFilterButtons(KOC_TO_DHRUVA, { reason: "quantity", quantity_min: "1000", quantity_max: "5000", follow_up: "due" }, {}, true);
    const label = (kind) => buttons.find((b) => b.kind === kind).activeLabel;
    expect(label("reason")).toBe("Reason: Quantity ≥ 1000");
    expect(label("quantity")).toBe("Quantity: 1000–5000");
    expect(label("follow_when")).toBe("Follow-up: Due");
  });
});
