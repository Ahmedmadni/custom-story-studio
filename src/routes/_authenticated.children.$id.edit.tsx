import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Loader2 } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ChildForm } from "@/features/children/ChildForm";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/children/$id/edit")({
  head: () => ({ meta: [{ title: "تعديل ملف الطفل — كيدزي" }] }),
  component: EditChildPage,
});

function EditChildPage() {
  const { id } = useParams({ from: "/_authenticated/children/$id/edit" });
  const { data, isLoading, error } = useQuery({
    queryKey: ["child", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("child_profiles")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 pb-12 pt-8 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-extrabold">تعديل ملف الطفل</h1>
        {error ? (
          <EmptyState
            icon={<BookOpen className="h-7 w-7" />}
            title="لم نجد ملف هذا الطفل"
            description="ربما تم حذفه، أو أن الرابط غير صحيح."
            action={
              <Button asChild className="rounded-full font-bold">
                <Link to="/my-children">العودة لملفات أطفالي</Link>
              </Button>
            }
          />
        ) : isLoading || !data ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ChildForm
            initial={{
              id: data.id,
              name: data.name,
              nickname: data.nickname,
              birth_date: data.birth_date,
              gender: data.gender,
              avatar_url: data.avatar_url,
              favorite_color: data.favorite_color,
              favorite_character: data.favorite_character,
              hobbies: data.hobbies,
              personality_traits: data.personality_traits,
              dream_job: data.dream_job,
              super_power: data.super_power,
            }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
