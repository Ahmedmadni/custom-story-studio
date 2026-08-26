import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";
import type { VideoStoryboard } from "@/features/video/video-production-core";

/** Reconciles only draft/no-media scenes. Generated media requires an explicit rebuild flow. */
export async function reconcileVideoStoryboardScenes(
  admin: SupabaseClient<Database>,
  projectId: string,
  storyboard: VideoStoryboard,
) {
  const { data: current, error } = await admin
    .from("video_scenes")
    .select("*")
    .eq("project_id", projectId);
  if (error) throw new Error("تعذر فحص المشاهد الحالية");
  if (
    (current ?? []).some(
      (scene) => scene.clip_path || scene.audio_path || scene.selected_image_path,
    )
  )
    throw new Error("توجد أصول مولدة؛ يلزم إجراء إعادة بناء صريح قبل استبدال لوحة المشاهد");
  const rows = storyboard.scenes.map((scene) => ({
    project_id: projectId,
    scene_number: scene.sequence,
    narration_text: scene.narration,
    visual_prompt: scene.visual_prompt,
    duration_ms: scene.duration_seconds * 1_000,
    status: "draft" as const,
    approved_at: null,
    approved_by: null,
    selected_asset_meta: { title: scene.title, motion_prompt: scene.motion_prompt } as Json,
  }));
  const { error: upsertError } = await admin
    .from("video_scenes")
    .upsert(rows, { onConflict: "project_id,scene_number" });
  if (upsertError) throw new Error("تعذر إنشاء مشاهد لوحة القصة");
  const keep = rows.map((row) => row.scene_number);
  if (current?.some((scene) => !keep.includes(scene.scene_number))) {
    const { error: deleteError } = await admin
      .from("video_scenes")
      .delete()
      .eq("project_id", projectId)
      .not("scene_number", "in", `(${keep.join(",")})`);
    if (deleteError) throw new Error("تعذر حذف المشاهد المسودة الزائدة");
  }
}
