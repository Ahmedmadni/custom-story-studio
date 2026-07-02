import { cn } from "@/lib/utils";

export function ChildAvatar({
  emoji,
  color,
  photoUrl,
  name,
  size = "md",
  className,
}: {
  emoji?: string | null;
  color?: string | null;
  photoUrl?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const dims =
    size === "sm"
      ? "h-12 w-12 text-2xl"
      : size === "lg"
        ? "h-24 w-24 text-5xl"
        : size === "xl"
          ? "h-32 w-32 text-6xl"
          : "h-16 w-16 text-3xl";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name ?? "child"}
        loading="lazy"
        className={cn("rounded-3xl object-cover ring-4 ring-white shadow-md", dims, className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "grid place-items-center rounded-3xl text-white shadow-md ring-4 ring-white",
        dims,
        className,
      )}
      style={{ background: color ?? "#7C3AED" }}
    >
      <span>{emoji ?? "🧒"}</span>
    </div>
  );
}
