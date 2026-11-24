import { beforeAll, describe, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../auth/context.js";
import { copyChanges, copyForm, copySaveOptions, isMultiVendor, vendorChips, vendorCopies } from "./leadVendors.js";

// Several vendors per lead (docs section 19): one card per vendor in the lead panel (its own Save),
// one "Assigned to" chip per vendor in the lists; vendor logins only their own copy; leads with one
// vendor as before. No DOM here: renderToString (no effects, no clicks).

const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let LeadPanel;
let InlineCrmCells;
let VendorCopyCard;
beforeAll(async () => {
  globalThis.sessionStorage = storage;
  globalThis.localStorage = storage;
  const real = await import("../../api/client.js");
  mock.module("../../api/client.js", () => ({
    ...real,
    peek: (path) => (String(path).startsWith("/vendors") ? [{ id: 2, name: "Phodeo", is_active: true }, { id: 4, name: "Kraftyz", is_active: true }] : undefined),
    apiRequest: () => new Promise(() => {}),
  }));
  LeadPanel = (await import("./LeadPanel.jsx")).default;
  InlineCrmCells = (await import("./InlineCrm.jsx")).InlineCrmCells;
  VendorCopyCard = (await import("./VendorCopyCard.jsx")).default;
});

const copy = (id, name, over = {}) => ({
  vendor: { id, name }, vendor_source: "suggested", update_status: null, quoted_amount: null, quoted_date: null,
  conversion_amount: null, follow_up_date: null, notes: null, updated_at: null, updated_by_name: null, is_hot: false, ...over,
});
const MULTI = {
  lead_key: "404", vendor: { id: 2, name: "Phodeo" }, vendor_source: "suggested", auto_assign: true, suggested_vendor: null,
  vendors: [
    copy(2, "Phodeo", { update_status: "not_interested", notes: "Said no", follow_up_date: "2026-12-02" }),
    copy(4, "Kraftyz", { vendor_source: "partner", update_status: "interested", quoted_amount: 500 }),
  ],
  update_status: "interested", quoted_amount: 500, conversion_amount: null, quoted_date: null, follow_up_date: "2026-12-02",
  notes: "Said no", updated_at: null, updated_by_name: null, is_hot: false,
};
const SINGLE = { ...MULTI, vendor_source: "manual", vendors: [copy(2, "Phodeo", { vendor_source: "manual", update_status: "interested" })] };
// What the API gives a Kraftyz login: only its own copy, top-level values = that copy's
const KRAFTYZ_VIEW = { ...MULTI, vendor: { id: 4, name: "Kraftyz" }, vendor_source: "partner", update_status: "interested", vendors: [MULTI.vendors[1]], notes: null };

const login = (role, over = {}) => ({
  user: { id: 1, role, name: "User", email: "u@example.in" }, isAdmin: role === "admin", isViewer: role === "viewer",
  canEdit: role !== "viewer", seesAll: role !== "vendor", isVendor: role === "vendor", isDhruva: false,
  vendor: role === "vendor" ? { id: 4, name: "Kraftyz" } : null, canSeeLeads: true, isReady: true, login: async () => {}, logout: async () => {}, ...over,
});
const wrap = (auth, node) =>
  renderToString(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/leads/spin"]}>{node}</MemoryRouter>
    </AuthContext.Provider>,
  );
const panel = (auth, crm) =>
  wrap(auth, <LeadPanel lead={{ source: "spin", sourceLabel: "Spin", title: "Asha Rao", subtitle: "", phone: "919845012345", email: null, crm, context: {}, sections: [], alsoIn: [] }} onClose={() => {}} />);
const count = (html, re) => (html.match(re) ?? []).length;

describe("helpers", () => {
  test("copies, chips and whether a lead has several vendors", () => {
    expect(isMultiVendor(MULTI)).toBe(true);
    expect(isMultiVendor(SINGLE)).toBe(false);
    expect(isMultiVendor({ lead_key: "1" })).toBe(false);
    expect(vendorChips(MULTI).map((c) => c.text)).toEqual(["Phodeo · auto", "Kraftyz · auto"]);
    expect(vendorChips(SINGLE).map((c) => c.text)).toEqual(["Phodeo"]);
    expect(vendorChips({ vendor: null, vendors: [] }).map((c) => c.text)).toEqual(["Unassigned"]);
    expect(vendorChips({ vendor: { id: 2, name: "Phodeo" }, vendor_source: "sheet" }).map((c) => c.text)).toEqual(["Phodeo"]); // older answers
    // A vendor login only ever gets its own copy, even if more were sent
    expect(vendorCopies(MULTI, { seesAll: false, vendorId: 4 }).map((c) => c.vendor.name)).toEqual(["Kraftyz"]);
  });
  test("a card saves only what changed, for its own vendor", () => {
    const k = MULTI.vendors[1];
    expect(copyChanges(k, copyForm(k))).toEqual({});
    expect(copyChanges(k, { ...copyForm(k), quoted_amount: "1,500", follow_up_date: "2026-12-05" })).toEqual({ quoted_amount: 1500, follow_up_date: "2026-12-05" });
    expect(copyChanges(k, { ...copyForm(k), update_status: "" })).toEqual({ update_status: null });
    expect(copySaveOptions(true, 4)).toEqual({ vendor: 4 });
  });
});

describe("lead panel: one card per vendor", () => {
  test("admin, several vendors: a card each with its own Save; Assigned to stays (no lead-wide Update)", () => {
    const html = panel(login("admin"), MULTI);
    expect(html).toContain('aria-label="Vendors&#x27; copies"');
    expect(html).toContain('id="vendor-copy-2-title"');
    expect(html).toContain('id="vendor-copy-4-title"');
    expect(html).toContain('aria-label="Save Phodeo"');
    expect(html).toContain('aria-label="Save Kraftyz"');
    expect(count(html, /<span class="text-xs font-medium text-gray-600">Update<\/span>/g)).toBe(2); // one per card, none lead-wide
    expect(count(html, /Follow-up date<\/span>/g)).toBe(2);
    expect(html).toContain("Said no"); // Phodeo's notes in Phodeo's card
    expect(html).toContain('value="2026-12-02"');
    expect(html).toContain("Save assignment");
    expect(html).toContain("Phodeo · auto");
    expect(html).toContain("Kraftyz · auto");
  });
  test("phones: 44 px fields and Save, one column, nothing wider than the screen", () => {
    const html = panel(login("admin"), MULTI);
    expect(html).toMatch(/aria-label="Save Phodeo" class="min-h-11[^"]*sm:min-h-0/);
    expect(html).toContain("w-full min-h-11");
    expect(html).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2");
    expect(html).toContain("min-w-0 rounded-2xl");
  });
  test("view-only login: every vendor's card, read only", () => {
    const html = panel(login("viewer"), MULTI);
    expect(html).toContain('id="vendor-copy-2-title"');
    expect(html).toContain('id="vendor-copy-4-title"');
    expect(html).not.toContain("Save Phodeo");
    expect(html).not.toContain("<select");
    expect(html).toContain("Not interested");
  });
  test("vendor login: only its own copy, edited in the form as before (no other vendor anywhere)", () => {
    const html = panel(login("vendor"), KRAFTYZ_VIEW);
    expect(html).not.toContain("Phodeo");
    expect(html).not.toContain("vendor-copy-");
    expect(html).toContain("Save changes");
    expect(count(html, /<span class="text-xs font-medium text-gray-600">Update<\/span>/g)).toBe(1);
  });
  test("one vendor: the panel as before (no cards, one Update, Save changes)", () => {
    const html = panel(login("admin"), SINGLE);
    expect(html).not.toContain("vendor-copy-");
    expect(html).toContain("Save changes");
    expect(count(html, /<span class="text-xs font-medium text-gray-600">Update<\/span>/g)).toBe(1);
  });
  test("a card on its own: the vendor's values; read only without edit rights", () => {
    const html = wrap(login("admin"), <VendorCopyCard copy={MULTI.vendors[1]} source="spin" leadKey="404" isAdmin canEdit />);
    expect(html).toContain("Kraftyz");
    expect(html).toContain('value="500"');
    expect(wrap(login("viewer"), <VendorCopyCard copy={MULTI.vendors[1]} source="spin" leadKey="404" />)).not.toContain("<form");
  });
});

describe("lists: Assigned to chips", () => {
  const row = (auth, crm) => wrap(auth, <table><tbody><tr><InlineCrmCells crm={crm} save={async () => crm} /></tr></tbody></table>);
  test("several vendors: one chip per vendor; Update and amounts read only (saved per vendor in the panel)", () => {
    const html = row(login("admin"), MULTI);
    expect(html).toContain(">Phodeo · auto</span>");
    expect(html).toContain(">Kraftyz · auto</span>");
    expect(html).not.toContain('aria-label="Assigned to" class="cursor-pointer'); // no single-vendor picker
    expect(html).not.toContain('<select aria-label="Update"');
    expect(html).toContain("Several vendors: change each vendor&#x27;s copy in the lead panel");
  });
  test("one vendor: the admin picker and editable Update as before; viewers see a chip", () => {
    const html = row(login("admin"), SINGLE);
    expect(html).toContain('<select aria-label="Assigned to"');
    expect(html).toContain('<select aria-label="Update"');
    expect(row(login("viewer"), MULTI)).toContain(">Kraftyz · auto</span>");
  });
  test("vendor logins: no Assigned to column, their own Update stays editable", () => {
    const html = row(login("vendor"), KRAFTYZ_VIEW);
    expect(html).not.toContain("Phodeo");
    expect(html).toContain('<select aria-label="Update"');
  });
});

describe("hot star: per vendor on a multi-vendor lead", () => {
  const HOT = { ...MULTI, is_hot: true, vendors: [MULTI.vendors[0], { ...MULTI.vendors[1], is_hot: true }] };
  const panelWithStar = (auth, crm, onToggleHot) =>
    wrap(auth, <LeadPanel lead={{ source: "spin", sourceLabel: "Spin", title: "Asha Rao", subtitle: "", phone: "919845012345", email: null, crm, context: {}, sections: [], alsoIn: [], isHot: Boolean(crm.is_hot), showHot: true, onToggleHot }} onClose={() => {}} />);
  test("admin: a star in each vendor's card (that vendor's state, 44 px on phones); the header star is read-only", () => {
    const html = panelWithStar(login("admin"), HOT, () => {});
    expect(html).toMatch(/aria-label="Mark as hot lead for Phodeo" aria-pressed="false"[^>]*class="inline-flex h-11 w-11 sm:h-8 sm:w-8/);
    expect(html).toContain('aria-label="Remove hot lead for Kraftyz" aria-pressed="true"');
    expect(html).toContain('aria-label="Hot lead (per vendor: set it in each vendor&#x27;s card)"');
    expect(html).not.toContain('aria-label="Remove hot lead"'); // no lead-wide toggle
  });
  test("view-only: each card's star, read only", () => {
    const html = panelWithStar(login("viewer"), HOT, null);
    expect(html).toContain('aria-label="Hot lead for Kraftyz (view only)"');
    expect(html).toContain('aria-label="Not a hot lead for Phodeo (view only)"');
    expect(html).not.toContain("Mark as hot lead");
  });
  test("one vendor, and vendor logins: the header star toggles as before, no card stars", () => {
    const single = panelWithStar(login("admin"), { ...SINGLE, is_hot: false }, () => {});
    expect(single).toContain('aria-label="Mark as hot lead" aria-pressed="false"');
    expect(single).not.toContain("hot lead for");
    const vendor = panelWithStar(login("vendor"), { ...KRAFTYZ_VIEW, is_hot: true }, () => {});
    expect(vendor).toContain('aria-label="Remove hot lead" aria-pressed="true"');
    expect(vendor).not.toContain("hot lead for");
  });
});
