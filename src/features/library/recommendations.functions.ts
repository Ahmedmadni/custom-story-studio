import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

const Input = z.object({
  excludeTemplateId: z.string().uuid().nullable().optional(),
  category: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(20).default(8),
});

export const getRecommendedStories = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    let q = sb
      .from("story_templates")
      .select("id, slug, title, summary, category, age_range, cover_url")
      .eq("is_published", true)
      .eq("is_custom", false)
      .eq("content_type", "story")
      .limit(data.limit);

    if (data.category) q = q.eq("category", data.category);
    if (data.excludeTemplateId) q = q.neq("id", data.excludeTemplateId);

    const { data: rows } = await q;
    let list = rows ?? [];

    // fallback: لو ما فيش نتائج في نفس التصنيف، ارجع للأحدث عموماً
    if (list.length === 0) {
      const { data: fb } = await sb
        .from("story_templates")
        .select("id, slug, title, summary, category, age_range, cover_url")
        .eq("is_published", true)
        .eq("is_custom", false)
        .eq("content_type", "story")
        .order("created_at", { ascending: false })
        .limit(data.limit);
      list = fb ?? [];
    }
    return list;
  });
