import { describe, expect, test } from "bun:test";
import { KOC_SOURCES, redirectFor, visibleSources } from "../../auth/permissions.js";
import { flowLabels, tabsFor } from "./leadFlow.js";
import { outcomeLink, singleSourceKpiLinks, sourceKpiDestinations, tileGridClass } from "../../pages/dashboardOutcomes.js";
import { reminderRequestEmpty, reminderRequestFor, reminderRequestForUser } from "../dashboard/reminderUtils.js";
import { assignedText, assignmentChange, assignmentOf, automaticLabel } from "../leads/crmAccess.js";
import { dhruvaTile, vendorTiles } from "../../pages/vendorToKocDashboard.js";

// The vendors in the checklist: Kraftyz has only gift leads (Spin); Phodeo has three sources
const admin = { role: "admin", vendor: null, sources: KOC_SOURCES };
const viewer = { role: "viewer", vendor: null, sources: KOC_SOURCES };
const kraftyz = { role: "vendor", vendor: { id: 9, name: "Kraftyz" }, sources: ["spin"] };
const phodeo = { role: "vendor", vendor: { id: 2, name: "Phodeo" }, sources: ["spin", "whatsapp", "wedding"] };
const emptyVendor = { role: "vendor", vendor: { id: 5, name: "New Vendor" }, sources: [] };

describe("1) vendor logins see only their sources (/auth/me sources)", () => {
  test("visible sources: vendors theirs (in order), admins and viewers all four", () => {
    expect(visibleSources(kraftyz)).toEqual(["spin"]);
    expect(visibleSources({ ...phodeo, sources: ["wedding", "spin", "whatsapp"] })).toEqual(["spin", "whatsapp", "wedding"]);
    expect(visibleSources(admin)).toEqual(KOC_SOURCES);
    expect(visibleSources({ role: "viewer" })).toEqual(KOC_SOURCES);
    expect(visibleSources({ role: "vendor", vendor: { id: 1, name: "Old API" } })).toEqual(KOC_SOURCES); // no list sent
    expect(visibleSources(emptyVendor)).toEqual([]);
  });
  test("top tabs follow the sources", () => {
    expect(tabsFor("", undefined, { sources: visibleSources(kraftyz) }).map((t) => t.label)).toEqual(["Dashboard", "Spin leads"]);
    expect(tabsFor("", undefined, { sources: visibleSources(phodeo) }).map((t) => t.label)).toEqual(["Dashboard", "Spin leads", "International", "Wedding"]);
    expect(tabsFor("", undefined, { sources: visibleSources(admin) }).map((t) => t.label)).toEqual(["Dashboard", "Spin leads", "International", "Wedding", "Wedding planner"]);
  });
  test("another source's URL sends a vendor to their dashboard; admins and viewers unchanged", () => {
    expect(redirectFor(kraftyz, "/leads/wedding")).toBe("/dashboard");
    expect(redirectFor(kraftyz, "/leads/international")).toBe("/dashboard");
    expect(redirectFor(kraftyz, "/leads/spin")).toBeNull();
    expect(redirectFor(phodeo, "/leads/wedding-planner")).toBe("/dashboard");
    expect(redirectFor(phodeo, "/leads/wedding")).toBeNull();
    expect(redirectFor(kraftyz, "/vendor-to-koc")).toBeNull();
    for (const path of ["/leads/spin", "/leads/international", "/leads/wedding", "/leads/wedding-planner"]) {
      expect(redirectFor(admin, path)).toBeNull();
      expect(redirectFor(viewer, path)).toBeNull();
    }
  });
  test("tile grid balanced for any count", () => {
    expect(tileGridClass(1)).toBe("grid-cols-1");
    expect(tileGridClass(2)).toBe("sm:grid-cols-2");
    expect(tileGridClass(3)).toBe("sm:grid-cols-2 lg:grid-cols-3");
    expect(tileGridClass(4)).toBe("sm:grid-cols-2 xl:grid-cols-4");
  });
  test("one source: KPI cards link straight to that list (with the period)", () => {
    const links = singleSourceKpiLinks("spin", { from: "2026-11-01", to: "2026-11-21" });
    expect(links.total).toBe("/leads/spin?date_from=2026-11-01&date_to=2026-11-21");
    expect(links.interested).toBe("/leads/spin?update_status=interested&date_from=2026-11-01&date_to=2026-11-21");
    expect(links.aov).toBe("/leads/spin?update_status=converted&conversion=has&date_from=2026-11-01&date_to=2026-11-21");
    expect(singleSourceKpiLinks("spin", { all: true }).total).toBe("/leads/spin");
    expect(outcomeLink("/leads/spin", {}, { all: true })).toBe("/leads/spin");
  });
  test("KPI choosers offer only the visible sources", () => {
    const outcomes = { spin: { hot_count: 1 }, whatsapp: { hot_count: 2 }, wedding_planner: { hot_count: 3 } };
    expect(sourceKpiDestinations(outcomes, "hot", { all: true }, visibleSources(phodeo)).map((c) => c.source)).toEqual(["spin", "whatsapp"]);
    expect(sourceKpiDestinations(outcomes, "hot", { all: true }).map((c) => c.source)).toEqual(["spin", "whatsapp", "wedding_planner"]);
  });
  test("follow-ups ask only for the vendor's sources; none at all: no request", () => {
    expect(reminderRequestForUser("", kraftyz).sources).toEqual(["spin"]);
    expect(reminderRequestForUser("", phodeo).sources).toEqual(["spin", "whatsapp", "wedding"]);
    expect(reminderRequestForUser("", admin)).toBe(reminderRequestFor(""));
    expect(reminderRequestForUser("vendors", kraftyz).sources).toEqual(["vendor_to_koc"]);
    expect(reminderRequestEmpty(reminderRequestForUser("", emptyVendor))).toBe(true);
    expect(reminderRequestEmpty(reminderRequestForUser("", kraftyz))).toBe(false);
    expect(reminderRequestEmpty(reminderRequestFor("dhruva"))).toBe(false);
  });
});

describe("2) the vendor's name in the flow labels", () => {
  test("KOC → <Vendor> and <Vendor> → KOC for vendor logins; generic otherwise", () => {
    expect(flowLabels(kraftyz.vendor)).toEqual({ koc: "KOC → Kraftyz", vendors: "Kraftyz → KOC" });
    expect(flowLabels(null)).toEqual({ koc: "KOC → Vendors", vendors: "Vendors → KOC" });
    expect(flowLabels({ id: 3, name: "  " })).toEqual({ koc: "KOC → Vendors", vendors: "Vendors → KOC" });
  });
  test("the Vendors → KOC tab and the follow-ups card use them", () => {
    expect(tabsFor("vendors", undefined, { labels: flowLabels(phodeo.vendor) }).map((t) => t.label)).toEqual(["Dashboard", "Phodeo → KOC"]);
    expect(tabsFor("vendors").map((t) => t.label)).toEqual(["Dashboard", "Vendors → KOC"]);
    expect(reminderRequestForUser("", kraftyz).label).toBe("KOC → Kraftyz leads");
    expect(reminderRequestForUser("vendors", kraftyz).label).toBe("Kraftyz → KOC leads");
    expect(reminderRequestForUser("", admin).label).toBe("KOC → Vendors leads");
  });
});

describe("3) Assigned to: Automatic, Unassigned or a vendor", () => {
  test("the editors' value", () => {
    expect(assignmentOf({ vendor: { id: 2, name: "Phodeo" }, vendor_source: "manual" })).toBe("2");
    expect(assignmentOf({ vendor: null, auto_assign: false })).toBe("unassigned");
    expect(assignmentOf({ vendor: { id: 9, name: "Kraftyz" }, vendor_source: "source_default" })).toBe("automatic");
    expect(assignmentOf({ vendor: null, auto_assign: true })).toBe("automatic");
  });
  test("PUT …/crm gets assigned_to for Automatic / Unassigned, vendor_id for a vendor, never both", () => {
    expect(assignmentChange("automatic")).toEqual({ assigned_to: "automatic" });
    expect(assignmentChange("unassigned")).toEqual({ assigned_to: "unassigned" });
    expect(assignmentChange("2")).toEqual({ vendor_id: 2 });
  });
  test("labels: Unassigned without '· auto'; Automatic names the rule's vendor", () => {
    expect(assignedText({ vendor: null, auto_assign: false })).toBe("Unassigned");
    expect(automaticLabel({ vendor: { id: 2, name: "Phodeo" }, vendor_source: "suggested" })).toBe("Automatic · Phodeo");
    expect(automaticLabel({ vendor: null, suggested_vendor: { id: 4, name: "OHP" } })).toBe("Automatic · OHP");
    expect(automaticLabel({ vendor: null })).toBe("Automatic");
  });
});

describe("4) Vendors → KOC dashboard tiles (admin)", () => {
  test("every active vendor gets a tile (also when left out); inactive ones keep their flag", () => {
    const tiles = vendorTiles(
      [
        { vendor_id: 2, vendor_name: "Phodeo", is_active: true, leads: 5, interested: 1, converted: 1, pending: 3 },
        { vendor_id: 7, vendor_name: "Old Vendor", is_active: false, leads: 1, interested: 0, converted: 0, pending: 1 },
      ],
      [
        { id: 2, name: "Phodeo", is_active: true },
        { id: 9, name: "Kraftyz", is_active: true },
        { id: 8, name: "Gone", is_active: false },
      ],
    );
    expect(tiles.map((t) => [t.vendor_name, t.is_active, t.leads])).toEqual([["Phodeo", true, 5], ["Old Vendor", false, 1], ["Kraftyz", true, 0]]);
  });
  test("the Dhruva tile links to /dhruva-leads with the period; zeros show no link", () => {
    const tile = dhruvaTile({ received: 4, interested: 2, converted: 0, pending: 2 }, { from: "2026-11-01", to: "2026-11-21" });
    expect(tile.name).toBe("Dhruva");
    expect(tile.to).toBe("/dhruva-leads?date_from=2026-11-01&date_to=2026-11-21");
    expect(tile.leadsTo).toBe("/dhruva-leads?date_from=2026-11-01&date_to=2026-11-21");
    expect(tile.cells.map((c) => [c.label, c.count, c.to])).toEqual([
      ["INTERESTED", 2, "/dhruva-leads?update_status=interested&date_from=2026-11-01&date_to=2026-11-21"],
      ["CONVERTED", 0, null],
      ["PENDING", 2, "/dhruva-leads?update_status=pending&date_from=2026-11-01&date_to=2026-11-21"],
    ]);
    expect(dhruvaTile(null, { all: true })).toBeNull();
  });
});
