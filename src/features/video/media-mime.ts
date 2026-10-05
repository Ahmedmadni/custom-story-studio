export type VideoUploadMime = "video/mp4" | "video/webm" | "video/quicktime";
export type AudioUploadMime =
  | "audio/mpeg"
  | "audio/wav"
  | "audio/x-wav"
  | "audio/ogg"
  | "audio/webm"
  | "audio/mp4";

function baseMime(value: string) {
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function normalizeVideoUploadMime(file: Pick<File, "type" | "name">): VideoUploadMime {
  const type = baseMime(file.type);
  if (type === "video/mp4" || type === "video/webm" || type === "video/quicktime") {
    return type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "webm") return "video/webm";
  if (extension === "mov") return "video/quicktime";
  if (extension === "mp4" || extension === "m4v") return "video/mp4";

  throw new Error("صيغة الفيديو غير مدعومة. استخدم MP4 أو WebM أو MOV");
}

export function normalizeAudioUploadMime(file: Pick<File, "type" | "name">): AudioUploadMime {
  const type = baseMime(file.type);
  if (
    type === "audio/mpeg" ||
    type === "audio/wav" ||
    type === "audio/x-wav" ||
    type === "audio/ogg" ||
    type === "audio/webm" ||
    type === "audio/mp4"
  ) {
    return type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "wav") return "audio/wav";
  if (extension === "ogg" || extension === "oga") return "audio/ogg";
  if (extension === "webm") return "audio/webm";
  if (extension === "m4a" || extension === "mp4" || extension === "aac") return "audio/mp4";

  throw new Error("صيغة التعليق الصوتي غير مدعومة");
}
