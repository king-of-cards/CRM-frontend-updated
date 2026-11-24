import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../auth/context.js";
import { listOrNull, rowMenuItems } from "./teamUtils.js";
import { RowMenu, StatusCell } from "./Users.jsx";
import Users from "./Users.jsx";
import { pagesFor, pageLoaders } from "../routeLoaders.js";

// Team page (docs section 12): Status is a control, the ⋯ menu has Edit and Remove only, and the
// vendors are a section below the members (the Vendors sidebar item and page are gone).

const ME = { id: 1, role: "admin", name: "Admin User", email: "admin@example.in" };
const OTHER = { id: 2, role: "vendor", name: "Ravi", email: "ravi@example.in", is_active: true, vendor_id: 9 };
const auth = {
  user: ME, isAdmin: true, isViewer: false, canEdit: true, seesAll: true, isVendor: false, isDhruva: false,
  vendor: null, canSeeLeads: true, isReady: true, login: async () => {}, logout: async () => {},
};

describe("Status: Active / Blocked control", () => {
  test("another login: a select with the two choices, the current one chosen", () => {
    const html = renderToString(<StatusCell user={OTHER} editable onSaved={() => {}} />);
    expect(html).toContain('aria-label="Status of Ravi"');
    expect(html).toMatch(/<option value="active" selected="">Active<\/option>/);
    expect(html).toContain('<option value="blocked">Blocked</option>');
    const blocked = renderToString(<StatusCell user={{ ...OTHER, is_active: false }} editable onSaved={() => {}} />);
    expect(blocked).toMatch(/<option value="blocked" selected="">Blocked<\/option>/);
  });
  test("your own row (or a non-admin): a chip, no control", () => {
    const html = renderToString(<StatusCell user={{ ...ME, is_active: true }} editable={false} onSaved={() => {}} />);
    expect(html).not.toContain("<select");
    expect(html).toContain("Active");
  });
});

describe("⋯ menu: Edit and Remove, no Block / Unblock", () => {
  test("other logins: Edit and Remove; your own: Edit only", () => {
    expect(rowMenuItems()).toEqual(["edit", "remove"]);
    expect(rowMenuItems({ own: true })).toEqual(["edit"]);
    expect([...rowMenuItems(), ...rowMenuItems({ own: true })]).not.toContain("block");
  });
  test("the closed menu is one button", () => {
    const html = renderToString(<RowMenu user={OTHER} own={false} onEdit={() => {}} onRemove={() => {}} />);
    expect(html).toContain('aria-label="Actions for Ravi"');
    expect(html).not.toContain("Block");
  });
});

describe("Team page: members, then vendors", () => {
  const html = renderToString(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/users"]}>
        <Users />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  test("both sections, members first", () => {
    expect(html).toContain("Team members");
    expect(html).toContain('id="vendors-title"');
    expect(html).toContain("Add vendor");
    expect(html.indexOf("Team members")).toBeLessThan(html.indexOf('id="vendors-title"'));
  });
  test("the sidebar has no Vendors item", () => {
    expect(html).not.toContain('href="/vendors"');
    expect(html).toContain('href="/users"');
  });
  test("no spinners", () => {
    expect(html).not.toContain("animate-spin");
  });
  test("cached answers only count when they are lists", () => {
    expect(listOrNull([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(listOrNull({ items: [] })).toBeNull();
    expect(listOrNull(undefined)).toBeNull();
  });
});

describe("route preloading (hovered menu links)", () => {
  test("paths map to their pages; /vendors opens Team", () => {
    expect(pagesFor("/users")).toEqual(["users"]);
    expect(pagesFor("/vendors")).toEqual(["users"]);
    expect(pagesFor("/dashboard?flow=vendors")).toEqual(["dashboard"]);
    expect(pagesFor("/leads/spin")).toEqual(["leadSource", "recentLeads"]);
    expect(pagesFor("/nowhere")).toEqual([]);
  });
  test("every mapped page has a loader", () => {
    for (const path of ["/dashboard", "/leads", "/settings", "/users", "/branches", "/leads/spin", "/leads/international", "/leads/wedding", "/leads/wedding-planner", "/vendor-to-koc", "/dhruva-leads", "/koc-to-dhruva"]) {
      for (const key of pagesFor(path)) expect(typeof pageLoaders[key]).toBe("function");
    }
  });
});
