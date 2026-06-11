import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB

const SaveInput = z.object({
  title: z.string().trim().min(1).max(120),
  pdfBase64: z.string().min(100).max(28_000_000),
  /** إثبات أن المحتوى المُصدَّر قد اعتُمد قبل التصدير */
  templateId: z.string().uuid().optional(),
});

/** حفظ نسخة PDF داخل حساب المستخدم — تتحقق من اعتماد المحتوى قبل الحفظ */
export const saveStoryPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const bytes = Buffer.from(data.pdfBase64, "base64");
    if (bytes.byteLength < 1000) throw new Error("ملف غير صالح");
    if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("حجم الملف كبير جداً");

    // التحقق المزدوج: اعتماد المستخدم للمعاينة + اعتماد المسؤول النهائي
    if (data.templateId) {
      const { data: tpl } = await context.supabase
        .from("story_templates")
        .select("approved_at, admin_approved_at, created_by")
        .eq("id", data.templateId)
        .single();
      if (!tpl) throw new Error("المحتوى غير موجود");
      const row = tpl as {
        approved_at?: string | null;
        admin_approved_at?: string | null;
        created_by?: string;
      };
      if (row.created_by !== context.userId)
        throw new Error("غير مصرح لك بحفظ هذا المحتوى");
      if (!row.approved_at)
        throw new Error("اعتمد المعاينة أولاً قبل تصدير PDF");
      if (!row.admin_approved_at)
        throw new Error(
          "طلبك قيد المراجعة من إدارة المنصة — سيتم تفعيل التحميل فور اعتماده",
        );
    }

    const encodedTitle = Buffer.from(data.title.slice(0, 40)).toString("base64url");
    const path = `${context.userId}/${Date.now()}__${encodedTitle}.pdf`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("story-pdfs")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (error) {
      console.error("save pdf error", error);
      throw new Error("تعذر حفظ الملف في حسابك");
    }

    return { path };
  });

/** قائمة ملفات PDF المحفوظة في حساب المستخدم مع روابط تحميل موقعة */
export const listMyPdfs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: files, error } = await supabaseAdmin.storage
      .from("story-pdfs")
      .list(context.userId, {
        limit: 60,
        sortBy: { column: "name", order: "desc" },
      });
    if (error) {
      console.error("list pdfs error", error);
      throw new Error("تعذر تحميل ملفاتك");
    }

    return Promise.all(
      (files ?? [])
        .filter((f) => f.name.endsWith(".pdf"))
        .map(async (f) => {
          const base = f.name.replace(/\.pdf$/, "");
          const [ts, encoded] = base.split("__");
          let title = "ملف PDF";
          if (encoded) {
            try {
              title = Buffer.from(encoded, "base64url").toString("utf8") || title;
            } catch {
              /* تجاهل أسماء غير قابلة للفك */
            }
          }
          const createdAt = Number(ts) || null;
          const { data: signed } = await supabaseAdmin.storage
            .from("story-pdfs")
            .createSignedUrl(`${context.userId}/${f.name}`, 60 * 60 * 24, {
              download: `${title}.pdf`,
            });
          return {
            name: f.name,
            title,
            createdAt,
            url: signed?.signedUrl ?? null,
          };
        }),
    );
  });
