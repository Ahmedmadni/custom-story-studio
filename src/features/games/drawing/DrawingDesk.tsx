import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  Brush,
  Check,
  Download,
  Eraser,
  Highlighter,
  PaintBucket,
  Pencil,
  PenLine,
  Droplets,
  Redo2,
  Undo2,
} from "lucide-react";
import { COLORS } from "../games-data";
import {
  PAPER,
  PAPER_HEIGHT,
  fillArea,
  isMark,
  replay,
  segment,
  type Mark,
  type Point,
  type Tool,
} from "./paint";

const toolGroups = [
  {
    title: "أقلام",
    tools: [
      { id: "pencil", name: "رصاص", icon: Pencil },
      { id: "colored-pencil", name: "قلم ملون", icon: Pencil },
      { id: "ink", name: "حبر", icon: PenLine },
      { id: "crayon", name: "شمع", icon: Highlighter },
    ],
  },
  {
    title: "فرش",
    tools: [
      { id: "brush", name: "فرشاة ناعمة", icon: Brush },
      { id: "oil", name: "ألوان زيتية", icon: Brush },
      { id: "watercolor", name: "ألوان مائية", icon: Droplets },
      { id: "marker", name: "قلم فلوماستر", icon: Highlighter },
    ],
  },
  {
    title: "أدوات",
    tools: [
      { id: "fill", name: "تعبئة", icon: PaintBucket },
      { id: "eraser", name: "ممحاة", icon: Eraser },
    ],
  },
] as const;
const palettes = [
  {
    id: "bright",
    name: "زاهية",
    colors: [...COLORS, { name: "فيروزي", hex: "#14b8a6" }, { name: "سماوي", hex: "#7dd3fc" }],
  },
  {
    id: "pastel",
    name: "باستيل",
    colors: [
      { name: "وردي فاتح", hex: "#f8b8d3" },
      { name: "خوخي", hex: "#fdba9b" },
      { name: "أصفر فاتح", hex: "#ffe2a0" },
      { name: "نعناعي", hex: "#a8e6cf" },
      { name: "أزرق فاتح", hex: "#a5d8f3" },
      { name: "ليلكي", hex: "#c9b6ee" },
      { name: "وردي باهت", hex: "#f1cfdd" },
      { name: "كريمي", hex: "#f5e6c8" },
    ],
  },
  {
    id: "earth",
    name: "طبيعة",
    colors: [
      { name: "أخضر أوراق", hex: "#4d8b55" },
      { name: "زيتوني", hex: "#7b874a" },
      { name: "عشبي", hex: "#93b56b" },
      { name: "بني", hex: "#795548" },
      { name: "ترابي", hex: "#b3875c" },
      { name: "رملي", hex: "#d6b88a" },
      { name: "سماء", hex: "#73b8da" },
      { name: "بحري", hex: "#287b91" },
    ],
  },
  {
    id: "neutral",
    name: "حيادية",
    colors: [
      { name: "أسود", hex: "#27233a" },
      { name: "رصاصي", hex: "#46505d" },
      { name: "رمادي داكن", hex: "#626775" },
      { name: "رمادي", hex: "#9a9dab" },
      { name: "رمادي فاتح", hex: "#c8cbd0" },
      { name: "عاجي", hex: "#f2eee3" },
      { name: "أبيض", hex: "#ffffff" },
    ],
  },
] as const;
const widths = [
  { value: 10, name: "رفيع" },
  { value: 24, name: "متوسط" },
  { value: 48, name: "عريض" },
];

export function DrawingDesk({ id, title }: { id: string; title: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const art = useRef<HTMLImageElement | null>(null);
  const boundary = useRef<Uint8Array>(new Uint8Array(0));
  const history = useRef<{ done: Mark[]; undone: Mark[] }>({ done: [], undone: [] });
  const active = useRef<{ pointer: number; mark: Mark } | null>(null);
  const [counts, setCounts] = useState([0, 0]);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState(COLORS[0].hex);
  const [size, setSize] = useState(24);
  const [opacity, setOpacity] = useState(100);
  const [palette, setPalette] = useState<(typeof palettes)[number]["id"]>("bright");
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const storageKey = "kidzy:desk:v1:" + id;

  useEffect(() => {
    let gone = false;
    const ctx = canvas.current!.getContext("2d", { willReadFrequently: true })!;
    async function init() {
      try {
        const mask = new Uint8Array(PAPER * PAPER_HEIGHT);
        if (id !== "blank") {
          const img = new Image();
          img.src = "/drawing/" + id + ".webp";
          await img.decode();
          if (gone) return;
          ctx.drawImage(img, 0, 0, PAPER, PAPER_HEIGHT);
          const data = ctx.getImageData(0, 0, PAPER, PAPER_HEIGHT).data;
          for (let i = 0; i < mask.length; i++) mask[i] = Number(data[4 * i] < 192);
          art.current = img;
        }
        boundary.current = mask;
        let done: Mark[] = [];
        try {
          const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
          if (Array.isArray(saved) && saved.every(isMark)) done = saved;
        } catch {
          setMessage("الحفظ على هذا الجهاز غير متاح حاليًا. يمكنك تنزيل لوحتك.");
        }
        history.current = { done, undone: [] };
        replay(ctx, mask, done);
        setCounts([done.length, 0]);
        setLoad("ready");
      } catch {
        if (!gone) setLoad("error");
      }
    }
    void init();
    return () => {
      gone = true;
    };
  }, [id, storageKey, attempt]);

  function save() {
    const { done, undone } = history.current;
    setCounts([done.length, undone.length]);
    try {
      if (done.length) localStorage.setItem(storageKey, JSON.stringify(done));
      else localStorage.removeItem(storageKey);
      setMessage("");
    } catch {
      setMessage("تعذّر حفظ التغييرات على الجهاز. نزّل لوحتك للاحتفاظ بها.");
    }
  }
  function record(mark: Mark) {
    history.current.done.push(mark);
    history.current.undone = [];
    save();
  }
  function point(e: PointerEvent<HTMLCanvasElement>): Point {
    const box = e.currentTarget.getBoundingClientRect();
    const scale = (distance: number, length: number, max: number) =>
      Math.max(0, Math.min(max - 1, Math.round((distance * max) / length)));
    return [
      scale(e.clientX - box.left, box.width, PAPER),
      scale(e.clientY - box.top, box.height, PAPER_HEIGHT),
    ];
  }
  function start(e: PointerEvent<HTMLCanvasElement>) {
    if (load !== "ready" || active.current || !e.isPrimary || e.button !== 0) return;
    const at = point(e);
    const mark: Mark = {
      tool,
      color,
      size,
      opacity: opacity / 100,
      points: [at],
      ...(e.pointerType === "pen" ? { pressures: [e.pressure] } : {}),
    };
    const ctx = e.currentTarget.getContext("2d")!;
    if (tool === "fill") {
      if (fillArea(ctx, boundary.current, mark)) record(mark);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    active.current = { pointer: e.pointerId, mark };
    segment(ctx, mark, at, at, mark.pressures?.[0] ?? 1);
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    const drag = active.current;
    if (!drag || drag.pointer !== e.pointerId) return;
    const at = point(e);
    const prev = drag.mark.points[drag.mark.points.length - 1];
    if (prev[0] === at[0] && prev[1] === at[1]) return;
    if (drag.mark.points.length >= 20000) return;
    drag.mark.points.push(at);
    if (drag.mark.pressures) drag.mark.pressures.push(e.pressure);
    const pressure = drag.mark.pressures
      ? (drag.mark.pressures[drag.mark.pressures.length - 2] + e.pressure) / 2
      : 1;
    segment(e.currentTarget.getContext("2d")!, drag.mark, prev, at, pressure);
  }
  function finish(e: PointerEvent<HTMLCanvasElement>) {
    const drag = active.current;
    if (!drag || drag.pointer !== e.pointerId) return;
    if (e.type === "pointerup") move(e);
    active.current = null;
    record(drag.mark);
  }
  function step(back: boolean) {
    if (active.current) return;
    const { done, undone } = history.current;
    const mark = (back ? done : undone).pop();
    if (!mark) return;
    (back ? undone : done).push(mark);
    replay(canvas.current!.getContext("2d")!, boundary.current, done);
    save();
  }
  function download() {
    const output = document.createElement("canvas");
    output.width = PAPER;
    output.height = PAPER_HEIGHT;
    const ctx = output.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, PAPER, PAPER_HEIGHT);
    ctx.drawImage(canvas.current!, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    if (art.current) ctx.drawImage(art.current, 0, 0, PAPER, PAPER_HEIGHT);
    output.toBlob((blob) => {
      if (!blob) {
        setMessage("تعذّر تنزيل اللوحة. حاول مرة أخرى.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "كيدزي - " + title + ".png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 15000);
    }, "image/png");
  }

  return (
    <section aria-label={title} className="desk">
      <div className="desk-heading">
        <h1>{title}</h1>
        <button className="desk-download" disabled={load !== "ready"} onClick={download}>
          <Download size={18} /> تنزيل اللوحة
        </button>
      </div>
      <div className="desk-layout">
        <div className="desk-mat">
          <div className="desk-paper">
            <canvas
              ref={canvas}
              width={PAPER}
              height={PAPER_HEIGHT}
              aria-label={"ورقة الرسم • " + title}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={finish}
              onPointerCancel={finish}
              onLostPointerCapture={finish}
            />
            {id !== "blank" && <img src={"/drawing/" + id + ".webp"} alt="" draggable={false} />}
            {load !== "ready" && (
              <div className="desk-loading" role="status">
                {load === "loading" ? (
                  "نجهّز ورقتك…"
                ) : (
                  <button
                    onClick={() => {
                      setLoad("loading");
                      setAttempt((a) => a + 1);
                    }}
                  >
                    تعذّر فتح الرسمة. حاول مجددًا
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <aside className="desk-kit" aria-label="حقيبة الرسم">
          <fieldset>
            <legend>حقيبة الرسم</legend>
            {toolGroups.map((group) => (
              <div className="desk-tool-group" key={group.title}>
                <span className="desk-subtitle">{group.title}</span>
                <div className="desk-tools">
                  {group.tools.map(({ id: key, name, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      aria-label={name}
                      aria-pressed={tool === key}
                      onClick={() => {
                        setTool(key);
                        if (key === "pencil") setColor("#46505d");
                      }}
                    >
                      <Icon size={21} />
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>
          <fieldset>
            <legend>بالتة الألوان</legend>
            <div className="desk-palettes" role="group" aria-label="مجموعات الألوان">
              {palettes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={palette === p.id}
                  onClick={() => setPalette(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="desk-swatches">
              {palettes
                .find((p) => p.id === palette)!
                .colors.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    aria-label={c.name}
                    title={c.name}
                    aria-pressed={color === c.hex}
                    onClick={() => setColor(c.hex)}
                  >
                    <span style={{ background: c.hex }}>
                      {color === c.hex && <Check size={17} strokeWidth={3} />}
                    </span>
                  </button>
                ))}
            </div>
            <label className="desk-custom-color">
              <span>لون من اختيارك</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="اختر لونًا مخصصًا"
              />
              <span dir="ltr">{color.toUpperCase()}</span>
            </label>
          </fieldset>
          {tool !== "fill" && (
            <fieldset>
              <legend>سُمك الأداة: {size}</legend>
              <div className="desk-widths">
                {widths.map((w) => (
                  <button
                    key={w.value}
                    aria-pressed={size === w.value}
                    onClick={() => setSize(w.value)}
                  >
                    <i style={{ width: 5 + w.value / 4, height: 5 + w.value / 4 }} />
                    {w.name}
                  </button>
                ))}
              </div>
              <input
                className="desk-range"
                type="range"
                min="2"
                max="80"
                step="1"
                value={size}
                aria-label="سُمك القلم أو الفرشاة"
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </fieldset>
          )}
          {tool !== "fill" && tool !== "eraser" && (
            <fieldset>
              <legend>كثافة اللون: {opacity}٪</legend>
              <input
                className="desk-range"
                type="range"
                min="10"
                max="100"
                step="5"
                value={opacity}
                aria-label="كثافة اللون"
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
            </fieldset>
          )}
          <div className="desk-history">
            <button disabled={!counts[0]} onClick={() => step(true)}>
              <Undo2 size={19} />
              تراجع
            </button>
            <button disabled={!counts[1]} onClick={() => step(false)}>
              <Redo2 size={19} />
              إعادة
            </button>
          </div>
          <p className="desk-status" role="status">
            {message || (load === "ready" && counts[0] > 0 ? "حُفظت رسمتك على هذا الجهاز" : "")}
          </p>
        </aside>
      </div>
    </section>
  );
}
