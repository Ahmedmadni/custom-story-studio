import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/siteUrl";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /admin",
          "Disallow: /checkout",
          "Disallow: /my-orders",
          "Disallow: /my-children",
          "Disallow: /children/",
          "Disallow: /rewards",
          "Disallow: /referrals",
          "Disallow: /favorites",
          "Disallow: /order/",
          "Disallow: /story/",
          "Disallow: /payment/return",
          `Sitemap: ${SITE_URL}/sitemap.xml`,
        ].join("\n");

        return new Response(body, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
