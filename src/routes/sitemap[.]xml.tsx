import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/siteUrl";

const STATIC_PATHS = [
  "",
  "stories",
  "books",
  "games",
  "puzzles",
  "help",
  "privacy",
  "terms",
  "refund-policy",
  "contact",
];

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** خريطة موقع XML ديناميكية: الصفحات الثابتة + كل قصة/كتاب منشور. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: templates } = await supabaseAdmin
          .from("story_templates")
          .select("slug, updated_at")
          .eq("is_published", true);

        const staticUrls = STATIC_PATHS.map(
          (p) => `<url><loc>${xmlEscape(`${SITE_URL}/${p}`)}</loc></url>`,
        );
        const storyUrls = (templates ?? []).map(
          (t) =>
            `<url><loc>${xmlEscape(`${SITE_URL}/stories/${t.slug}`)}</loc><lastmod>${new Date(
              t.updated_at as string,
            ).toISOString()}</lastmod></url>`,
        );

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
          ...staticUrls,
          ...storyUrls,
        ].join("\n")}\n</urlset>`;

        return new Response(xml, {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
