/**
 * شِيمر متحرك خفيف لبطاقات المكتبة (بديل أنيق عن Skeleton الافتراضي).
 */
export function CardShimmer({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-[3/4] overflow-hidden rounded-3xl bg-gradient-to-br from-secondary/40 via-secondary/20 to-secondary/40 bg-[length:200%_100%] animate-[shimmer_1.4s_ease-in-out_infinite]"
          aria-hidden
        />
      ))}
    </>
  );
}
