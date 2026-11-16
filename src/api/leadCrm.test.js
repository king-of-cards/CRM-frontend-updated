import { describe, expect, test } from "bun:test";
import { PENDING_UPDATE, UPDATE_OPTIONS, updateInfo } from "./leadCrm.js";
import { STATUSES } from "../components/vendorToKoc/kocUtils.js";

describe("Update (replaces Interest / Converted)", () => {
  test("the same 7 values and labels as Vendors → KOC, in the same order", () => {
    expect(UPDATE_OPTIONS.map((o) => [o.value, o.label])).toEqual(STATUSES.map((s) => [s.value, s.label]));
  });
  test("null, empty and 'pending' are Pending", () => {
    for (const v of [null, undefined, "", "pending"]) expect(updateInfo(v)).toBe(PENDING_UPDATE);
    expect(PENDING_UPDATE.label).toBe("Pending");
  });
  test("labels", () => {
    expect(updateInfo("will_call_back").label).toBe("Will call back");
    expect(updateInfo("purchased_elsewhere").label).toBe("Already purchased somewhere else");
  });
});
