import { describe, expect, test } from "bun:test";
import { activityActorRole, activityDescription, activityTime, groupActivityByDay } from "./activityUtils.js";

describe("lead activity formatting", () => {
  test("field updates, money and actions use readable labels", () => {
    expect(activityDescription({ action: "field_changed", field: "update_status", old_value: null, new_value: "interested" })).toBe("Update: Pending → Interested");
    expect(activityDescription({ action: "field_changed", field: "quoted_amount", old_value: null, new_value: "50000" })).toBe("Quoted amount: — → ₹50,000");
    expect(activityDescription({ action: "field_changed", field: "follow_up_date", old_value: "2026-11-01", new_value: "2026-11-03" })).toBe("Follow-up date: 1 Nov 2026 → 3 Nov 2026");
    expect(activityDescription({ action: "hot_on" })).toBe("Marked as hot");
    expect(activityDescription({ action: "assigned", new_value: "4" }, (id) => id === "4" ? "Phodeo" : null)).toBe("Assigned to Phodeo");
    expect(activityDescription({ action: "archived" })).toBe("Archived");
    expect(activityDescription({ action: "created" })).toBe("Created");
  });

  test("role and relative/exact time formatting", () => {
    expect(activityActorRole("vendor_user")).toBe("Vendor User");
    const now = Date.parse("2026-11-19T06:00:00Z");
    expect(activityTime("2026-11-19T05:55:00Z", now)).toEqual({ relative: "5 min ago", exact: "19 Nov 2026, 11:25 am" });
  });

  test("groups newest-first items by IST calendar day", () => {
    const groups = groupActivityByDay([
      { created_at: "2026-11-19T05:55:00Z" },
      { created_at: "2026-11-18T17:00:00Z" },
      { created_at: "2026-11-18T08:00:00Z" },
    ], new Date("2026-11-19T06:00:00Z"));
    expect(groups.map((group) => [group.title, group.items.length])).toEqual([["Today", 1], ["Yesterday", 2]]);
  });
});
