import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STORY_STYLE_PROMPT, STYLE_NEGATIVE, ageStylePrompt } from "@/features/ai/storyStyle";
import { parsePages, personalize } from "@/features/ai/storyTypes";

type AuthedContext = {
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" | "user" },
    ) => PromiseLike<{ data: boolean | null }>;
  };
  userId: string;
};

async function assertAdmin(context: AuthedContext) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("غير مصرح لك بالوصول");
}

/** قائمة الطلبات للوحة التحكم مع روابط موقعة لصور الأطفال والإيصالات */
export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*, story_templates(id, title, slug, pages)")
      .order("created_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل الطلبات");

    const { data: pageRows } = await supabaseAdmin
      .from("generated_pages")
      .select("order_id, page_number");

    const result = await Promise.all(
      (orders ?? []).map(async (o) => {
        let photoUrl: string | null = null;
        if (o.child_photo_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("child-photos")
            .createSignedUrl(o.child_photo_path, 3600);
          photoUrl = signed?.signedUrl ?? null;
        }
        let receiptUrl: string | null = null;
        if (o.receipt_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("payment-receipts")
            .createSignedUrl(o.receipt_path, 3600);
          receiptUrl = signed?.signedUrl ?? null;
        }
        const totalPages = parsePages(o.story_templates?.pages).length;
        const donePages = (pageRows ?? []).filter((p) => p.order_id === o.id).length;
        return {
          id: o.id,
          status: o.status as string,
          paymentStatus: (o.payment_status ?? "unpaid") as string,
          priceEgp: o.price_egp ?? 100,
          paymentRejectionReason: o.payment_rejection_reason as string | null,
          childName: o.child_name,
          childAge: o.child_age,
          whatsapp: o.whatsapp,
          notes: o.notes,
          adminNotes: o.admin_notes,
          createdAt: o.created_at,
          storyTitle: o.story_templates?.title ?? "قصة محذوفة",
          templateId: o.template_id,
          photoUrl,
          receiptUrl,
          totalPages,
          donePages,
        };
      }),
    );
    return result;
  });

const VerifyInput = z.object({ orderId: z.string().uuid() });

export const adminVerifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VerifyInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "verified",
        payment_verified_by: context.userId,
        payment_verified_at: new Date().toISOString(),
        payment_rejection_reason: null,
        status: "approved",
      })
      .eq("id", data.orderId);
    if (error) throw new Error("تعذر تأكيد الدفع");
    return { ok: true };
  });

const RejectInput = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(1).max(300),
});

export const adminRejectPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RejectInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "rejected",
        payment_rejection_reason: data.reason,
        status: "rejected",
      })
      .eq("id", data.orderId);
    if (error) throw new Error("تعذر رفض الدفع");
    return { ok: true };
  });

const SetStatusInput = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["pending", "approved", "generating", "ready", "sent", "rejected"]),
  adminNotes: z.string().max(500).optional(),
});

export const adminSetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetStatusInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: data.status,
        ...(data.adminNotes !== undefined ? { admin_notes: data.adminNotes } : {}),
      })
      .eq("id", data.orderId);
    if (error) throw new Error("تعذر تحديث الطلب");
    return { ok: true };
  });

const GeneratePageInput = z.object({
  orderId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(12),
});

/**
 * توليد صفحة قصة مخصصة: يحول صورة الطفل الحقيقية إلى بطل كرتوني ثلاثي الأبعاد
 * داخل مشهد الصفحة — بالنمط المعتمد Children's Cartoon Style 3D.
 */
export const adminGeneratePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GeneratePageInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("*, story_templates(pages, title)")
      .eq("id", data.orderId)
      .single();
    if (orderErr || !order) throw new Error("الطلب غير موجود");

    const pages = parsePages(order.story_templates?.pages);
    const page = pages.find((p) => p.n === data.pageNumber);
    if (!page) throw new Error("الصفحة غير موجودة");
    if (!order.child_photo_path) throw new Error("لا توجد صورة للطفل في هذا الطلب");

    const { data: signedPhoto } = await supabaseAdmin.storage
      .from("child-photos")
      .createSignedUrl(order.child_photo_path, 600);
    if (!signedPhoto?.signedUrl) throw new Error("تعذر الوصول لصورة الطفل");

    // نمط العمر: يطبق عمر الطفل من الطلب إذا لم يكن مدمجاً في المشهد
    const agePart = page.scene.includes("Age styling")
      ? ""
      : `\n${ageStylePrompt(order.child_age)}.`;
    const gender = (order.gender as "boy" | "girl" | null) ?? "boy";
    const isGirl = gender === "girl";
    const heroLabel = isGirl ? "girl" : "boy";
    const pronoun = isGirl ? "she/her" : "he/him";

    // جلب الصورة المرجعية للجنس (ولد/بنت) — تستخدم كـ "نموذج للشخصية" يتعلم منه الذكاء الاصطناعي شكل البطل المعتمد
    const refFile = isGirl ? "girl.jpg" : "boy.png";
    const { data: signedRef } = await supabaseAdmin.storage
      .from("reference-children")
      .createSignedUrl(refFile, 600);
    const refUrl = signedRef?.signedUrl ?? null;

    const prompt = `${STORY_STYLE_PROMPT}.${agePart}
The hero is a ${heroLabel} child (${pronoun}). ${isGirl ? "Render her as an adorable little girl character with feminine styling appropriate for her age." : "Render him as an adorable little boy character with masculine styling appropriate for his age."}
${refUrl ? `REFERENCE CHARACTER (image #2): use the cartoon ${heroLabel} in image #2 as the canonical visual style for the hero — same 3D cartoon aesthetic, body proportions, outfit vibe and overall mood. This is the "official" ${heroLabel} character of the platform.` : ""}
Transform the real child from the attached PHOTO (image #1) into an adorable 3D cartoon hero ${heroLabel} character in this exact style. Keep the child's face clearly recognizable (same hair color and style, eye color, skin tone, facial features) but rendered as a beautiful enhanced 3D cartoon character like a Pixar movie star, with body proportions, outfit and overall maturity matching the child's real age.
Scene to illustrate: ${page.scene}.
The ${heroLabel} child is the main hero of the scene. Square children's storybook illustration, ${STYLE_NEGATIVE}.`;

    // محاولة Lovable AI أولاً، ثم OpenAI، ثم Gemini تلقائياً عند الفشل
    let base64: string | null = null;
    let providerUsed: "lovable" | "openai" | "gemini" | "stability" | "replicate" = "lovable";

    const lovableContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: signedPhoto.signedUrl } },
    ];
    if (refUrl) {
      lovableContent.push({ type: "image_url", image_url: { url: refUrl } });
    }

    const lovableRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: lovableContent }],
        modalities: ["image", "text"],
      }),
    });

    if (lovableRes.status === 429) {
      throw new Error("الخدمة مشغولة، انتظر دقيقة ثم أعد المحاولة");
    }

    if (lovableRes.ok) {
      const json = (await lovableRes.json()) as {
        choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
      };
      const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (dataUrl?.includes("base64,")) {
        base64 = dataUrl.split("base64,")[1];
      }
    } else {
      console.warn("Lovable AI failed", lovableRes.status, await lovableRes.text().catch(() => ""));
    }

    // Fallback 1: OpenAI gpt-image-1
    if (!base64 && process.env.OPENAI_API_KEY) {
      providerUsed = "openai";
      try {
        const photoRes = await fetch(signedPhoto.signedUrl);
        if (!photoRes.ok) throw new Error("photo fetch failed");
        const photoBlob = await photoRes.blob();

        const form = new FormData();
        form.append("model", "gpt-image-1");
        form.append("prompt", prompt);
        form.append("size", "1024x1024");
        form.append("n", "1");
        form.append("image", photoBlob, "child.png");

        const openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: form,
        });

        if (openaiRes.ok) {
          const oj = (await openaiRes.json()) as { data?: { b64_json?: string }[] };
          base64 = oj.data?.[0]?.b64_json ?? null;
        } else {
          console.warn("OpenAI fallback failed", openaiRes.status, await openaiRes.text().catch(() => ""));
        }
      } catch (e) {
        console.warn("OpenAI fallback error", e);
      }
    }

    // Fallback 2: Google Gemini (gemini-2.5-flash-image / nano-banana)
    if (!base64 && process.env.GEMINI_API_KEY) {
      providerUsed = "gemini";
      try {
        const photoRes = await fetch(signedPhoto.signedUrl);
        if (!photoRes.ok) throw new Error("photo fetch failed");
        const photoBuf = Buffer.from(await photoRes.arrayBuffer());
        const photoB64 = photoBuf.toString("base64");
        const mime = photoRes.headers.get("content-type") || "image/png";

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mime, data: photoB64 } },
                  ],
                },
              ],
            }),
          },
        );

        if (geminiRes.ok) {
          const gj = (await geminiRes.json()) as {
            candidates?: {
              content?: { parts?: { inline_data?: { data?: string }; inlineData?: { data?: string } }[] };
            }[];
          };
          const parts = gj.candidates?.[0]?.content?.parts ?? [];
          for (const p of parts) {
            const d = p.inline_data?.data ?? p.inlineData?.data;
            if (d) {
              base64 = d;
              break;
            }
          }
        } else {
          console.error("Gemini fallback failed", geminiRes.status, await geminiRes.text().catch(() => ""));
        }
      } catch (e) {
        console.error("Gemini fallback error", e);
      }
    }

    // Fallback 3: Stability AI (Stable Diffusion 3) — text-to-image (لا يقبل صورة الطفل كمدخل في هذا المسار)
    if (!base64 && process.env.STABILITY_API_KEY) {
      providerUsed = "stability";
      try {
        const form = new FormData();
        form.append("prompt", prompt);
        form.append("output_format", "png");
        form.append("aspect_ratio", "1:1");
        form.append("model", "sd3.5-large");

        const stabRes = await fetch(
          "https://api.stability.ai/v2beta/stable-image/generate/sd3",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
              Accept: "image/*",
            },
            body: form,
          },
        );

        if (stabRes.ok) {
          const buf = Buffer.from(await stabRes.arrayBuffer());
          base64 = buf.toString("base64");
        } else {
          console.error("Stability fallback failed", stabRes.status, await stabRes.text().catch(() => ""));
        }
      } catch (e) {
        console.error("Stability fallback error", e);
      }
    }

    // Fallback 4: Replicate (FLUX schnell) عبر بوابة Lovable
    if (!base64 && process.env.LOVABLE_API_KEY && process.env.REPLICATE_API_KEY) {
      providerUsed = "replicate";
      try {
        const GW = "https://connector-gateway.lovable.dev/replicate/v1";
        const headers = {
          Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": process.env.REPLICATE_API_KEY as string,
          "Content-Type": "application/json",
        };

        const createRes = await fetch(
          `${GW}/models/black-forest-labs/flux-schnell/predictions`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              input: { prompt, aspect_ratio: "1:1", output_format: "png", num_outputs: 1 },
            }),
          },
        );

        if (!createRes.ok) {
          console.error("Replicate create failed", createRes.status, await createRes.text().catch(() => ""));
        } else {
          const created = (await createRes.json()) as { id?: string; status?: string };
          const predId = created.id;
          if (predId) {
            let outputUrl: string | null = null;
            for (let i = 0; i < 60; i++) {
              await new Promise((r) => setTimeout(r, i < 5 ? 2000 : 4000));
              const pollRes = await fetch(`${GW}/predictions/${predId}`, {
                headers: { ...headers, "Content-Type": "application/json" },
              });
              if (!pollRes.ok) continue;
              const pj = (await pollRes.json()) as {
                status?: string;
                output?: string | string[];
                error?: unknown;
              };
              if (pj.status === "succeeded") {
                const out = Array.isArray(pj.output) ? pj.output[0] : pj.output;
                if (typeof out === "string") outputUrl = out;
                break;
              }
              if (pj.status === "failed" || pj.status === "canceled") {
                console.error("Replicate failed", pj.error);
                break;
              }
            }
            if (outputUrl) {
              const imgRes = await fetch(outputUrl);
              if (imgRes.ok) {
                base64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
              }
            }
          }
        }
      } catch (e) {
        console.error("Replicate fallback error", e);
      }
    }

    if (!base64) {
      throw new Error("فشل توليد الصورة من جميع المزودات المُهيأة، تحقق من الرصيد والمفاتيح");
    }

    const bytes = Buffer.from(base64, "base64");
    console.log(`[generate-page] provider=${providerUsed} order=${data.orderId} page=${data.pageNumber}`);
    const imagePath = `${data.orderId}/page-${data.pageNumber}.png`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("story-pages")
      .upload(imagePath, bytes, { contentType: "image/png", upsert: true });
    if (uploadErr) {
      console.error("upload error", uploadErr);
      throw new Error("تعذر حفظ الصورة");
    }

    await supabaseAdmin
      .from("generated_pages")
      .delete()
      .eq("order_id", data.orderId)
      .eq("page_number", data.pageNumber);
    const { error: insertErr } = await supabaseAdmin.from("generated_pages").insert({
      order_id: data.orderId,
      page_number: data.pageNumber,
      image_path: imagePath,
      page_text: personalize(page.text, order.child_name),
    });
    if (insertErr) throw new Error("تعذر تسجيل الصفحة");

    const { count } = await supabaseAdmin
      .from("generated_pages")
      .select("id", { count: "exact", head: true })
      .eq("order_id", data.orderId);

    const allDone = (count ?? 0) >= pages.length;
    await supabaseAdmin
      .from("orders")
      .update({ status: allDone ? "ready" : "generating" })
      .eq("id", data.orderId);

    const { data: signedPage } = await supabaseAdmin.storage
      .from("story-pages")
      .createSignedUrl(imagePath, 3600);

    return {
      pageNumber: data.pageNumber,
      imageUrl: signedPage?.signedUrl ?? null,
      done: count ?? 0,
      total: pages.length,
      allDone,
    };
  });

const OrderIdInput = z.object({ orderId: z.string().uuid() });

/** صفحات الطلب المولدة مع روابط موقعة (للوحة التحكم) */
export const adminGetOrderPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("generated_pages")
      .select("page_number, image_path, page_text")
      .eq("order_id", data.orderId)
      .order("page_number");

    return Promise.all(
      (rows ?? []).map(async (r) => {
        let imageUrl: string | null = null;
        if (r.image_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("story-pages")
            .createSignedUrl(r.image_path, 3600);
          imageUrl = signed?.signedUrl ?? null;
        }
        return {
          pageNumber: r.page_number,
          text: r.page_text,
          imageUrl,
        };
      }),
    );
  });

// تكلفة تقديرية بالدولار حسب موديل توليد الصور المستخدم حالياً (gemini-3.1-flash-image-preview)
// ملاحظة: التكلفة الفعلية تُخصم من رصيد Lovable AI وتُحسب بدقة في Settings → Workspace → Usage
const COST_PER_IMAGE_USD = 0.04;
const COST_PER_TEXT_GENERATION_USD = 0.005;

/** إحصائيات الاستخدام والتكلفة التقديرية + حالة المزودات المُهيأة */
export const adminGetUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ count: imagesAll }, { count: images30d }, { count: ordersAll }, { count: templatesAll }] =
      await Promise.all([
        supabaseAdmin.from("generated_pages").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("generated_pages")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since30d),
        supabaseAdmin.from("orders").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("story_templates").select("id", { count: "exact", head: true }),
      ]);

    const totalImages = imagesAll ?? 0;
    const imagesLast30d = images30d ?? 0;
    const estimatedCostUsdTotal = +(totalImages * COST_PER_IMAGE_USD).toFixed(2);
    const estimatedCostUsd30d = +(imagesLast30d * COST_PER_IMAGE_USD).toFixed(2);

    return {
      totalImages,
      imagesLast30d,
      totalOrders: ordersAll ?? 0,
      totalTemplates: templatesAll ?? 0,
      costPerImageUsd: COST_PER_IMAGE_USD,
      costPerTextUsd: COST_PER_TEXT_GENERATION_USD,
      estimatedCostUsdTotal,
      estimatedCostUsd30d,
      currentImageModel: "google/gemini-3.1-flash-image-preview",
      currentTextModel: "google/gemini-3-flash-preview",
      providers: {
        lovable: Boolean(process.env.LOVABLE_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        stability: Boolean(process.env.STABILITY_API_KEY),
        replicate: Boolean(process.env.REPLICATE_API_KEY),
      },
    };
  });

