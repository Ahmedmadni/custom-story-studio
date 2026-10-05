import { describe, expect, it } from "bun:test";

import {
  videoDeliveredEmail,
  videoOrderReceivedEmail,
  videoPaymentConfirmedEmail,
  videoPaymentIssueEmail,
} from "../src/features/notifications/videoEmailTemplates";

describe("Kidzy Video email templates", () => {
  it("links all customer actions to the private my-videos page", () => {
    const templates = [
      videoOrderReceivedEmail({ childName: "آدم", storyTitle: "رحلة آدم", priceEgp: 250 }),
      videoPaymentConfirmedEmail({
        childName: "آدم",
        storyTitle: "رحلة آدم",
        expectedDeliveryAt: "2026-10-07T10:00:00.000Z",
      }),
      videoPaymentIssueEmail({
        childName: "آدم",
        storyTitle: "رحلة آدم",
        reason: "الصورة غير واضحة",
      }),
      videoDeliveredEmail({ childName: "آدم", storyTitle: "رحلة آدم" }),
    ];

    for (const template of templates) {
      expect(template.html).toContain("/my-videos");
      expect(template.subject.length).toBeGreaterThan(5);
    }
  });

  it("escapes customer-controlled values before inserting them into HTML", () => {
    const template = videoPaymentIssueEmail({
      childName: '<img src=x onerror="alert(1)">',
      storyTitle: "<script>alert(1)</script>",
      reason: "<b>unsafe</b>",
    });

    expect(template.html).not.toContain("<script>");
    expect(template.html).not.toContain("<img src=x");
    expect(template.html).not.toContain("<b>unsafe</b>");
    expect(template.html).toContain("&lt;script&gt;");
  });
});
