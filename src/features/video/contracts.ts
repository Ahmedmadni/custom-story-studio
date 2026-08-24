import { z } from "zod";

import { ASPECT_RATIOS, type AspectRatio } from "@/features/ai/storyStyle";

export const VIDEO_PRODUCT_TYPES = ["illustrated_story", "personalized_video"] as const;
export const VIDEO_PROJECT_STATUSES = [
  "awaiting_payment",
  "paid",
  "approved",
  "processing",
  "ready",
  "failed",
  "cancelled",
] as const;
export const VIDEO_PRODUCTION_STAGES = [
  "image_generation",
  "image_review",
  "script_generation",
  "script_review",
  "video_generation",
  "quality_review",
  "final_render",
] as const;
export const VIDEO_JOB_TYPES = [
  "reference_image",
  "script",
  "scene_clip",
  "narration",
  "compose",
  "final_render",
] as const;
export const VIDEO_JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "dead_letter",
] as const;
export const VIDEO_RENDER_TYPES = ["preview", "final"] as const;
export const VIDEO_DELIVERY_STATUSES = ["pending", "delivered"] as const;
export const VIDEO_PAYMENT_STATUSES = ["unpaid", "pending", "paid", "failed", "refunded"] as const;
export const VIDEO_ORDER_STATUSES = ["submitted", "confirmed", "cancelled"] as const;
export const VIDEO_SCENE_STATUSES = [
  "draft",
  "queued",
  "generating",
  "review",
  "approved",
  "failed",
] as const;
export const VIDEO_LANGUAGES = ["ar", "en", "bilingual"] as const;

export const videoProductTypeSchema = z.enum(VIDEO_PRODUCT_TYPES);
export const videoProjectStatusSchema = z.enum(VIDEO_PROJECT_STATUSES);
export const videoProductionStageSchema = z.enum(VIDEO_PRODUCTION_STAGES);
export const videoJobTypeSchema = z.enum(VIDEO_JOB_TYPES);
export const videoJobStatusSchema = z.enum(VIDEO_JOB_STATUSES);
export const videoRenderTypeSchema = z.enum(VIDEO_RENDER_TYPES);
export const videoDeliveryStatusSchema = z.enum(VIDEO_DELIVERY_STATUSES);
export const videoPaymentStatusSchema = z.enum(VIDEO_PAYMENT_STATUSES);
export const videoOrderStatusSchema = z.enum(VIDEO_ORDER_STATUSES);
export const videoSceneStatusSchema = z.enum(VIDEO_SCENE_STATUSES);
export const videoLanguageSchema = z.enum(VIDEO_LANGUAGES);
export const videoAspectRatioSchema: z.ZodType<AspectRatio> = z.enum(ASPECT_RATIOS);

export type VideoProductType = z.infer<typeof videoProductTypeSchema>;
export type VideoProjectStatus = z.infer<typeof videoProjectStatusSchema>;
export type VideoProductionStage = z.infer<typeof videoProductionStageSchema>;
export type VideoJobType = z.infer<typeof videoJobTypeSchema>;
export type VideoJobStatus = z.infer<typeof videoJobStatusSchema>;
export type VideoRenderType = z.infer<typeof videoRenderTypeSchema>;
export type VideoDeliveryStatus = z.infer<typeof videoDeliveryStatusSchema>;
export type VideoPaymentStatus = z.infer<typeof videoPaymentStatusSchema>;
export type VideoOrderStatus = z.infer<typeof videoOrderStatusSchema>;
export type VideoSceneStatus = z.infer<typeof videoSceneStatusSchema>;
export type VideoLanguage = z.infer<typeof videoLanguageSchema>;

export const MAX_VIDEO_DURATION_MS = 60_000;
