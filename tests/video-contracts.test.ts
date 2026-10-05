import { describe, expect, it } from "bun:test";

import { videoOrderInputSchema } from "../src/features/video/contracts";

const baseOrder = {
  templateId: "11111111-1111-4111-8111-111111111111",
  childId: null,
  childName: "Kidzy",
  childAge: 7,
  childGender: "boy" as const,
  childPhotoPath: "11111111-1111-4111-8111-111111111111/child-photo.jpg",
  paymentReceiptPath: "11111111-1111-4111-8111-111111111111/payment-receipt.jpg",
  aiProcessingConsent: true as const,
  language: "ar" as const,
};

describe("Kidzy Video launch aspect ratios", () => {
  it("accepts the supported 16:9 and 9:16 formats", () => {
    expect(videoOrderInputSchema.safeParse({ ...baseOrder, aspectRatio: "16:9" }).success).toBe(
      true,
    );
    expect(videoOrderInputSchema.safeParse({ ...baseOrder, aspectRatio: "9:16" }).success).toBe(
      true,
    );
  });

  it("rejects square video orders until the production provider supports them", () => {
    expect(videoOrderInputSchema.safeParse({ ...baseOrder, aspectRatio: "1:1" }).success).toBe(
      false,
    );
  });
});

describe("Kidzy Video child-image consent", () => {
  it("rejects an order when explicit processing consent is missing or false", () => {
    const { aiProcessingConsent: _consent, ...withoutConsent } = baseOrder;

    expect(
      videoOrderInputSchema.safeParse({ ...withoutConsent, aspectRatio: "16:9" }).success,
    ).toBe(false);
    expect(
      videoOrderInputSchema.safeParse({
        ...baseOrder,
        aiProcessingConsent: false,
        aspectRatio: "16:9",
      }).success,
    ).toBe(false);
  });
});
