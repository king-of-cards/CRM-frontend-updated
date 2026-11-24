import { beforeAll, describe, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../auth/context.js";
import { assignmentChange, assignmentOf, AUTOMATIC_CHOICE, UNASSIGNED_CHOICE } from "./crmAccess.js";
import { activityDescription, vendorNameLookup } from "./activityUtils.js";

// Changing "Assigned to" on a lead (/leads/spin, admin) must never crash the page. The crash was
// "TypeError: vendorName is not a function": the lead panel passed the vendor's NAME (a string) to
// the activity list, which calls vendorName(id) for every "assigned" entry, and the activity list
// reloads right after an Assigned to save. Each case below goes choice → PUT body → the API's
// answer → the inline cell, the lead panel and the activity entries the API then writes.
// There is no DOM here (renderToString runs no effects), so the activity entries are rendered
// through ActivityList, the exact markup LeadActivity shows.

const VENDORS = [
  { id: 9, name: "Kraftyz", is_active: true },
  { id: 2, name: "Phodeo", is_active: true },
  { id: 7, name: "Old Vendor", is_active: false },
];

const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let VendorCell;
let LeadPanel;
let ActivityList;
beforeAll(async () => {
  globalThis.sessionStorage = storage;
  globalThis.localStorage = storage;
  const real = await import("../../api/client.js");
  mock.module("../../api/client.js", () => ({
    ...real,
    peek: (path) => (String(path).startsWith("/vendors") ? VENDORS : undefined),
    apiRequest: () => new Promise(() => {}),
  }));
  VendorCell = (await import("./InlineCrm.jsx")).VendorCell;
  LeadPanel = (await import("./LeadPanel.jsx")).default;
  ActivityList = (await import("./LeadActivity.jsx")).ActivityList;
});

const admin = { id: 1, role: "admin", name: "Admin User", email: "admin@example.in" };
const auth = {
  user: admin, isAdmin: true, isViewer: false, canEdit: true, seesAll: true, isVendor: false, isDhruva: false,
  vendor: null, canSeeLeads: true, isReady: true, login: async () => {}, logout: async () => {},
};
const wrap = (node) =>
  renderToString(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/leads/spin"]}>{node}</MemoryRouter>
    </AuthContext.Provider>,
  );

const crmOf = (over) => ({
  lead_key: "101", vendor: null, vendor_source: null, suggested_vendor: null, auto_assign: true,
  update_status: null, quoted_date: null, quoted_amount: null, conversion_amount: null, notes: null,
  updated_at: "2026-11-23T05:00:00Z", updated_by_name: "Admin User", ...over,
});
const panelLead = (crm) => ({
  source: "spin", sourceLabel: "Spin", title: "Asha Rao", subtitle: "", phone: "919845012345", email: null,
  crm, context: {}, sections: [], alsoIn: [],
});
const entry = (over) => ({
  action: "assigned", created_at: "2026-11-23T05:00:00Z", actor_name: "Admin User", actor_role: "admin", ...over,
});

const CASES = [
  {
    name: "a vendor",
    before: crmOf({ vendor: { id: 9, name: "Kraftyz" }, vendor_source: "source_default" }),
    choice: "2",
    body: { vendor_id: 2 },
    after: crmOf({ vendor: { id: 2, name: "Phodeo" }, vendor_source: "manual" }),
    activity: entry({ field: "vendor_id", old_value: "9", new_value: "2" }),
    text: "Assigned to Phodeo",
  },
  {
    name: "Automatic",
    before: crmOf({ vendor: { id: 2, name: "Phodeo" }, vendor_source: "manual" }),
    choice: AUTOMATIC_CHOICE,
    body: { assigned_to: "automatic" },
    after: crmOf({ vendor: { id: 9, name: "Kraftyz" }, vendor_source: "suggested" }),
    activity: entry({ field: "assigned_to", old_value: "Phodeo", new_value: "Automatic" }),
    text: "Assigned to: Phodeo → Automatic",
  },
  {
    name: "Unassigned",
    before: crmOf({ vendor: { id: 9, name: "Kraftyz" }, vendor_source: "suggested" }),
    choice: UNASSIGNED_CHOICE,
    body: { assigned_to: "unassigned" },
    after: crmOf({ vendor: null, vendor_source: null, auto_assign: false }),
    activity: entry({ field: "assigned_to", old_value: "Automatic", new_value: "Unassigned" }),
    text: "Assigned to: Automatic → Unassigned",
  },
  {
    name: "a lead on an inactive vendor, moved to an active one",
    before: crmOf({ vendor: { id: 7, name: "Old Vendor" }, vendor_source: "manual" }),
    choice: "2",
    body: { vendor_id: 2 },
    after: crmOf({ vendor: { id: 2, name: "Phodeo" }, vendor_source: "manual" }),
    activity: entry({ field: "vendor_id", old_value: "7", new_value: "2" }),
    text: "Assigned to Phodeo",
  },
];

describe("changing Assigned to never crashes", () => {
  for (const c of CASES) {
    test(c.name, () => {
      // The dropdown's choice -> what PUT …/crm gets
      expect(assignmentChange(c.choice)).toEqual(c.body);

      // The inline cell and the lead panel, before and after the save
      for (const crm of [c.before, c.after]) {
        expect(() => wrap(<VendorCell crm={crm} save={async () => crm} />)).not.toThrow();
        expect(() => wrap(<LeadPanel lead={panelLead(crm)} onClose={() => {}} onSaved={() => {}} />)).not.toThrow();
      }
      expect(assignmentOf(c.after)).toBe(c.choice);

      // The activity list reloaded after the save: the entry the API wrote
      const lookup = vendorNameLookup(VENDORS, c.before.vendor, c.after.vendor);
      expect(activityDescription(c.activity, lookup)).toBe(c.text);
      const html = wrap(<ActivityList items={[c.activity]} vendorName={lookup} />);
      expect(html).toContain(c.text);
    });
  }

  test("the inactive vendor keeps its name in the cell and the history", () => {
    const html = wrap(<VendorCell crm={CASES[3].before} save={async () => null} />);
    expect(html).toContain("Old Vendor (inactive)");
    expect(activityDescription(entry({ field: "vendor_id", old_value: "2", new_value: "7" }), vendorNameLookup([], { id: 7, name: "Old Vendor" })))
      .toBe("Assigned to Old Vendor");
  });

  test("a vendorName that isn't a function (the old bug) or is missing never throws", () => {
    const e = entry({ field: "vendor_id", old_value: "9", new_value: "2" });
    for (const bad of ["Phodeo", null, undefined, 42, {}]) {
      expect(() => activityDescription(e, bad)).not.toThrow();
      expect(activityDescription(e, bad)).toBe("Assigned to Vendor #2");
      expect(() => wrap(<ActivityList items={[e]} vendorName={bad} />)).not.toThrow();
    }
    expect(activityDescription(entry({ field: "vendor_id", new_value: null }), "Phodeo")).toBe("Unassigned");
  });
});
