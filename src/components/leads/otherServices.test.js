import { describe, expect, test } from "bun:test";
import { GIFT_SERVICE, isGiftService, otherServiceOptions, servicesOf } from "./otherServices.js";

describe("Other wedding services (docs section 17)", () => {
  test("comma-separated text -> chips: trimmed, no empties, repeats once", () => {
    expect(servicesOf("Photography, Wedding Gifts & Return Gifts ,, photography")).toEqual(["Photography", "Wedding Gifts & Return Gifts"]);
    expect(servicesOf("")).toEqual([]);
    expect(servicesOf(null)).toEqual([]);
    expect(servicesOf(["Decor", " Catering "])).toEqual(["Decor", "Catering"]);
  });
  test("the gift service is recognised in any case and spacing", () => {
    expect(isGiftService(GIFT_SERVICE)).toBe(true);
    expect(isGiftService("wedding gifts  &  return gifts")).toBe(true);
    expect(isGiftService(" WEDDING GIFTS & RETURN GIFTS ")).toBe(true);
    expect(isGiftService("Photography")).toBe(false);
  });
  test("filter options keep the API's order and show counts", () => {
    expect(otherServiceOptions([{ value: "Wedding Gifts & Return Gifts", count: 144 }, { value: "Photography", count: 12 }, { value: "", count: 3 }, { value: "Decor" }])).toEqual([
      { value: "Wedding Gifts & Return Gifts", label: "Wedding Gifts & Return Gifts (144)" },
      { value: "Photography", label: "Photography (12)" },
      { value: "Decor", label: "Decor" },
    ]);
    expect(otherServiceOptions(undefined)).toEqual([]);
  });
});
