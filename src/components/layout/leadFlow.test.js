import { describe, expect, test } from "bun:test";
import { flowOf, FLOW_PAGES, tabsFor } from "./leadFlow.js";

describe("Lead flow from the page", () => {
  test("Vendors → KOC pages", () => {
    expect(flowOf("/dashboard", "?flow=vendors&period=all")).toBe("vendors");
    expect(flowOf("/vendor-to-koc", "?vendor_id=2")).toBe("vendors");
  });
  test("KOC → Vendors pages", () => {
    expect(flowOf("/dashboard", "")).toBe("");
    expect(flowOf("/dashboard", "?period=all")).toBe("");
    for (const p of ["/leads/spin", "/leads/international", "/leads/wedding", "/leads/wedding-planner"])
      expect(flowOf(p, "")).toBe("");
  });
  test("Dhruva pages", () => {
    expect(flowOf("/dashboard", "?flow=dhruva&period=all")).toBe("dhruva");
    expect(flowOf("/dhruva-leads", "")).toBe("dhruva");
    expect(flowOf("/dhruva-leads", "?search=foo")).toBe("dhruva");
  });
});

describe("tabs per flow", () => {
  test("KOC → Vendors: Dashboard + the four sources, no Vendors → KOC or Dhruva", () => {
    expect(tabsFor("").map((t) => t.label)).toEqual(["Dashboard", "Spin leads", "International", "Wedding", "Wedding planner"]);
    expect(tabsFor("")[0].to).toBe("/dashboard");
  });
  test("Vendors → KOC: Dashboard (keeping the flow) + Vendors → KOC", () => {
    expect(tabsFor("vendors").map((t) => [t.label, t.to])).toEqual([
      ["Dashboard", "/dashboard?flow=vendors"],
      ["Vendors → KOC", "/vendor-to-koc"],
    ]);
  });
  test("Dhruva: Dashboard (keeping the flow) + Dhruva leads", () => {
    expect(tabsFor("dhruva").map((t) => [t.label, t.to])).toEqual([
      ["Dashboard", "/dashboard?flow=dhruva"],
      ["Dhruva leads", "/dhruva-leads"],
    ]);
  });
  test("the switch shows on the Dashboard and every lead list (including dhruva)", () => {
    expect(FLOW_PAGES.sort()).toEqual(
      ["/dashboard", "/dhruva-leads", "/leads/international", "/leads/spin", "/leads/wedding", "/leads/wedding-planner", "/vendor-to-koc"].sort(),
    );
  });
});
