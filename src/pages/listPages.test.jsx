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
  reason: "budget", reason_label: "Budget ≥ ₹70", quantity_required: 1200, estimated_budget_per_card: "70-100",
  received: "2026-11-20T10:00:00Z", update_status: "interested", is_hot: true, origin: "workflow",
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
  origins: [{ value: "workflow", count: 1 }], vendors: [{ id: 9, name: "Kraftyz" }], occasions: [{ value: "Wedding", count: 1 }],
  reasons: [{ value: "budget", count: 1 }], event_types: [{ value: "Wedding", count: 1 }], last_steps: [], shared_with: [],
  quantity_range: { min: 1000, max: 5000 },
  sources: [], // GET /sheets/sources (sheet sync status)
};

let mode = "empty"; // "empty": nothing loaded yet; "data": every request has ANSWER
const memory = new Map();
const storage = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };

let PAGES;
beforeAll(async () => {
  globalThis.sessionStorage = storage;
  globalThis.localStorage = storage;
  const real = await import("../api/client.js");
  mock.module("../api/client.js", () => ({
    ...real,
    // Per path: the vendor list is an array, the sheet status { sources }, the rest ANSWER
    peek: (path) => (mode !== "data" ? undefined : String(path).startsWith("/vendors") ? ANSWER.vendors : ANSWER),
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
});
