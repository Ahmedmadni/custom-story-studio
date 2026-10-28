import { describe, expect, it } from "bun:test";
import { allocateDiscount, rewardDiscount } from "../src/features/rewards/redemption";
import { pricePerPages, PRINT_COPY_PRICE_EGP } from "../src/features/cart/pricing";

describe("Story reward redemption", () => {
  it("exchanges exactly 100 points for 25 EGP", () => {
    expect(rewardDiscount(100, 150)).toBe(25);
    expect(rewardDiscount(0, 150)).toBe(0);
    expect(() => rewardDiscount(99, 150)).toThrow();
    expect(() => rewardDiscount(200, 150)).toThrow();
  });
  it("cannot exceed the story amount after other discounts", () => {
    expect(() => rewardDiscount(100, 24)).toThrow();
    expect(rewardDiscount(100, 25)).toBe(25);
  });
  it("preserves library prices of 150 and 200 EGP", () => {
    expect(pricePerPages(10, false)).toBe(150);
    expect(pricePerPages(16, false)).toBe(200);
  });
  it("preserves custom prices of 200 and 250 EGP", () => {
    expect(pricePerPages(10, true)).toBe(200);
    expect(pricePerPages(16, true)).toBe(250);
  });
  it("does not discount the 200 EGP print addition", () => {
    expect(pricePerPages(10, false) - rewardDiscount(100, 150) + PRINT_COPY_PRICE_EGP).toBe(325);
  });
  it("allocates exact discounts and refundable points across multiple orders", () => {
    const shares = allocateDiscount([135, 180, 225], 25);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(25);
    expect(shares.map((share) => share * 4).reduce((sum, points) => sum + points, 0)).toBe(100);
    expect(allocateDiscount([1, 1, 1, 1], 3)).toEqual([1, 1, 1, 0]);
    expect(allocateDiscount([0, 25], 25)).toEqual([0, 25]);
    expect(() => allocateDiscount([10], 11)).toThrow();
  });
});