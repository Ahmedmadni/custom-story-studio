import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Shield, ShieldOff } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import {
  adminGrantRole,
  adminListUsers,
  adminRevokeRole,
} from "@/features/admin/users.functions";

type Mode = "users" | "roles";

export function UsersManager({ mode = "users" }: { mode?: Mode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListUsers);
  const grantFn = useServerFn(adminGrantRole);
  const revokeFn = useServerFn(adminRevokeRole);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users ?? [];
    if (!q) return list;
    return list.filter((u) => u.email.toLowerCase().includes(q) || u.id.includes(q));
  }, [users, search]);

  const grant = useMutation({
    mutationFn: (vars: { userId: string }) =>
      grantFn({ data: { userId: vars.userId, role: "admin" } }),
    onSuccess: () => { toast.success("تمت ترقية المستخدم إلى أدمن ✅"); void qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (vars: { userId: string }) =>
      revokeFn({ data: { userId: vars.userId, role: "admin" } }),
    onSuccess: () => { toast.success("تم سحب صلاحية الأدمن"); void qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold">
            {mode === "roles" ? "إدارة الصلاحيات 🛡️" : "إدارة المستخدمين 👥"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === "roles"
              ? "امنح أو اسحب صلاحية الأدمن من المستخدمين"
              : "كل المستخدمين المسجّلين في كيدزي"}
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث بالإيميل…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-full pe-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border-2 border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">لا يوجد مستخدمون</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead className="text-start">الإيميل</TableHead>
                <TableHead className="text-start">الأدوار</TableHead>
                {mode === "users" && <TableHead className="text-start">الطلبات</TableHead>}
                <TableHead className="text-start">آخر دخول</TableHead>
                <TableHead className="text-start">التسجيل</TableHead>
                <TableHead className="text-start">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const isAdmin = u.roles.includes("admin");
                const isMe = user?.id === u.id;
                const busy = grant.isPending || revoke.isPending;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-bold" dir="ltr">{u.email}</p>
                        <p className="text-[10px] text-muted-foreground" dir="ltr">{u.id.slice(0, 8)}…</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {isAdmin && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                            👑 Admin
                          </span>
                        )}
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          User
                        </span>
                        {isMe && (
                          <span className="rounded-full bg-sunny/30 px-2 py-0.5 text-[10px] font-bold">أنت</span>
                        )}
                      </div>
                    </TableCell>
                    {mode === "users" && (
                      <TableCell className="text-xs font-bold">{u.ordersCount}</TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground">
                      {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString("ar-EG") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("ar-EG")}
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Button
                          size="sm" variant="outline"
                          className="h-8 rounded-full text-xs font-bold text-destructive"
                          disabled={busy || isMe}
                          onClick={() => {
                            if (confirm(`سحب صلاحية الأدمن من ${u.email}؟`)) revoke.mutate({ userId: u.id });
                          }}
                        >
                          {busy ? <Loader2 className="ms-1 h-3 w-3 animate-spin" /> : <ShieldOff className="ms-1 h-3 w-3" />}
                          إزالة Admin
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 rounded-full text-xs font-bold"
                          disabled={busy}
                          onClick={() => grant.mutate({ userId: u.id })}
                        >
                          {busy ? <Loader2 className="ms-1 h-3 w-3 animate-spin" /> : <Shield className="ms-1 h-3 w-3" />}
                          ترقية إلى Admin
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
