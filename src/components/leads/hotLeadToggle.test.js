import { describe, expect, test } from "bun:test";
import { toggleHotOptimistically } from "./hotLeadToggle.js";

describe("optimistic hot lead toggle", () => {
  test("sets the optimistic value and keeps the server confirmation", async () => {
    const values = [];
    const result = await toggleHotOptimistically(false, async (value) => {
      expect(value).toBe(true);
      return { is_hot: true };
    }, (value) => values.push(value));
    expect(values).toEqual([true, true]);
    expect(result).toBe(true);
  });

  test("rolls back to the previous value when saving fails", async () => {
    const values = [];
    await expect(toggleHotOptimistically(true, async () => {
      throw new Error("offline");
    }, (value) => values.push(value))).rejects.toThrow("offline");
    expect(values).toEqual([false, true]);
  });
});
