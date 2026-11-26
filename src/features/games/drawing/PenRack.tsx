import { useEffect, useId, useRef } from "react";
import type { PaintTool } from "./controls";

const pens = [
  ["pencil", "رصاص", "#535866"],
  ["colored-pencil", "قلم ملون", "#167c82"],
  ["ink", "حبر", "#434963"],
  ["calligraphy", "خط عربي", "#247068"],
  ["crayon", "شمع", "#df7054"],
  ["marker", "فلوماستر", "#e9af28"],
  ["brush", "فرشاة ناعمة", "#ac754b"],
  ["oil", "فرشاة زيتية", "#995d38"],
  ["watercolor", "فرشاة مائية", "#427eac"],
  ["eraser", "ممحاة", "#e4a0ac"],
] as const;

function Instrument({ pen, accent }: { pen: PaintTool; accent: string }) {
  const id = useId();
  const body = `url(#${id}-body)`,
    metal = `url(#${id}-metal)`;
  return (
    <svg viewBox="0 0 40 76" className="rack-instrument" aria-hidden="true">
      <defs>
        <linearGradient id={id + "-body"}>
          <stop stopColor="#adb3bd" />
          <stop offset=".2" stopColor="#e4e6e8" />
          <stop offset=".43" stopColor="#fff" />
          <stop offset=".78" stopColor="#eeeef1" />
          <stop offset="1" stopColor="#bac0c8" />
        </linearGradient>
        <linearGradient id={id + "-metal"}>
          <stop stopColor="#68717c" />
          <stop offset=".32" stopColor="#f3f5f7" />
          <stop offset=".56" stopColor="#b4bac3" />
          <stop offset="1" stopColor="#626b79" />
        </linearGradient>
      </defs>
      {pen === "pencil" || pen === "colored-pencil" ? (
        <>
          <path d="M13 29 20 5l7 24v46H13Z" fill={pen === "pencil" ? "#ddb469" : accent} />
          <path d="m13 29 7-24 7 24-4-2-3 2-3-2Z" fill="#ead2af" />
          <path d="m17.7 13.5 2.3-8.5 2.3 8.5Z" fill={accent} stroke="#2224" />
          <path d="M16 30v45m8-46v46" stroke="#493222" opacity=".24" />
          <path d="M19 30v45" stroke="white" opacity=".35" />
        </>
      ) : pen === "oil" || pen === "brush" || pen === "watercolor" ? (
        <>
          <path d="M16 39h8l3 36H13Z" fill={pen === "watercolor" ? body : "#a86543"} />
          <path
            d={
              pen === "oil"
                ? "M10 9 29 7l-2 23H13Z"
                : pen === "brush"
                  ? "M20 4c-1 10-17 17-7 27h14C36 21 23 17 20 4Z"
                  : "M22 3c2 9 10 19 4 28H15C9 22 19 13 22 3Z"
            }
            fill={accent}
            stroke="#46382b"
            strokeWidth=".65"
          />
          <path
            d={pen === "oil" ? "m14 10 2 18m4-19v19m5-19-2 19" : "M20 13q-5 12-2 16m5-12q3 8 0 12"}
            fill="none"
            stroke="white"
            opacity=".45"
          />
          <path d="M12 29h16l-4 14h-8Z" fill={metal} />
          <path d="M15 40h10" stroke="#59616c" />
        </>
      ) : pen === "ink" || pen === "calligraphy" ? (
        <>
          <path d="M12 42h16l2 33H10Z" fill={body} />
          <path d="M13 29h14l1 15H12Z" fill={accent} />
          {pen === "ink" ? (
            <>
              <path d="m20 4 8 16-4 12h-8l-4-12Z" fill={metal} stroke="#545866" />
              <path d="M20 7v14" stroke="#353442" />
              <circle cx="20" cy="22" r="1.6" fill="#383a40" />
            </>
          ) : (
            <>
              <path d="m13 13 14-9-2 28H15Z" fill={metal} stroke="#545866" />
              <path d="m13 13 14-9-.5 5-13 8Z" fill={accent} />
              <path d="m21 15-1 11" stroke="#434650" />
            </>
          )}
          <path d="M12 44h16v3H12Z" fill={metal} />
        </>
      ) : pen === "eraser" ? (
        <>
          <rect x="8" y="13" width="24" height="61" rx="6" fill="#e4a0ac" />
          <path d="M10 18q10-3 19-2" fill="none" stroke="#f7c9cf" strokeWidth="2" />
          <path d="M7 39h26v36H7Z" fill={body} />
          <path d="M7 44h26v3H7Z" fill="#af7083" />
        </>
      ) : pen === "crayon" ? (
        <>
          <path d="m11 28 6-15h6l6 15v47H11Z" fill={accent} stroke="#27232944" />
          <path d="M10 35h20v40H10Z" fill={body} />
          <path
            d="m11 42 4 3 5-3 5 3 4-3m-18 5 4 3 5-3 5 3 4-3"
            stroke={accent}
            fill="none"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          <path d="m14 16 12-7v18H14Z" fill={accent} stroke="#27232944" />
          <path d="M13 25h14l4 12v38H9V37Z" fill={body} />
          <path d="M9 40h22v6H9Z" fill={accent} />
        </>
      )}
    </svg>
  );
}
export function PenRack({
  tool,
  color,
  onSelect,
}: {
  tool: string;
  color: string;
  onSelect: (tool: PaintTool) => void;
}) {
  const rack = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = rack.current;
    const selected = container?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!container || !selected) return;
    const frame = container.getBoundingClientRect();
    const pen = selected.getBoundingClientRect();
    const padding = 8;
    if (pen.left < frame.left + padding) {
      container.scrollBy({ left: pen.left - frame.left - padding, behavior: "auto" });
    } else if (pen.right > frame.right - padding) {
      container.scrollBy({ left: pen.right - frame.right + padding, behavior: "auto" });
    }
  }, [tool]);
  return (
    <div ref={rack} className="pen-rack" role="group" aria-label="الأقلام والفرش">
      {pens.map(([id, name, accent]) => (
        <button
          key={id}
          type="button"
          title={name}
          aria-pressed={tool === id}
          onClick={() => onSelect(id)}
        >
          <Instrument pen={id} accent={tool === id ? color : accent} />
          <span>{name}</span>
        </button>
      ))}
    </div>
  );
}
