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
  FileDown,
  Hand,
  Pipette,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { COLORS } from "../games-data";
import {
  colorShades,
  colorToHsl,
  DEFAULT_TOOL_SETTINGS,
  hslToColor,
  ignoreTouch,
  rememberColor,
  savedColors,
  savedToolSettings,
  type PaintTool,
  type ToolSetting,
} from "./controls";
import {
  PAPER,
  PAPER_HEIGHT,
  fillArea,
  isMark,
  replay,
  segment,
  sealOutlineGaps,
  smoothStroke,
  type Mark,
  type Point,
  type Tool,
} from "./paint";

type DeskTool = Tool | "picker" | "pan";

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
      { id: "picker", name: "قطّارة", icon: Pipette },
      { id: "pan", name: "تحريك", icon: Hand },
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
  {
    id: "flowers",
    name: "زهور",
    colors: [
      { name: "توتي", hex: "#ba3160" },
      { name: "وردي", hex: "#e681a4" },
      { name: "مرجاني", hex: "#ef786b" },
      { name: "برتقالي", hex: "#ed9b4f" },
      { name: "أصفر ذهبي", hex: "#e6b94e" },
      { name: "أخضر أوراق", hex: "#579467" },
      { name: "بنفسجي", hex: "#8b63b4" },
      { name: "ليلكي", hex: "#c09ada" },
    ],
  },
  {
    id: "portraits",
    name: "شخصيات",
    colors: [
      { name: "بشرة فاتحة", hex: "#f5d8bd" },
      { name: "بشرة وردية", hex: "#e8b9a5" },
      { name: "بشرة قمحية", hex: "#d8a77d" },
      { name: "بشرة سمراء", hex: "#b77e59" },
      { name: "بشرة بنية", hex: "#8b573d" },
      { name: "بشرة داكنة", hex: "#583a32" },
      { name: "شعر ذهبي", hex: "#c99d53" },
      { name: "شعر بني", hex: "#6f4635" },
      { name: "شعر أسود", hex: "#302b32" },
      { name: "شعر أحمر", hex: "#a8503c" },
    ],
  },
] as const;
const widths = [
  { value: 10, name: "رفيع" },
  { value: 24, name: "متوسط" },
  { value: 48, name: "عريض" },
];
const fillOptions = [
  { value: 8, name: "دقيق" },
  { value: 28, name: "متوازن" },
  { value: 56, name: "واسع" },
];
const recentColorsKey = "kidzy:desk:recent-colors:v1";
const penOnlyKey = "kidzy:desk:pen-only:v1";
const toolSettingsKey = "kidzy:desk:tool-settings:v1";
const fillToleranceKey = "kidzy:desk:fill-tolerance:v1";

export function DrawingDesk({ id, title }: { id: string; title: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const toolPreview = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLImageElement | null>(null);
  const boundary = useRef<Uint8Array>(new Uint8Array(0));
  const history = useRef<{ done: Mark[]; undone: Mark[] }>({ done: [], undone: [] });
  const active = useRef<{ pointer: number; mark: Mark } | null>(null);
  const panning = useRef<{
    pointer: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const lastPaintTool = useRef<Tool>("brush");
  const lastPenAt = useRef(0);
  const [counts, setCounts] = useState([0, 0]);
  const [tool, setTool] = useState<DeskTool>("brush");
  const [color, setColor] = useState(COLORS[0].hex);
  const [selectedHsl, setSelectedHsl] = useState(() => colorToHsl(COLORS[0].hex));
  const [toolSettings, setToolSettings] = useState(() => savedToolSettings(null));
  const [toolSettingsLoaded, setToolSettingsLoaded] = useState(false);
  const [fillTolerance, setFillTolerance] = useState(28);
  const [palette, setPalette] = useState<(typeof palettes)[number]["id"]>("bright");
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [zoom, setZoom] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [penOnly, setPenOnly] = useState(false);
  const storageKey = "kidzy:desk:v1:" + id;
  const marks = history.current.done;
  let lastClear = -1;
  for (let i = marks.length - 1; i >= 0; i--) {
    if (marks[i].tool === "clear") {
      lastClear = i;
      break;
    }
  }
  const canClear = marks.length > lastClear + 1;
  const shades = colorShades(color);
  const setting =
    tool in DEFAULT_TOOL_SETTINGS ? toolSettings[tool as PaintTool] : toolSettings.brush;
  const { size, opacity } = setting;

  function selectColor(value: string) {
    setColor(value);
    setSelectedHsl(colorToHsl(value));
  }
  function changeColorChannel(channel: "hue" | "saturation" | "lightness", value: number) {
    const next = { ...selectedHsl, [channel]: value };
    setSelectedHsl(next);
    setColor(hslToColor(next));
  }
  function updateToolSetting(change: Partial<ToolSetting>) {
    if (!(tool in DEFAULT_TOOL_SETTINGS)) return;
    const selectedTool = tool as PaintTool;
    setToolSettings((current) => ({
      ...current,
      [selectedTool]: { ...current[selectedTool], ...change },
    }));
  }

  useEffect(() => {
    try {
      setRecentColors(savedColors(JSON.parse(localStorage.getItem(recentColorsKey) ?? "[]")));
      setPenOnly(localStorage.getItem(penOnlyKey) === "true");
    } catch {
      // Browser storage can be disabled; the controls still work for this session.
    }
  }, []);

  useEffect(() => {
    try {
      setToolSettings(
        savedToolSettings(JSON.parse(localStorage.getItem(toolSettingsKey) ?? "null")),
      );
      const savedTolerance = Number(localStorage.getItem(fillToleranceKey));
      if (fillOptions.some((option) => option.value === savedTolerance)) {
        setFillTolerance(savedTolerance);
      }
    } catch {
      // Use the built-in presets when local storage is unavailable.
    }
    setToolSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!toolSettingsLoaded) return;
    try {
      localStorage.setItem(toolSettingsKey, JSON.stringify(toolSettings));
    } catch {
      // Settings remain available until the page is closed.
    }
  }, [toolSettings, toolSettingsLoaded]);

  useEffect(() => {
    const ctx = toolPreview.current?.getContext("2d");
    if (!ctx || tool === "pan" || tool === "picker") return;
    ctx.clearRect(0, 0, 260, 76);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 260, 76);
    const mark: Mark = {
      tool,
      color,
      size,
      opacity: opacity / 100,
      points: [
        [24, 38],
        [236, 38],
      ],
    };
    if (tool === "fill") {
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity / 100;
      ctx.beginPath();
      ctx.arc(130, 38, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      if (tool === "eraser") {
        ctx.fillStyle = "#b6a9d2";
        ctx.fillRect(20, 19, 220, 38);
      }
      if (tool === "marker" || tool === "watercolor") smoothStroke(ctx, mark);
      else segment(ctx, mark, mark.points[0], mark.points[1]);
    }
  }, [tool, color, size, opacity]);

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
        boundary.current = sealOutlineGaps(mask, PAPER, PAPER_HEIGHT);
        let done: Mark[] = [];
        try {
          const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
          if (Array.isArray(saved) && saved.every(isMark)) done = saved;
        } catch {
          setMessage("الحفظ على هذا الجهاز غير متاح حاليًا. يمكنك تنزيل لوحتك.");
        }
        history.current = { done, undone: [] };
        replay(ctx, boundary.current, done);
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
    if (mark.tool !== "eraser" && mark.tool !== "clear") {
      setRecentColors((previous) => {
        const next = rememberColor(previous, mark.color);
        try {
          localStorage.setItem(recentColorsKey, JSON.stringify(next));
        } catch {
          // Keep recently used colors available in this session.
        }
        return next;
      });
    }
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
    if (load !== "ready" || active.current || panning.current || !e.isPrimary || e.button !== 0)
      return;
    const now = Date.now();
    if (e.pointerType === "pen") lastPenAt.current = now;
    if (ignoreTouch(e.pointerType, penOnly, lastPenAt.current, now, tool === "pan")) return;
    if (tool === "pan") {
      const view = viewport.current!;
      panning.current = {
        pointer: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        left: view.scrollLeft,
        top: view.scrollTop,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const at = point(e);
    if (tool === "picker") {
      const pixels = e.currentTarget.getContext("2d")!.getImageData(at[0], at[1], 1, 1).data;
      if (pixels[3] < 8) {
        setMessage("المس لونًا رسمته على الورقة لالتقاطه.");
      } else {
        const hex = [0, 1, 2]
          .map((i) =>
            Math.round(255 - ((255 - pixels[i]) * pixels[3]) / 255)
              .toString(16)
              .padStart(2, "0"),
          )
          .join("");
        selectColor("#" + hex);
        setTool(lastPaintTool.current);
        setMessage("التقطت اللون من لوحتك.");
      }
      return;
    }
    const mark: Mark = {
      tool,
      color,
      size,
      opacity: opacity / 100,
      points: [at],
      ...(tool === "fill" ? { tolerance: fillTolerance } : {}),
      ...(e.pointerType === "pen" ? { pressures: [e.pressure] } : {}),
    };
    const ctx = e.currentTarget.getContext("2d")!;
    if (tool === "fill") {
      if (fillArea(ctx, boundary.current, mark)) record(mark);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    active.current = { pointer: e.pointerId, mark };
    if (tool === "marker" || tool === "watercolor") {
      smoothStroke(previewCanvas.current!.getContext("2d")!, mark);
    } else segment(ctx, mark, at, at, mark.pressures?.[0] ?? 1);
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "pen") lastPenAt.current = Date.now();
    const pan = panning.current;
    if (pan?.pointer === e.pointerId) {
      const view = viewport.current!;
      view.scrollLeft = pan.left + pan.x - e.clientX;
      view.scrollTop = pan.top + pan.y - e.clientY;
      return;
    }
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
    if (drag.mark.tool === "marker" || drag.mark.tool === "watercolor") {
      const preview = previewCanvas.current!.getContext("2d")!;
      preview.clearRect(0, 0, PAPER, PAPER_HEIGHT);
      smoothStroke(preview, drag.mark);
    } else segment(e.currentTarget.getContext("2d")!, drag.mark, prev, at, pressure);
  }
  function finish(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "pen") lastPenAt.current = Date.now();
    if (panning.current?.pointer === e.pointerId) {
      if (e.type === "pointerup") move(e);
      panning.current = null;
      return;
    }
    const drag = active.current;
    if (!drag || drag.pointer !== e.pointerId) return;
    if (e.type === "pointerup") move(e);
    if (drag.mark.tool === "marker" || drag.mark.tool === "watercolor") {
      const preview = previewCanvas.current!;
      e.currentTarget.getContext("2d")!.drawImage(preview, 0, 0);
      preview.getContext("2d")!.clearRect(0, 0, PAPER, PAPER_HEIGHT);
    }
    active.current = null;
    record(drag.mark);
  }
  function clearArtwork() {
    if (active.current || !canClear) return;
    canvas.current!.getContext("2d")!.clearRect(0, 0, PAPER, PAPER_HEIGHT);
    record({ tool: "clear", color: "#ffffff", size: 1, points: [[0, 0]] });
    setConfirmClear(false);
    setMessage("مُسحت الألوان. يمكنك التراجع لاستعادتها.");
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
  function composed() {
    const output = document.createElement("canvas");
    output.width = PAPER;
    output.height = PAPER_HEIGHT;
    const ctx = output.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, PAPER, PAPER_HEIGHT);
    ctx.drawImage(canvas.current!, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    if (art.current) ctx.drawImage(art.current, 0, 0, PAPER, PAPER_HEIGHT);
    return output;
  }
  function download() {
    const output = composed();
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
  async function downloadPdf() {
    try {
      const { jsPDF } = await import("jspdf");
      const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      document.addImage(composed().toDataURL("image/png"), "PNG", 0, 8, 210, 280);
      document.save("كيدزي - " + title + ".pdf");
    } catch {
      setMessage("تعذّر إنشاء ملف PDF. يمكنك تنزيل اللوحة كصورة.");
    }
  }

  return (
    <section aria-label={title} className="desk">
      <div className="desk-heading">
        <h1>{title}</h1>
        <div className="desk-heading-actions">
          <div className="desk-zoom" role="group" aria-label="تكبير الورقة">
            <button
              type="button"
              aria-label="تصغير"
              disabled={zoom === 1}
              onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
            >
              <ZoomOut size={18} />
            </button>
            <span>{Math.round(zoom * 100)}٪</span>
            <button
              type="button"
              aria-label="تكبير"
              disabled={zoom === 3}
              onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
            >
              <ZoomIn size={18} />
            </button>
          </div>
          <button className="desk-download" disabled={load !== "ready"} onClick={download}>
            <Download size={18} /> صورة PNG
          </button>
          <button
            className="desk-download desk-pdf"
            disabled={load !== "ready"}
            onClick={() => void downloadPdf()}
          >
            <FileDown size={18} /> PDF للطباعة
          </button>
        </div>
      </div>
      <div className="desk-layout">
        <div className="desk-mat" ref={viewport}>
          <div
            className="desk-paper"
            style={{ width: `min(${zoom * 100}%, ${zoom * 60}vh)`, maxWidth: "none" }}
          >
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
            <canvas
              ref={previewCanvas}
              width={PAPER}
              height={PAPER_HEIGHT}
              className="desk-preview"
              aria-hidden="true"
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
                        if (key !== "picker" && key !== "pan") lastPaintTool.current = key;
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
          <button
            className="desk-pen-mode"
            type="button"
            aria-pressed={penOnly}
            onClick={() => {
              const next = !penOnly;
              setPenOnly(next);
              try {
                localStorage.setItem(penOnlyKey, String(next));
              } catch {
                // Continue without device storage.
              }
            }}
          >
            <PenLine size={20} />
            <span>
              <strong>الرسم بالقلم الإلكتروني فقط</strong>
              <small>عند تفعيله، يمكنك تحريك الورقة بإصبعك من أداة التحريك.</small>
            </span>
          </button>
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
                    onClick={() => selectColor(c.hex)}
                  >
                    <span style={{ background: c.hex }}>
                      {color === c.hex && <Check size={17} strokeWidth={3} />}
                    </span>
                  </button>
                ))}
            </div>
            <div className="desk-shades">
              <span className="desk-subtitle">درجات اللون • من الغامق إلى الفاتح</span>
              <div
                className="desk-swatches desk-shade-swatches"
                role="group"
                aria-label="درجات اللون المختار"
              >
                {shades.map((shade, index) => (
                  <button
                    key={shade}
                    type="button"
                    aria-label={`درجة اللون ${index + 1}: ${shade}`}
                    aria-pressed={color.toLowerCase() === shade}
                    onClick={() => selectColor(shade)}
                  >
                    <span style={{ background: shade }}>
                      {color.toLowerCase() === shade && <Check size={17} strokeWidth={3} />}
                    </span>
                  </button>
                ))}
              </div>
              <label className="desk-color-adjust">
                <span>طيف اللون</span>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={selectedHsl.hue}
                  dir="ltr"
                  aria-label="تغيير طيف اللون"
                  onChange={(e) => changeColorChannel("hue", Number(e.target.value))}
                />
              </label>
              <label className="desk-color-adjust">
                <span>قوة اللون: {selectedHsl.saturation}٪</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedHsl.saturation}
                  dir="ltr"
                  aria-label="قوة اللون"
                  onChange={(e) => changeColorChannel("saturation", Number(e.target.value))}
                />
              </label>
              <label className="desk-color-adjust">
                <span>فاتح أو غامق: {selectedHsl.lightness}٪</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedHsl.lightness}
                  dir="ltr"
                  aria-label="تفتيح اللون أو تغميقه"
                  onChange={(e) => changeColorChannel("lightness", Number(e.target.value))}
                />
              </label>
            </div>
            <label className="desk-custom-color">
              <span>لون من اختيارك</span>
              <input
                type="color"
                value={color}
                onChange={(e) => selectColor(e.target.value)}
                aria-label="اختر لونًا مخصصًا"
              />
              <span dir="ltr">{color.toUpperCase()}</span>
            </label>
            {recentColors.length > 0 && (
              <div className="desk-recent">
                <span className="desk-subtitle">ألوان استخدمتها</span>
                <div className="desk-swatches" role="group" aria-label="الألوان المستخدمة مؤخرًا">
                  {recentColors.map((recent, index) => (
                    <button
                      key={recent}
                      type="button"
                      aria-label={`لون مستخدم ${index + 1}: ${recent}`}
                      aria-pressed={color.toLowerCase() === recent}
                      onClick={() => selectColor(recent)}
                    >
                      <span style={{ background: recent }}>
                        {color.toLowerCase() === recent && <Check size={17} strokeWidth={3} />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
          {tool === "fill" && (
            <fieldset>
              <legend>انتشار التعبئة</legend>
              <div
                className="desk-fill-options"
                role="group"
                aria-label="اتساع التعبئة داخل الرسمة"
              >
                {fillOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={fillTolerance === option.value}
                    onClick={() => {
                      setFillTolerance(option.value);
                      try {
                        localStorage.setItem(fillToleranceKey, String(option.value));
                      } catch {
                        // Keep the choice for this session.
                      }
                    }}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
              <p className="desk-tool-hint">
                إذا بقيت نقاط صغيرة غير ملونة، جرّب «واسع». حدود الرسمة تظل محمية.
              </p>
            </fieldset>
          )}
          {tool !== "fill" && tool !== "pan" && tool !== "picker" && (
            <fieldset>
              <legend>سُمك الأداة: {size}</legend>
              <div className="desk-widths">
                {widths.map((w) => (
                  <button
                    key={w.value}
                    aria-pressed={size === w.value}
                    onClick={() => updateToolSetting({ size: w.value })}
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
                onChange={(e) => updateToolSetting({ size: Number(e.target.value) })}
              />
              <button
                className="desk-reset-tool"
                type="button"
                onClick={() => updateToolSetting(DEFAULT_TOOL_SETTINGS[tool as PaintTool])}
              >
                استعادة إعدادات هذه الأداة
              </button>
            </fieldset>
          )}
          {tool !== "fill" && tool !== "eraser" && tool !== "pan" && tool !== "picker" && (
            <fieldset>
              <legend>عتامة الفرشاة: {opacity}٪</legend>
              <input
                className="desk-range"
                type="range"
                min="10"
                max="100"
                step="5"
                value={opacity}
                aria-label="عتامة الفرشاة"
                onChange={(e) => updateToolSetting({ opacity: Number(e.target.value) })}
              />
            </fieldset>
          )}
          {tool !== "pan" && tool !== "picker" && (
            <fieldset className="desk-tool-sample">
              <legend>معاينة الأداة</legend>
              <canvas
                ref={toolPreview}
                width={260}
                height={76}
                aria-label="شكل القلم أو الفرشاة باللون والسُمك الحاليين"
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
          <div className="desk-clear">
            {confirmClear ? (
              <div role="group" aria-label="تأكيد مسح اللوحة">
                <span>تمسح الألوان من هذه الورقة؟ يمكنك التراجع بعدها.</span>
                <button type="button" onClick={clearArtwork}>
                  امسح الألوان
                </button>
                <button type="button" onClick={() => setConfirmClear(false)}>
                  إلغاء
                </button>
              </div>
            ) : (
              <button type="button" disabled={!canClear} onClick={() => setConfirmClear(true)}>
                <Eraser size={18} /> مسح الألوان
              </button>
            )}
          </div>
          <p className="desk-status" role="status">
            {message || (load === "ready" && counts[0] > 0 ? "حُفظت رسمتك على هذا الجهاز" : "")}
          </p>
        </aside>
      </div>
    </section>
  );
}
