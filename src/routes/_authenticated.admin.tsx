import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/features/admin/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "لوحة التحكم — حكايتي" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, loading } = useAuth();

  if (!loading && !isAdmin) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex flex-col items-center py-24 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <p className="mt-4 text-lg font-bold">هذه الصفحة مخصصة للإدارة فقط</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <SidebarProvider>
        <div className="flex min-h-[calc(100vh-4rem)] w-full">
          <AdminSidebar />
          <div className="flex-1">
            <div className="flex items-center gap-2 border-b bg-card/60 px-4 py-2">
              <SidebarTrigger />
              <span className="text-sm font-bold text-muted-foreground">لوحة التحكم</span>
            </div>
            <main className="p-4 md:p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <Footer />
    </div>
  );
}
