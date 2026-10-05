import { describe, expect, it } from "bun:test";

import { toCustomerVideoStatus } from "../src/features/video/customer-status";

describe("Kidzy Video customer status", () => {
  it("prioritizes cancellation over every other state", () => {
    expect(
      toCustomerVideoStatus({
        paymentStatus: "paid",
        orderStatus: "cancelled",
        deliveryStatus: "delivered",
        projectStatus: "ready",
      }),
    ).toBe("cancelled");
  });

  it("shows payment_issue for a rejected receipt before production starts", () => {
    expect(
      toCustomerVideoStatus({
        paymentStatus: "failed",
        orderStatus: "submitted",
        deliveryStatus: "pending",
        projectStatus: "awaiting_payment",
      }),
    ).toBe("payment_issue");
  });

  it("never exposes internal production stages to the customer", () => {
    expect(
      toCustomerVideoStatus({
        paymentStatus: "paid",
        orderStatus: "confirmed",
        deliveryStatus: "pending",
        projectStatus: "processing",
      }),
    ).toBe("in_production");
  });

  it("returns delivered only when delivery itself is complete", () => {
    expect(
      toCustomerVideoStatus({
        paymentStatus: "paid",
        orderStatus: "ready",
        deliveryStatus: "delivered",
        projectStatus: "ready",
      }),
    ).toBe("delivered");
  });
});
