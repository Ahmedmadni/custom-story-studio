import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import {
  SlidersHorizontal,
  X,
  Download,
  Eraser,
  PaintBucket,
  PenLine,
  FileDown,
  Hand,
  Pipette,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { PenRack } from "./PenRack";
import { ColorPalette } from "./ColorPalette";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { COLORS } from "../games-data";
import {
  DEFAULT_TOOL_SETTINGS,
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
import { drawingStorageKey } from "./progress";

type DeskTool = Tool | "picker" | "pan";

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
const activeColorKey = "kidzy:desk:active-color:v1";
const activeToolKey = "kidzy:desk:active-tool:v1";

export function DrawingDesk({ id, title }: { id: string; title: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const [toolPreview, setToolPreview] = useState<HTMLCanvasElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pendingTouch = useRef<{ pointer: number; at: Point } | null>(null);
  const gesture = useRef<{
    distance: number;
    zoom: number;
    center: { x: number; y: number };
  } | null>(null);
  const zoomAnchor = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(
    null,
  );
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
  const [toolSettings, setToolSettings] = useState(() => savedToolSettings(null));
  const [toolSettingsLoaded, setToolSettingsLoaded] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [fillTolerance, setFillTolerance] = useState(28);
  const [fillMode, setFillMode] = useState<"paint" | "erase">("paint");
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    if (!anchor || !paper.current || !viewport.current) return;
    zoomAnchor.current = null;
    const box = paper.current.getBoundingClientRect();
    viewport.current.scrollLeft += box.left + box.width * anchor.x - anchor.clientX;
    viewport.current.scrollTop += box.top + box.height * anchor.y - anchor.clientY;
  }, [zoom]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [penOnly, setPenOnly] = useState(false);
  const storageKey = drawingStorageKey(id);
  const marks = history.current.done;
  let lastClear = -1;
  for (let i = marks.length - 1; i >= 0; i--) {
    if (marks[i].tool === "clear") {
      lastClear = i;
      break;
    }
  }
  const canClear = marks.length > lastClear + 1;
  const setting =
    tool in DEFAULT_TOOL_SETTINGS ? toolSettings[tool as PaintTool] : toolSettings.brush;
  const { size, opacity } = setting;

  function chooseTool(next: DeskTool) {
    if (next === tool && next in DEFAULT_TOOL_SETTINGS) setSettingsOpen(true);
    setTool(next);
    if (next !== "picker" && next !== "pan") lastPaintTool.current = next;
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
      const previousColor = localStorage.getItem(activeColorKey);
      if (previousColor && /^#[0-9a-f]{6}$/i.test(previousColor)) {
        setColor(previousColor.toLowerCase());
      }
      const previousTool = localStorage.getItem(activeToolKey);
      if (
        previousTool === "fill" ||
        (previousTool && Object.hasOwn(DEFAULT_TOOL_SETTINGS, previousTool))
      ) {
        const restoredTool = previousTool as PaintTool | "fill";
        setTool(restoredTool);
        lastPaintTool.current = restoredTool;
      }
    } catch {
      // Browser storage can be disabled; the controls still work for this session.
    }
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      localStorage.setItem(activeColorKey, color);
      if (tool !== "picker" && tool !== "pan") localStorage.setItem(activeToolKey, tool);
    } catch {
      // Keep the choice available for this session.
    }
  }, [color, tool, preferencesLoaded]);

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
    const ctx = toolPreview?.getContext("2d");
    if (!ctx || tool === "pan" || tool === "picker") return;
    ctx.clearRect(0, 0, 260, 76);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 260, 76);
    const mark: Mark = {
      tool,
      color,
      size,
      opacity: opacity / 100,
      points: Array.from(
        { length: 41 },
        (_, i) => [24 + i * 5.3, 38 + 12 * Math.sin((i * Math.PI) / 16)] as Point,
      ),
    };
    if (tool === "fill") {
      ctx.fillStyle = fillMode === "erase" ? "#b6a9d2" : color;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(130, 38, 25, 0, Math.PI * 2);
      ctx.fill();
      if (fillMode === "erase") {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(130, 38, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      if (tool === "eraser") {
        ctx.fillStyle = "#b6a9d2";
        ctx.fillRect(20, 19, 220, 38);
      }
      if (tool === "marker" || tool === "watercolor") smoothStroke(ctx, mark);
      else mark.points.slice(1).forEach((end, i) => segment(ctx, mark, mark.points[i], end));
    }
  }, [tool, color, size, opacity, fillMode, toolPreview]);

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
    if (mark.tool !== "eraser" && mark.tool !== "clear" && mark.fillMode !== "erase") {
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
  function beginInput(e: PointerEvent<HTMLCanvasElement>, at: Point) {
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
        setColor("#" + hex);
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
      ...(tool === "fill" ? { tolerance: fillTolerance, fillMode } : {}),
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
  function start(e: PointerEvent<HTMLCanvasElement>) {
    if (load !== "ready" || e.button !== 0) return;
    if (e.pointerType !== "touch") {
      if (active.current || panning.current) return;
      if (e.isPrimary) beginInput(e, point(e));
      return;
    }
    if (active.current && !touches.current.has(active.current.pointer)) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (touches.current.size === 1) {
      pendingTouch.current = { pointer: e.pointerId, at: point(e) };
    } else if (touches.current.size === 2) {
      if (active.current) {
        replay(e.currentTarget.getContext("2d")!, boundary.current, history.current.done);
        previewCanvas.current!.getContext("2d")!.clearRect(0, 0, PAPER, PAPER_HEIGHT);
        active.current = null;
      }
      panning.current = null;
      pendingTouch.current = null;
      const [a, b] = [...touches.current.values()];
      gesture.current = {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom,
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    }
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "pen") lastPenAt.current = Date.now();
    if (e.pointerType === "touch" && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pinch = gesture.current;
      if (pinch) {
        if (touches.current.size !== 2) return;
        const [a, b] = [...touches.current.values()];
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const view = viewport.current!;
        view.scrollLeft += pinch.center.x - center.x;
        view.scrollTop += pinch.center.y - center.y;
        pinch.center = center;
        const box = paper.current!.getBoundingClientRect();
        zoomAnchor.current = {
          x: (center.x - box.left) / box.width,
          y: (center.y - box.top) / box.height,
          clientX: center.x,
          clientY: center.y,
        };
        const nextZoom = Math.max(
          1,
          Math.min(3, (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.distance),
        );
        if (nextZoom === zoom) zoomAnchor.current = null;
        else setZoom(nextZoom);
        return;
      }
      if (pendingTouch.current?.pointer === e.pointerId) {
        const at = pendingTouch.current.at;
        pendingTouch.current = null;
        beginInput(e, at);
      }
    }
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
    if (e.pointerType === "touch") {
      if (pendingTouch.current?.pointer === e.pointerId) {
        if (e.type === "pointerup") beginInput(e, pendingTouch.current.at);
        pendingTouch.current = null;
      }
      touches.current.delete(e.pointerId);
      if (gesture.current) {
        if (touches.current.size === 0) gesture.current = null;
        return;
      }
    }
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
      <div className="rack-shell">
        <PenRack tool={tool} color={color} onSelect={chooseTool} />
        <div className="rack-controls">
          <ColorPalette
            color={color}
            onColor={setColor}
            recent={recentColors}
            onPick={() => chooseTool("picker")}
          />
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger asChild>
              <button type="button" title="إعدادات الأداة" aria-label="إعدادات الأداة">
                <SlidersHorizontal size={19} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="desk-kit desk-flyout"
              dir="rtl"
              aria-label="إعدادات الأداة"
              collisionPadding={10}
            >
              <div className="flyout-title">
                <strong>إعدادات الأداة</strong>
                <button
                  type="button"
                  aria-label="إغلاق الإعدادات"
                  onClick={() => setSettingsOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              {tool === "fill" && (
                <fieldset>
                  <legend>طريقة تعبئة المساحة</legend>
                  <div
                    className="desk-fill-options desk-fill-modes"
                    role="group"
                    aria-label="تلوين المساحة أو إزالة لونها"
                  >
                    <button
                      type="button"
                      aria-pressed={fillMode === "paint"}
                      onClick={() => setFillMode("paint")}
                    >
                      لون المساحة
                    </button>
                    <button
                      type="button"
                      aria-pressed={fillMode === "erase"}
                      onClick={() => setFillMode("erase")}
                    >
                      امسح لونها
                    </button>
                  </div>
                  <span className="desk-subtitle">انتشار التعبئة</span>
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
                    {fillMode === "erase"
                      ? "المس داخل المساحة الملونة لإزالة لونها. يمكنك التراجع دائمًا."
                      : "إذا بقيت نقاط صغيرة غير ملونة، جرّب «واسع». حدود الرسمة تظل محمية."}
                  </p>
                </fieldset>
              )}
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
                    ref={setToolPreview}
                    width={260}
                    height={76}
                    aria-label="شكل القلم أو الفرشاة باللون والسُمك الحاليين"
                  />
                </fieldset>
              )}
            </PopoverContent>
          </Popover>
          <button
            type="button"
            title="تعبئة"
            aria-label="تعبئة"
            aria-pressed={tool === "fill"}
            onClick={() => {
              chooseTool("fill");
              setSettingsOpen(true);
            }}
          >
            <PaintBucket size={19} />
          </button>
          <button
            type="button"
            title="قطّارة"
            aria-label="قطّارة"
            aria-pressed={tool === "picker"}
            onClick={() => chooseTool("picker")}
          >
            <Pipette size={19} />
          </button>
          <button
            type="button"
            title="تحريك"
            aria-label="تحريك"
            aria-pressed={tool === "pan"}
            onClick={() => chooseTool("pan")}
          >
            <Hand size={19} />
          </button>
          <button
            type="button"
            title="تراجع"
            aria-label="تراجع"
            disabled={!counts[0]}
            onClick={() => step(true)}
          >
            <Undo2 size={19} />
          </button>
          <button
            type="button"
            title="إعادة"
            aria-label="إعادة"
            disabled={!counts[1]}
            onClick={() => step(false)}
          >
            <Redo2 size={19} />
          </button>
        </div>
      </div>
      <p className="desk-touch-tip">بإصبعين يمكنك تكبير الورقة وتحريكها</p>
      <div className="desk-mat" ref={viewport}>
        <div
          ref={paper}
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
      <div className="rack-foot">
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
      </div>
    </section>
  );
}
