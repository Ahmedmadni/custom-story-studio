export const KIDZY_VIDEO_LOGO_URL =
  "/__l5e/assets-v1/1e7314e6-8461-4a53-950f-6e2cc3fcb54b/kidzy-logo.png";

export type SupportedVideoAspectRatio = "16:9" | "9:16";

export function finalCanvasSize(aspectRatio: string) {
  if (aspectRatio === "16:9") return { width: 1280, height: 720 };
  if (aspectRatio === "9:16") return { width: 720, height: 1280 };
  throw new Error("صيغة الفيديو النهائية غير مدعومة");
}

export function coverRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error("أبعاد الفيديو غير صالحة");
  }
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

function bestRecorderMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

async function fetchPrivateBlob(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("تعذر تحميل أحد مقاطع الفيديو المعتمدة");
  return response.blob();
}

async function imageFromUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("تعذر تحميل شعار كيدزي");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  await image.decode();
  return {
    image,
    dispose: () => URL.revokeObjectURL(objectUrl),
  };
}

async function videoFromBlob(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.preload = "auto";
  video.playsInline = true;
  video.muted = true;
  video.src = objectUrl;

  await new Promise<void>((resolve, reject) => {
    const ready = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error("تعذر قراءة أحد مقاطع الفيديو"));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("error", failed);
    };
    video.addEventListener("loadeddata", ready, { once: true });
    video.addEventListener("error", failed, { once: true });
    video.load();
  });

  return {
    video,
    dispose: () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    },
  };
}

function drawLogo(
  context: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  const maxWidth = canvasWidth * 0.18;
  const maxHeight = canvasHeight * 0.1;
  const scale = Math.min(1, maxWidth / logo.naturalWidth, maxHeight / logo.naturalHeight);
  const width = logo.naturalWidth * scale;
  const height = logo.naturalHeight * scale;
  const x = (canvasWidth - width) / 2;
  const y = canvasHeight * 0.025;

  context.save();
  context.globalAlpha = 0.96;
  context.shadowColor = "rgba(0,0,0,0.35)";
  context.shadowBlur = Math.max(4, canvasWidth * 0.004);
  context.drawImage(logo, x, y, width, height);
  context.restore();
}

async function renderScene(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  logo: HTMLImageElement,
) {
  const draw = () => {
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const rect = coverRect(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
    context.drawImage(video, rect.x, rect.y, rect.width, rect.height);
    drawLogo(context, logo, canvas.width, canvas.height);
  };

  draw();
  await video.play();

  await new Promise<void>((resolve, reject) => {
    let raf = 0;
    const finish = () => {
      cancelAnimationFrame(raf);
      draw();
      resolve();
    };
    const fail = () => {
      cancelAnimationFrame(raf);
      reject(new Error("تعذر تشغيل أحد مقاطع الفيديو أثناء الدمج"));
    };
    const tick = () => {
      draw();
      if (!video.ended) raf = requestAnimationFrame(tick);
    };
    video.addEventListener("ended", finish, { once: true });
    video.addEventListener("error", fail, { once: true });
    raf = requestAnimationFrame(tick);
  });
}

export async function composeKidzyFinalVideo(input: {
  sceneUrls: string[];
  aspectRatio: SupportedVideoAspectRatio;
  logoUrl?: string;
}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("دمج الفيديو المحلي متاح من المتصفح فقط");
  }
  if (typeof MediaRecorder === "undefined") {
    throw new Error("المتصفح الحالي لا يدعم دمج الفيديو المحلي");
  }
  if (!input.sceneUrls.length) throw new Error("لا توجد مقاطع معتمدة للدمج");

  const { width, height } = finalCanvasSize(input.aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("تعذر تهيئة محرك دمج الفيديو");

  const stream = canvas.captureStream(30);
  const mimeType = bestRecorderMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener(
      "stop",
      () => {
        const type = recorder.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunks, { type });
        if (!blob.size) reject(new Error("لم ينتج محرك الدمج ملف فيديو صالحاً"));
        else resolve(blob);
      },
      { once: true },
    );
    recorder.addEventListener("error", () => reject(new Error("فشل تسجيل الفيديو النهائي")), {
      once: true,
    });
  });

  const logo = await imageFromUrl(input.logoUrl ?? KIDZY_VIDEO_LOGO_URL);
  const loadedVideos: Awaited<ReturnType<typeof videoFromBlob>>[] = [];
  try {
    for (const url of input.sceneUrls) {
      loadedVideos.push(await videoFromBlob(await fetchPrivateBlob(url)));
    }

    recorder.start(1_000);
    for (const item of loadedVideos) {
      await renderScene(context, canvas, item.video, logo.image);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    recorder.stop();

    const blob = await stopped;
    return new File([blob], `kidzy-final-${Date.now()}.webm`, {
      type: blob.type || "video/webm",
    });
  } finally {
    loadedVideos.forEach((item) => item.dispose());
    logo.dispose();
    stream.getTracks().forEach((track) => track.stop());
  }
}
