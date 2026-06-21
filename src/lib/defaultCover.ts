import asset from "@/assets/default-cover.jpg.asset.json";

/** غلاف افتراضي يُستخدم عند غياب صورة غلاف للقالب */
export const DEFAULT_COVER_URL: string = asset.url;

export function coverUrlOrDefault(url: string | null | undefined): string {
  return url && url.trim().length > 0 ? url : DEFAULT_COVER_URL;
}
