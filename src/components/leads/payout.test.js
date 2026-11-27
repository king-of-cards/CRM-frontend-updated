import { describe, expect, test } from "bun:test";
import { cleanPercent, parsePercent, payoutAmount, payoutText, payoutValues, percentError } from "./payout.js";
import { canEdit, panelChanges } from "./crmAccess.js";
import { copyChanges } from "./leadVendors.js";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

describe("payout (commission as a % of the conversion amount)", () => {
  test("amount = conversion × % ÷ 100, rounded; nothing without both", () => {
    expect(payoutAmount(40000, 10)).toBe(4000);
    expect(payoutAmount(50000, 7.5)).toBe(3750);
    expect(payoutAmount(33333, 10)).toBe(3333);
    expect(payoutAmount(null, 10)).toBeNull();
    expect(payoutAmount(40000, null)).toBeNull();
    expect(payoutAmount(40000, 0)).toBeNull();
  });
  test("the % box: digits, one dot, up to 3 + 2 digits; 0–100", () => {
    expect(cleanPercent("12.345a")).toBe("12.34");
    expect(cleanPercent("1000")).toBe("100");
    expect(parsePercent("")).toBeNull();
    expect(parsePercent("7.5")).toBe(7.5);
    expect(percentError("150")).toContain("between 0 and 100");
    expect(percentError("10")).toBe("");
  });
  test("a save sends the % and the rupees it works out to", () => {
    expect(payoutValues("40,000", "10")).toEqual({ payout_percent: 10, payout_amount: 4000 });
    expect(payoutValues("", "10")).toEqual({ payout_percent: 10, payout_amount: null });
    expect(payoutValues("40000", "")).toEqual({ payout_percent: null, payout_amount: null });
  });
  test("read-only text", () => {
    expect(payoutText(4000, 10, inr)).toBe(`${inr.format(4000)} (10%)`);
    expect(payoutText(null, null, inr)).toBeNull();
  });
  test("admins only: vendors' saves never carry the payout", () => {
    expect(canEdit(true, "payout_percent")).toBe(true);
    expect(canEdit(false, "payout_percent")).toBe(false);
    const before = { conversion_amount: 40000, payout_percent: null, payout_amount: null };
    const after = { conversion_amount: 40000, payout_percent: 10, payout_amount: 4000 };
    expect(panelChanges(true, before, after)).toEqual({ payout_percent: 10, payout_amount: 4000 });
    expect(panelChanges(false, before, after)).toEqual({});
  });
  test("a vendor copy's form includes the payout", () => {
    const copy = { conversion_amount: 40000, payout_percent: null };
    expect(copyChanges(copy, { conversion_amount: "40000", payout_percent: "10", update_status: "", follow_up_date: "", notes: "", quoted_amount: "", quoted_date: "" })).toEqual({ payout_percent: 10, payout_amount: 4000 });
  });
});
