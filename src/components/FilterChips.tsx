interface FilterChipsProps {
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  allLabel?: string;
  className?: string;
}

/**
 * شريط تصنيفات أفقي متجاوب مع scroll-snap على الموبايل.
 * استبدال موحّد لشرائط الفلاتر المكرّرة في stories/books.
 */
export function FilterChips({
  options,
  value,
  onChange,
  allLabel = "الكل",
  className = "",
}: FilterChipsProps) {
  return (
    <div
      className={`-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 ${className}`}
    >
      <Chip active={value === null} onClick={() => onChange(null)}>
        {allLabel}
      </Chip>
      {options.map((c) => (
        <Chip key={c} active={value === c} onClick={() => onChange(c)}>
          {c}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] shrink-0 snap-start rounded-full px-5 text-sm font-bold transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "bg-secondary text-secondary-foreground hover:bg-primary/15"
      }`}
    >
      {children}
    </button>
  );
}
