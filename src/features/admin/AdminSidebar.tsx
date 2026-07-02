import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  CreditCard,
  LayoutDashboard,
  Library,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { ComponentType } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  to: string;
  children: { to: string; label: string }[];
};

const singleItems: NavItem[] = [
  { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard },
  { to: "/admin/analytics", label: "التحليلات", icon: BarChart3 },
  { to: "/admin/orders", label: "الطلبات", icon: Package },
  { to: "/admin/payments", label: "المدفوعات", icon: CreditCard },
  { to: "/admin/approvals", label: "اعتماد المحتوى", icon: ShieldCheck },
  { to: "/admin/users", label: "المستخدمون", icon: Users },
  { to: "/admin/roles", label: "الصلاحيات", icon: ShieldCheck },
];


const groupItems: NavGroup[] = [
  {
    label: "القوالب",
    icon: Library,
    to: "/admin/templates",
    children: [
      { to: "/create", label: "قالب جديد" },
      { to: "/admin/templates", label: "إدارة القوالب" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string) =>
    to === "/admin" ? pathname === "/admin" : pathname.startsWith(to);

  const groupOpen = (to: string) =>
    pathname === to || pathname.startsWith(to);

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-display text-base font-extrabold">كيدزي · إدارة</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>لوحة التحكم</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {singleItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                    <Link to={item.to} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {groupItems.map((group) => (
                <Collapsible key={group.to} defaultOpen={groupOpen(group.to)} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={group.label}>
                        <group.icon className="h-4 w-4" />
                        <span>{group.label}</span>
                        <ChevronLeft className="me-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-[-90deg]" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {group.children.map((child) => (
                          <SidebarMenuSubItem key={child.to}>
                            <SidebarMenuSubButton asChild isActive={isActive(child.to)}>
                              <Link to={child.to}>{child.label}</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="العودة للموقع">
              <Link to="/" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span>العودة للموقع</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
