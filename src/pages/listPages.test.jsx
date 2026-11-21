import { beforeAll, describe, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../auth/context.js";
import { canEdit, isViewer, seesAdminData } from "../auth/permissions.js";
import { buildFilterButtons } from "../components/leads/filterButtons.js";
import { activeCount, keysFor, readFilters, toApiQuery } from "../components/leads/leadFilters.js";

// Every lead list renders its filters and columns without crashing, for every source and role:
// first with nothing loaded yet (filter-options = null, no rows; this is how /leads/wedding went
// blank), then with one sample answer for every request (rows, options, KPIs).
// The API cache (peek) is mocked; renderToString runs no effects, so nothing is fetched.

const SOURCES = ["spin", "whatsapp", "wedding", "wedding_planner", "vendor_to_koc", "dhruva", "koc_to_dhruva"];

// One answer that fits every request: a list (items, columns, total), stats (kpis) and
// filter-options (every list of values)
const ROW = {
  id: 1, lead_key: "1", plan_id: "p1", name: "Asha Rao", phone: "9845012345", email: "asha@example.in",
  "additional_details.otherWeddingServices": "Photography, Wedding Gifts & Return Gifts",
  occasionType: "Wedding", occasionDate: "2026-12-20", pincode: "560018", branch_id: 1,
  estimatedBudgetPerCard: "70-100", created_at: "2026-11-20T10:00:00Z", submitted_at: "2026-11-20T10:00:00Z",
  updated: "2026-11-20T10:00:00Z", city: "Bangalore", country: "India", occasion: "Wedding",
  event_date: "2026-12-20", venue: "Palace Grounds", event_type: "Wedding", source: "manual",
  potential_value: 84000, quantity_required: 1200, estimated_budget_per_card: "70-100",
  received: "2026-11-20T10:00:00Z", update_status: "interested", is_hot: true, origin: "workflow",
  branch: { id: 11, name: "Chitradurga", code: "CTRD-011", city: "Chitradurga" }, // as the API sends on spin / KOC → Dhruva items
  crm: {
    lead_key: "1", vendor: { id: 9, name: "Kraftyz" }, vendor_source: "source_default", update_status: "interested",
    quoted_amount: 50000, quoted_date: "2026-11-21", conversion_amount: null, notes: "Call back", follow_up_date: "2026-12-01",
  },
  also_in: [{ source: "vendor_to_koc", count: 2, vendors: ["OHP"] }, { source: "koc_to_dhruva", count: 1 }],
};
const ANSWER = {
  items: [ROW], total: 1, page: 1, page_size: 10,
  columns: [
    { name: "id", type: "INTEGER" }, { name: "name", type: "TEXT" }, { name: "phone", type: "TEXT" },
    { name: "additional_details.otherWeddingServices", json_field: true, key: "otherWeddingServices" },
    { name: "created_at", type: "TIMESTAMP" },
  ],
  kpis: { total: 1, interested: 1, quoted_count: 1, quoted_total: 50000 },
  cities: [{ value: "Bangalore", count: 1 }], venues: [{ value: "Palace Grounds", count: 1 }],
  countries: [{ value: "India", count: 1 }], branches: [{ id: 1, name: "Chamrajpet", count: 1 }],
  pincodes: [{ value: "560018", count: 1 }], budgets: [{ value: "70-100", count: 1 }],
  other_services: [{ value: "Wedding Gifts & Return Gifts", count: 1 }], updates: [{ value: "interested", count: 1 }],
  origins: [{ value: "workflow", count: 1 }], vendors: [{ id: 9, name: "Kraftyz", is_active: true }, { id: 7, name: "Old Vendor", is_active: false }], occasions: [{ value: "Wedding", count: 1 }],
  event_types: [{ value: "Wedding", count: 1 }], last_steps: [], shared_with: [],
  quantity_range: { min: 1000, max: 5000 },
  sources: [], // GET /sheets/sources (sheet sync status)
};

// GET /analytics/koc-to-dhruva (docs section 18)
const ENTRY = { lead_key: "crm-7", name: "Meera Iyer", event_date: "2026-12-20", budget: "70-100", quantity: 1200, potential_value: 84000, update_status: null, status_label: "Pending" };
const DASH = {
  kpis: { shared: 12, pending: 5, interested: 3, quotes_count: 2, quoted_count: 2, quoted_total: 90000, converted: 1, converted_pct: 8.3, conversion_count: 1, conversion_total: 40000, conversion_amount_count: 1, conversion_amount_total: 40000, potential_value: 420000, follow_ups_due: 2 },
  funnel: [{ stage: "shared", count: 12 }, { stage: "contacted", count: 7 }, { stage: "interested", count: 4 }, { stage: "quoted", count: 2 }, { stage: "converted", count: 1 }],
  upcoming_events: { next_30_days: 2, next_60_days: 3, next_90_days: 4, next: [ENTRY] },
  top_value_leads: [{ ...ENTRY, lead_key: "crm-8", name: "Ravi Kumar", potential_value: 150000 }],
  monthly: [{ month: "2026-11", shared: 12, converted: 1 }],
  by_branch: [{ branch_id: 11, name: "Chitradurga", code: "CTRD-011 · Chitradurga", leads: 8, converted: 1, conversion_amount: 40000 }, { branch_id: null, name: null, code: null, leads: 4, converted: 0, conversion_amount: null }],
  by_budget_band: [{ band: "70-100", leads: 9, converted: 1, converted_pct: 11.1 }],
  stale: { count: 1, oldest: [{ ...ENTRY, lead_key: "crm-9", name: "Old Lead", received: "2026-10-01T10:00:00Z", last_update: null }] },
  latest: [{ ...ENTRY, occasion: "Wedding", received: "2026-11-20T10:00:00Z" }],
  by_occasion: [{ value: "Engagement", count: 1 }], inflow: [{ date: "2026-11-20", total: 1 }], by_status: { pending: 5 }, top_cities: [{ city: "Mysuru", count: 1 }],
};

// GET /analytics/overview: every source, so the page itself must hide a vendor's other sources
const OVERVIEW = {
  period: { granularity: "day" }, totals: { spin: 5, whatsapp: 3, wedding: 2, wedding_planner: 1, all: 11 },
  outcomes: { spin: { interested: 0, converted: 1, hot_count: 1 }, whatsapp: { interested: 1 }, wedding: { interested: 1 }, wedding_planner: { interested: 0 } },
  kpis: { total: 11, interested: 2, converted: 1, hot_count: 1 }, change_pct: {},
  source_mix: [{ source: "spin", pct: 45 }, { source: "whatsapp", pct: 27 }, { source: "wedding", pct: 18 }, { source: "wedding_planner", pct: 10 }],
  trend: [], upcoming_by_month: [], top_cities: [], top_countries: [], occasions: [], partners: [], sharing: { not_shared: 0, shared: 0 }, spin_available: true,
  sources: ["spin", "whatsapp", "wedding", "wedding_planner"],
};

// GET /analytics/vendor-to-koc (admin): per_vendor with an inactive vendor, and Dhruva as a partner
const VK = {
  received: 6, kpis: { total: 6 }, inflow: [], inflow_vendors: [], by_status: { pending: 2 },
  per_vendor: [
    { vendor_id: 2, vendor_name: "Phodeo", is_active: true, leads: 5, interested: 1, converted: 1, pending: 3 },
    { vendor_id: 9, vendor_name: "Kraftyz", is_active: true, leads: 0, interested: 0, converted: 0, pending: 0 },
    { vendor_id: 7, vendor_name: "Old Vendor", is_active: false, leads: 1, interested: 0, converted: 0, pending: 1 },
  ],
  dhruva: { received: 4, interested: 2, converted: 0, pending: 2 },
  funnel: { received: 6, updated: 3, engaged: 2, converted: 1 }, latest: [], next_follow_ups: [], follow_ups_due: 0,
};

let mode = "empty"; // "empty": nothing loaded yet; "data": every request has ANSWER
const memory = new Map();
const storage = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };

let PAGES;
let KocToDhruvaDashboard;
let DashboardPage;
let VendorToKocDashboard;
beforeAll(async () => {
  globalThis.sessionStorage = storage;
  globalThis.localStorage = storage;
  const real = await import("../api/client.js");
  mock.module("../api/client.js", () => ({
    ...real,
    // Per path: the vendor list is an array, the sheet status { sources }, the rest ANSWER
    peek: (path) => (mode !== "data" ? undefined : String(path).startsWith("/vendors") ? ANSWER.vendors : String(path).startsWith("/analytics/koc-to-dhruva") ? DASH : String(path).startsWith("/analytics/overview") ? OVERVIEW : String(path).startsWith("/analytics/vendor-to-koc") ? VK : ANSWER),
    apiRequest: () => new Promise(() => {}), // never answers: effects don't run in this test anyway
  }));
  PAGES = {
    spin: (await import("../components/dashboard/RecentLeads.jsx")).default,
    whatsapp: (await import("../components/dashboard/WhatsAppLeads.jsx")).default,
    wedding: (await import("../components/dashboard/WeddingLeads.jsx")).default,
    wedding_planner: (await import("../components/dashboard/WeddingPlans.jsx")).default,
    vendor_to_koc: (await import("../components/vendorToKoc/VendorToKocLeads.jsx")).default,
    dhruva: (await import("./DhruvaLeads.jsx")).default,
    koc_to_dhruva: (await import("./KocToDhruvaLeads.jsx")).default,
  };
  KocToDhruvaDashboard = (await import("./KocToDhruvaDashboard.jsx")).default;
  DashboardPage = (await import("./Dashboard.jsx")).default;
  VendorToKocDashboard = (await import("./VendorToKocDashboard.jsx")).default;
});

const ROLES = {
  admin: { id: 1, role: "admin", name: "Admin User", email: "admin@example.in" },
  viewer: { id: 2, role: "viewer", name: "View Only", email: "viewer@example.in", vendor: null },
  vendor: { id: 3, role: "vendor", name: "Vendor User", email: "vendor@example.in", vendor: { id: 9, name: "Kraftyz" } },
  dhruva: { id: 4, role: "dhruva", name: "Dhruva User", email: "dhruva@example.in" },
};
const authFor = (user) => ({
  user, isAdmin: user.role === "admin", isViewer: isViewer(user), canEdit: canEdit(user), seesAll: seesAdminData(user),
  isVendor: user.role === "vendor", isDhruva: user.role === "dhruva", vendor: user.vendor ?? null,
  canSeeLeads: seesAdminData(user) || (user.role === "vendor" && Boolean(user.vendor)), isReady: true,
  login: async () => {}, logout: async () => {},
});
// Who opens which list (App.jsx / permissions.js)
const rolesFor = (source) =>
  source === "dhruva" || source === "koc_to_dhruva" ? ["admin", "viewer", "dhruva"] : ["admin", "viewer", "vendor"];
const PATHS = { spin: "/leads/spin", whatsapp: "/leads/international", wedding: "/leads/wedding", wedding_planner: "/leads/wedding-planner", vendor_to_koc: "/vendor-to-koc", dhruva: "/dhruva-leads", koc_to_dhruva: "/koc-to-dhruva" };

function render(source, role, search = "") {
  const Page = PAGES[source];
  return renderToString(
    <AuthContext.Provider value={authFor(ROLES[role])}>
      <MemoryRouter initialEntries={[`${PATHS[source]}${search}`]}>
        <Page source={source === "spin" ? "spin" : undefined} />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("filters initialise for every source (pure)", () => {
  for (const source of SOURCES) {
    test(`${source}: buttons with options null, undefined or empty; URL -> query -> count`, () => {
      for (const options of [null, undefined, {}]) {
        for (const isAdmin of [true, false]) {
          const buttons = buildFilterButtons(source, {}, options, isAdmin);
          expect(buttons.length).toBeGreaterThan(0);
          expect(buttons.every((b) => b.active === false)).toBe(true);
        }
      }
      const filters = readFilters(new URLSearchParams("hot=yes&update_status=pending"), source);
      expect(Object.keys(toApiQuery(filters, source)).every((k) => keysFor(source).includes(k))).toBe(true);
      expect(activeCount(filters, source)).toBe(2);
    });
  }
});

describe("every lead list renders its filters and columns", () => {
  for (const source of SOURCES) {
    for (const role of rolesFor(source)) {
      test(`${source} as ${role}: nothing loaded yet (filter-options null)`, () => {
        mode = "empty";
        memory.clear();
        const html = render(source, role);
        expect(html).toContain("Update"); // the shared filter bar's Update button
        expect(html).not.toContain("Something went wrong");
      });
      test(`${source} as ${role}: with rows, options and KPIs (and filters in the URL)`, () => {
        mode = "data";
        memory.clear();
        memory.set("crm-spin-created-column", "created_at"); // Spin's remembered "created" column
        const html = render(source, role, "?hot=yes&update_status=interested");
        expect(html).not.toContain("Something went wrong");
        expect(html).toContain("Total leads"); // the KPI header
        // Spin reads its cached rows in an effect (not run here): its columns are checked instead
        if (source === "spin") expect(html).toContain("Other wedding services");
        else expect(html).toContain("9845012345"); // the sample row (every list shows its phone)
      });
    }
  }
  test("KOC → Dhruva: Branch as Spin shows it; Potential value column; no Reason or Pincode column or filter", () => {
    mode = "data";
    memory.clear();
    const html = render("koc_to_dhruva", "admin");
    expect(html).toContain("Chitradurga</span>");
    expect(html).toContain("CTRD-011 · Chitradurga");
    expect(html).not.toContain(">Reason</th>");
    expect(html).not.toContain(">Pincode</th>");
    expect(html).not.toContain("Reason"); // no Reason column, filter or text
    expect(html).toContain(">Potential value</th>");
    expect(html).toContain("₹84,000");
    expect(html).toContain("Potential value (highest)"); // the sort option
  });
});

describe("KOC → Dhruva dashboard", () => {
  const renderDashboard = (role) =>
    renderToString(
      <AuthContext.Provider value={authFor(ROLES[role])}>
        <MemoryRouter initialEntries={["/dashboard?flow=dhruva&direction=koc_to_dhruva"]}>
          <KocToDhruvaDashboard period={{ all: true }} refreshKey={0} />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
  test("nothing loaded yet: renders without crashing", () => {
    mode = "empty";
    const html = renderDashboard("dhruva");
    expect(html).toContain("Leads shared");
    expect(html).toContain("Funnel");
  });
  test("the new KPI cards and panels; no occasion, inflow, Top cities, Update breakdown or reason", () => {
    mode = "data";
    const html = renderDashboard("admin");
    for (const text of ["Leads shared", "Not contacted yet", "Potential value", "Follow-ups due", "Monthly", "Funnel", "Upcoming events", "Top value leads", "By branch", "By budget band", "Stale leads", "Latest leads"])
      expect(html).toContain(text);
    for (const name of ["Meera Iyer", "Ravi Kumar", "Old Lead", "Chitradurga", "CTRD-011 · Chitradurga", "No branch", "₹1,50,000"]) expect(html).toContain(name);
    for (const gone of ["Lead inflow", "Top cities", "Leads by occasion", "Engagement", "Mysuru", "Update breakdown", "Reason"]) expect(html).not.toContain(gone);
  });
});

describe("KOC → Vendors dashboard per login (/auth/me sources and vendor name)", () => {
  const LOGINS = {
    admin: { ...ROLES.admin, sources: ["spin", "whatsapp", "wedding", "wedding_planner"] },
    kraftyz: { id: 5, role: "vendor", name: "Kraftyz User", email: "k@example.in", vendor: { id: 9, name: "Kraftyz" }, sources: ["spin"] },
    phodeo: { id: 6, role: "vendor", name: "Phodeo User", email: "p@example.in", vendor: { id: 2, name: "Phodeo" }, sources: ["spin", "whatsapp", "wedding"] },
  };
  const renderDashboard = (login) => {
    mode = "data";
    return renderToString(
      <AuthContext.Provider value={authFor(LOGINS[login])}>
        <MemoryRouter initialEntries={["/dashboard?period=all"]}>
          <DashboardPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
  };
  test("Kraftyz: only Spin (tab, one full-width tile, KPI cards straight to Spin), named flows", () => {
    const html = renderDashboard("kraftyz");
    expect(html).toContain('href="/leads/spin"');
    for (const other of ["/leads/international", "/leads/wedding\"", "/leads/wedding-planner"]) expect(html).not.toContain(`href="${other.replace("\\", "")}`);
    expect(html).toContain("grid-cols-1");
    expect(html).toContain('href="/leads/spin?update_status=interested"'); // the Interested KPI card
    expect(html).toContain("KOC → Kraftyz");
    expect(html).toContain("Kraftyz → KOC");
    expect(html).toContain("KOC → Kraftyz leads"); // follow-ups card
    expect(html).not.toContain("KOC → Vendors");
  });
  test("Phodeo: three sources, three columns, named flows", () => {
    const html = renderDashboard("phodeo");
    for (const path of ["/leads/spin", "/leads/international", "/leads/wedding"]) expect(html).toContain(`href="${path}"`);
    expect(html).not.toContain('href="/leads/wedding-planner"');
    expect(html).toContain("lg:grid-cols-3");
    expect(html).toContain("KOC → Phodeo");
    expect(html).not.toContain('href="/leads/spin?update_status=interested"'); // several sources: no direct KPI link
  });
  test("admin: unchanged (all four sources, generic labels)", () => {
    const html = renderDashboard("admin");
    for (const path of ["/leads/spin", "/leads/international", "/leads/wedding", "/leads/wedding-planner"]) expect(html).toContain(`href="${path}"`);
    expect(html).toContain("xl:grid-cols-4");
    expect(html).toContain("KOC → Vendors");
    expect(html).not.toContain("Kraftyz");
  });
});

describe("admin: Vendors → KOC tiles and Assigned to", () => {
  test("a tile per vendor (zeros as —, Inactive badge) plus Dhruva linking to /dhruva-leads", () => {
    mode = "data";
    const html = renderToString(
      <AuthContext.Provider value={authFor(ROLES.admin)}>
        <MemoryRouter initialEntries={["/dashboard?flow=vendors&period=all"]}>
          <VendorToKocDashboard period={{ all: true }} refreshKey={0} isAdmin />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    for (const name of ["Phodeo", "Kraftyz", "Old Vendor", "Inactive", "Dhruva", "Partner"]) expect(html).toContain(name);
    expect(html).toContain('href="/dhruva-leads"');
    expect(html).toContain('href="/dhruva-leads?update_status=interested"');
  });
  test("the inline Assigned to offers Automatic, Unassigned and the vendors", () => {
    mode = "data";
    memory.clear();
    const html = render("whatsapp", "admin");
    expect(html).toContain('<option value="automatic"');
    expect(html).toContain('<option value="unassigned">Unassigned</option>');
    expect(html).toContain('<option value="9">Kraftyz</option>');
  });
});

describe("Assigned to with an inactive vendor", () => {
  test("not offered for new choices", () => {
    mode = "data";
    memory.clear();
    const html = render("whatsapp", "admin");
    expect(html).toContain('<option value="9">Kraftyz</option>');
    expect(html).not.toContain("Old Vendor");
  });
  test("a lead already assigned to it keeps its name: selected but disabled for admins, the read-only chip for view-only logins", () => {
    mode = "data";
    memory.clear();
    const saved = ROW.crm;
    ROW.crm = { ...saved, vendor: { id: 7, name: "Old Vendor" }, vendor_source: "manual" };
    try {
      const adminHtml = render("whatsapp", "admin");
      expect(adminHtml).toMatch(/<option value="7" disabled="" selected="">Old Vendor \(inactive\)<\/option>/);
      expect(render("whatsapp", "viewer")).toContain(">Old Vendor</span>");
    } finally {
      ROW.crm = saved;
    }
  });
});
