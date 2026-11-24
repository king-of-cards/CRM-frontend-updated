import { describe, expect, test } from "bun:test";
import { editFormOf, editProblem, emailConfirmed, userChanges, vendorChoices } from "./teamUtils.js";
import { apiErrorText } from "../api/errors.js";

const vendorLogin = { id: 7, name: "Ravi", email: "ravi@x.in", role: "vendor", vendor_id: 2 };
const admin = { id: 1, name: "Asha", email: "asha@x.in", role: "admin", vendor_id: null };

describe("userChanges", () => {
  test("nothing changed: empty body", () => {
    expect(userChanges(editFormOf(vendorLogin), vendorLogin)).toEqual({});
  });
  test("only what changed; password only when typed", () => {
    const form = { ...editFormOf(vendorLogin), name: " Ravi K ", password: "longenough" };
    expect(userChanges(form, vendorLogin)).toEqual({ name: "Ravi K", password: "longenough" });
  });
  test("vendor change sends vendor_id; leaving vendor sends the role only", () => {
    expect(userChanges({ ...editFormOf(vendorLogin), vendor_id: "5" }, vendorLogin)).toEqual({ vendor_id: 5 });
    expect(userChanges({ ...editFormOf(vendorLogin), role: "viewer" }, vendorLogin)).toEqual({ role: "viewer" });
  });
  test("becoming a vendor sends role and vendor_id", () => {
    expect(userChanges({ ...editFormOf(admin), role: "vendor", vendor_id: "3" }, admin)).toEqual({ role: "vendor", vendor_id: 3 });
  });
  test("your own login never sends a role", () => {
    expect(userChanges({ ...editFormOf(admin), role: "viewer", name: "Asha R" }, admin, { own: true })).toEqual({ name: "Asha R" });
  });
});

describe("editProblem", () => {
  test("short password and missing vendor", () => {
    expect(editProblem({ ...editFormOf(admin), password: "short" }, admin)).toMatch(/8 characters/);
    expect(editProblem({ ...editFormOf(admin), role: "vendor" }, admin)).toMatch(/vendor/);
    expect(editProblem(editFormOf(admin), admin)).toBe("");
  });
});

describe("emailConfirmed", () => {
  test("any case, spaces ignored; anything else no", () => {
    expect(emailConfirmed(" RAVI@x.in ", "ravi@x.in")).toBe(true);
    expect(emailConfirmed("ravi@x", "ravi@x.in")).toBe(false);
    expect(emailConfirmed("", "")).toBe(false);
  });
});

describe("vendorChoices", () => {
  const vendors = [{ id: 1, name: "A", is_active: true }, { id: 2, name: "B", is_active: false }, { id: 3, name: "C" }];
  test("inactive vendors are hidden", () => {
    expect(vendorChoices(vendors, "").map((v) => v.id)).toEqual(["1", "3"]);
  });
  test("a current inactive vendor shows, disabled", () => {
    expect(vendorChoices(vendors, 2)).toContainEqual({ id: "2", name: "B", disabled: true });
  });
});

describe("apiErrorText", () => {
  test("shows the API's text as returned", () => {
    expect(apiErrorText({ status: 409, detail: "Email already registered" })).toBe("Email already registered");
    expect(apiErrorText({ status: 400, detail: "You can't change your own role" })).toBe("You can't change your own role");
    expect(apiErrorText({ status: 422, detail: { message: "Please fix the highlighted fields.", errors: [{ field: "email", message: "Not a valid email address" }] } }))
      .toBe("Please fix the highlighted fields. Not a valid email address");
    expect(apiErrorText({ status: 422, detail: [{ loc: ["body", "password"], msg: "String should have at least 8 characters" }] }))
      .toBe("password: String should have at least 8 characters");
  });
});
