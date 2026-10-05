import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/order/$templateId")({
  head: () => ({
    meta: [{ title: "اختر قصتك — كيدزي" }],
  }),
  component: LegacyOrderRedirect,
});

/**
 * Compatibility route for old saved links.
 *
 * The historical direct-order screen bypassed the current cart/receipt checkout
 * lifecycle and is no longer a valid production flow after payment/RLS
 * hardening. Keep the URL working, but send customers to the canonical story
 * page where they can add the story to the cart and complete secure checkout.
 */
function LegacyOrderRedirect() {
  const { templateId } = Route.useParams();
  const navigate = useNavigate();

  const template = useQuery({
    queryKey: ["legacy-order-template", templateId],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("slug")
        .eq("id", templateId)
        .eq("is_published", true)
        .maybeSingle();
      return data ?? null;
    },
  });

  useEffect(() => {
    if (template.isLoading) return;
    if (template.data?.slug) {
      void navigate({
        to: "/stories/$slug",
        params: { slug: template.data.slug },
        replace: true,
      });
      return;
    }
    void navigate({ to: "/stories", replace: true });
  }, [navigate, template.data?.slug, template.isLoading]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm font-bold text-muted-foreground">
          جارٍ فتح مسار الطلب الآمن…
        </p>
      </div>
    </div>
  );
}
