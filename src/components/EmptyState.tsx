import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * حالة فارغة موحّدة لكل المكتبات والقوائم.
 * استخدمها بدلاً من فقرات عشوائية «لا توجد بيانات».
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center rounded-3xl border-2 border-dashed border-border bg-secondary/20 px-6 py-12 text-center ${className}`}
    >
      {icon && (
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-extrabold">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
