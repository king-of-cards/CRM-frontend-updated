import { describe, expect, test } from "bun:test";
import { buildFilterButtons } from "./filterButtons.js";
import { keysFor, readFilters, withFilters } from "./leadFilters.js";

const byKind = (buttons, kind) => buttons.find((button) => button.kind === kind);

describe("buildFilterButtons", () => {
  test("Dhruva has a Hot only toggle for everyone, kept in the URL as hot=yes", () => {
    expect(buildFilterButtons("dhruva", {}, {}, false).map((x) => x.kind)).toContain("hot");
    const hot = buildFilterButtons("dhruva", readFilters(new URLSearchParams("hot=yes"), "dhruva"), {}, false).find((x) => x.kind === "hot");
    expect(hot).toMatchObject({ active: true, keys: ["hot"], value: ["Hot only"] });
  });
  test("shows source-specific buttons for admins and vendor logins", () => {
    const admin = buildFilterButtons("spin", {}, {}, true).map((item) => item.kind);
    const vendor = buildFilterButtons("spin", {}, {}, false).map((item) => item.kind);
    expect(admin).toContain("assigned");
    expect(admin).toContain("branch");
    expect(vendor).not.toContain("assigned");
    expect(buildFilterButtons("vendor_to_koc", {}, {}, false).map((x) => x.kind)).not.toContain("vendor");
    expect(buildFilterButtons("dhruva", {}, {}, true).map((x) => x.kind)).toContain("also_in");
    expect(buildFilterButtons("dhruva", {}, {}, false).map((x) => x.kind)).not.toContain("also_in");
  });

  test("button inventory follows each list and viewer role", () => {
    const cases = [
      ["spin", ["branch", "pincode", "budget"], ["assigned", "also_in"]],
      ["whatsapp", ["country"], ["assigned", "also_in"]],
      ["wedding", ["occasion", "city", "budget_range", "shared_with", "hide_repeats"], ["assigned", "also_in"]],
      ["wedding_planner", ["city", "guests", "budget_range", "fits_budget", "last_step", "shared_with"], ["assigned", "also_in"]],
      ["vendor_to_koc", ["lead_date", "vendor", "city", "source"], ["vendor", "also_in"]],
      ["dhruva", ["venue", "event_type", "has_phone", "hot"], ["also_in"]],
    ];
    for (const [source, required, adminOnly] of cases) {
      const admin = buildFilterButtons(source, {}, {}, true).map((item) => item.kind);
      const vendor = buildFilterButtons(source, {}, {}, false).map((item) => item.kind);
      for (const kind of required) expect(admin).toContain(kind);
      for (const kind of adminOnly) {
        expect(admin).toContain(kind);
        expect(vendor).not.toContain(kind);
      }
    }
  });

  test("uses active labels and counts for selected values", () => {
    const filters = readFilters(new URLSearchParams("update_status=interested&update_status=pending&venue=Palace"), "dhruva");
    const buttons = buildFilterButtons("dhruva", filters, { venues: [{ value: "Palace", count: 3 }] }, true);
    expect(byKind(buttons, "update").activeLabel).toBe("Update (2)");
    expect(byKind(buttons, "venue").activeLabel).toBe("Venue: Palace");
    expect(byKind(buttons, "venue").count).toBe(" (3)");
  });

  test("each button exposes all keys it clears", () => {
    expect(byKind(buildFilterButtons("wedding", {}, {}, true), "budget_range").keys).toEqual(["budget_min", "budget_max"]);
    expect(byKind(buildFilterButtons("vendor_to_koc", {}, {}, true), "follow_up").keys).toEqual(["follow_up_from", "follow_up_to", "follow_up_due"]);
    expect(byKind(buildFilterButtons("spin", {}, {}, true), "assigned").keys).toEqual(["vendor_id", "unassigned"]);
  });

  test("every list button clears exactly its supported URL keys", () => {
    for (const source of ["spin", "whatsapp", "wedding", "wedding_planner", "vendor_to_koc", "dhruva"]) {
      for (const button of buildFilterButtons(source, {}, {}, true)) {
        const supported = keysFor(source);
        for (const key of button.keys) expect(supported).toContain(key);
        const params = new URLSearchParams(button.keys.map((key) => [key, "active"]));
        const cleared = withFilters(params, Object.fromEntries(button.keys.map((key) => [key, ""])));
        for (const key of button.keys) expect(cleared.has(key)).toBe(false);
      }
    }
  });

  test("KPI query parameters appear as selected", () => {
    const filters = readFilters(new URLSearchParams("quote=has&date_from=2026-11-01&date_to=2026-11-05"), "wedding");
    expect(byKind(buildFilterButtons("wedding", filters, {}, true), "quote")).toMatchObject({ active: true, value: ["has"] });
  });
});

describe("Wedding gifts filter buttons", () => {
  test("the same buttons as Spin (branch, pincode, budget, Update, quote, conversion, hot, In other sources)", () => {
    const kinds = (source) => buildFilterButtons(source, {}, {}, true).map((b) => b.kind);
    expect(kinds("wedding_gifts")).toEqual(kinds("spin"));
    for (const kind of ["branch", "pincode", "budget", "update", "quote", "conversion", "hot", "also_in", "origin"]) expect(kinds("wedding_gifts")).toContain(kind);
  });
});
