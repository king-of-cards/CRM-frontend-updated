import { describe, expect, test } from "bun:test";
import {
  ROLE_LABELS,
  VIEW_ONLY_MESSAGE,
  canEdit,
  canManage,
  canSeeDhruva,
  isViewOnlyError,
  isViewer,
  navFor,
  redirectFor,
  roleLabel,
  seesAdminData,
} from "./permissions.js";

const admin = { role: "admin" };
const viewer = { role: "viewer", vendor: null };
const vendor = { role: "vendor", vendor: { id: 3, name: "Phodeo" } };
const unlinkedVendor = { role: "vendor", vendor: null };
const dhruva = { role: "dhruva" };

describe("role flags", () => {
  test("only viewers are view-only", () => {
    expect(isViewer(viewer)).toBe(true);
    for (const user of [admin, vendor, dhruva, null]) expect(isViewer(user)).toBe(false);
  });
  test("canEdit: everyone logged in except viewers", () => {
    expect(canEdit(admin)).toBe(true);
    expect(canEdit(vendor)).toBe(true);
    expect(canEdit(dhruva)).toBe(true);
    expect(canEdit(viewer)).toBe(false);
    expect(canEdit(null)).toBe(false);
  });
  test("viewers see admin data; vendors and Dhruva logins don't", () => {
    expect(seesAdminData(admin)).toBe(true);
    expect(seesAdminData(viewer)).toBe(true);
    expect(seesAdminData(vendor)).toBe(false);
    expect(seesAdminData(dhruva)).toBe(false);
    expect(seesAdminData(null)).toBe(false);
  });
  test("only admins manage Team, Settings and Branches", () => {
    expect(canManage(admin)).toBe(true);
    for (const user of [viewer, vendor, dhruva, null]) expect(canManage(user)).toBe(false);
  });
  test("labels", () => {
    expect(roleLabel("viewer")).toBe("View only");
    expect(Object.values(ROLE_LABELS)).toEqual(["Admin", "Vendor", "Dhruva", "View only"]);
    expect(roleLabel("other")).toBe("other");
    expect(roleLabel(undefined)).toBe("");
  });
});

describe("redirectFor (route guard)", () => {
  test("viewers are sent to the dashboard from Team, Settings and Branches only", () => {
    for (const path of ["/users", "/settings", "/branches"]) expect(redirectFor(viewer, path)).toBe("/dashboard");
  });
  test("viewers open the dashboard, every lead section and Explore all fields", () => {
    for (const path of ["/dashboard", "/leads/spin", "/leads/international", "/leads/wedding", "/leads/wedding-planner", "/vendor-to-koc", "/dhruva-leads", "/koc-to-dhruva", "/leads"]) {
      expect(redirectFor(viewer, path)).toBeNull();
    }
  });
  test("admins and vendors are unchanged", () => {
    for (const path of ["/users", "/settings", "/branches", "/leads", "/dashboard"]) expect(redirectFor(admin, path)).toBeNull();
    expect(redirectFor(vendor, "/settings")).toBeNull();
  });
  test("Dhruva logins stay on their dashboard and list", () => {
    expect(redirectFor(dhruva, "/dashboard")).toBeNull();
    expect(redirectFor(dhruva, "/dhruva-leads")).toBeNull();
    expect(redirectFor(dhruva, "/koc-to-dhruva")).toBeNull();
    expect(redirectFor(dhruva, "/leads/spin")).toBe("/dashboard?flow=dhruva");
  });
  test("vendors never open the Dhruva flow's lists: sent to their dashboard", () => {
    for (const user of [vendor, unlinkedVendor]) {
      expect(redirectFor(user, "/dhruva-leads")).toBe("/dashboard");
      expect(redirectFor(user, "/koc-to-dhruva")).toBe("/dashboard");
    }
    expect(redirectFor(admin, "/koc-to-dhruva")).toBeNull();
  });
  test("the Dhruva flow: everyone but vendors", () => {
    for (const user of [admin, viewer, dhruva]) expect(canSeeDhruva(user)).toBe(true);
    for (const user of [vendor, unlinkedVendor, null]) expect(canSeeDhruva(user)).toBe(false);
  });
  test("logged out: login", () => {
    expect(redirectFor(null, "/dashboard")).toBe("/login");
  });
});

describe("navFor (role-based visibility)", () => {
  test("viewer: flow toggle and View only badge; no Team, Settings or bell", () => {
    expect(navFor(viewer)).toEqual({ team: false, settings: false, bell: false, flowToggle: true, dhruvaFlow: true, viewOnlyBadge: true });
  });
  test("admin: everything except the badge", () => {
    expect(navFor(admin)).toEqual({ team: true, settings: true, bell: true, flowToggle: true, dhruvaFlow: true, viewOnlyBadge: false });
  });
  test("vendor: Settings, bell and toggle when linked; no Team, never the Dhruva flow", () => {
    expect(navFor(vendor)).toEqual({ team: false, settings: true, bell: true, flowToggle: true, dhruvaFlow: false, viewOnlyBadge: false });
    expect(navFor(unlinkedVendor)).toMatchObject({ bell: false, flowToggle: false, dhruvaFlow: false, settings: true });
  });
  test("Dhruva: none of them (only their own flow)", () => {
    expect(navFor(dhruva)).toEqual({ team: false, settings: false, bell: false, flowToggle: false, dhruvaFlow: true, viewOnlyBadge: false });
  });
});

describe("isViewOnlyError", () => {
  test("the API's view-only 403", () => {
    expect(isViewOnlyError({ status: 403, detail: VIEW_ONLY_MESSAGE })).toBe(true);
    expect(isViewOnlyError({ status: 403, message: VIEW_ONLY_MESSAGE })).toBe(true);
  });
  test("other 403s and other statuses are not", () => {
    expect(isViewOnlyError({ status: 403, detail: "Admins only" })).toBe(false);
    expect(isViewOnlyError({ status: 400, detail: VIEW_ONLY_MESSAGE })).toBe(false);
    expect(isViewOnlyError(null)).toBe(false);
    expect(isViewOnlyError({ status: 403, detail: [{ msg: "x" }] })).toBe(false);
  });
});
