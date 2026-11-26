import { useEffect, useState, type PointerEvent } from "react";
import { Check, Pipette, Plus, Minus, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { palettes } from "./palettes";
import { colorShades, savedColors } from "./controls";
import { colorFromHsv, hsvFromColor, type Hsv } from "./color-plane";

const pinsKey = "kidzy:desk:pinned-colors:v1";
const paletteKey = "kidzy:desk:palette:v1";
const paletteTabKey = "kidzy:desk:palette-tab:v1";

type Swatch = { name: string; hex: string };
function Swatches({
  label,
  entries,
  selected,
  choose,
}: {
  label: string;
  entries: readonly Swatch[];
  selected: string;
  choose: (hex: string) => void;
}) {
  return (
    <div className="desk-swatches" role="group" aria-label={label}>
      {entries.map(({ name, hex }) => (
        <button
          type="button"
          key={hex}
          title={name}
          aria-label={name}
          aria-pressed={selected === hex}
          onClick={() => choose(hex)}
        >
          <span style={{ background: hex }}>{selected === hex && <Check size={16} />}</span>
        </button>
      ))}
    </div>
  );
}

export function ColorPalette({
  color,
  onColor,
  recent,
  onPick,
}: {
  color: string;
  onColor: (hex: string) => void;
  recent: string[];
  onPick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"palette" | "mix">("palette");
  const [palette, setPalette] = useState<(typeof palettes)[number]["id"]>("bright");
  const [draft, setDraft] = useState(() => hsvFromColor(color));
  const [hexEntry, setHexEntry] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      setPinned(savedColors(JSON.parse(localStorage.getItem(pinsKey) ?? "[]")));
    } catch {
      /* Storage is optional. */
    }
    try {
      const savedPalette = localStorage.getItem(paletteKey);
      if (palettes.some((item) => item.id === savedPalette)) {
        setPalette(savedPalette as (typeof palettes)[number]["id"]);
      }
      const savedTab = localStorage.getItem(paletteTabKey);
      if (savedTab === "palette" || savedTab === "mix") setTab(savedTab);
    } catch {
      /* The default palette remains available without storage. */
    }
  }, []);
  function remember(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Keep the choice for this session. */
    }
  }
  const hsv = colorFromHsv(draft) === color.toLowerCase() ? draft : hsvFromColor(color, draft.hue);
  const isPinned = pinned.includes(color.toLowerCase());
  function choose(hex: string) {
    onColor(hex.toLowerCase());
    setHexEntry(null);
    setNotice("");
  }
  function mix(next: Hsv) {
    setDraft(next);
    choose(colorFromHsv(next));
  }
  function movePoint(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const unit = (n: number) => Math.max(0, Math.min(1, n));
    mix({
      ...hsv,
      saturation: unit((e.clientX - box.left) / box.width),
      value: 1 - unit((e.clientY - box.top) / box.height),
    });
  }
  function finishHex() {
    if (hexEntry === null) return;
    const value = hexEntry.trim().replace(/^#/, "");
    if (/^[0-9a-f]{6}$/i.test(value)) choose("#" + value);
    else {
      setHexEntry(null);
      setNotice("اكتب ست خانات للون، مثل D54B72.");
    }
  }
  function pin() {
    const hex = color.toLowerCase();
    const next = isPinned ? pinned.filter((c) => c !== hex) : [...pinned, hex];
    setPinned(next);
    try {
      localStorage.setItem(pinsKey, JSON.stringify(next));
      setNotice(isPinned ? "أُزيل اللون من ألواني." : "حُفظ اللون في ألواني.");
    } catch {
      setNotice("ألواني متاحة لهذه الجلسة فقط.");
    }
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setHexEntry(null);
        setNotice("");
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="rack-color">
          <i style={{ background: color }} /> الألوان
        </button>
      </PopoverTrigger>
      <PopoverContent
        dir="rtl"
        aria-label="بالتة الألوان"
        className="desk-flyout color-flyout"
        collisionPadding={10}
      >
        <div className="flyout-title">
          <strong>بالتة الألوان</strong>
          <button type="button" aria-label="إغلاق البالتة" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="palette-tabs" role="group" aria-label="طريقة اختيار اللون">
          <button
            type="button"
            aria-pressed={tab === "palette"}
            onClick={() => {
              setTab("palette");
              remember(paletteTabKey, "palette");
            }}
          >
            بالتات جاهزة
          </button>
          <button
            type="button"
            aria-pressed={tab === "mix"}
            onClick={() => {
              setTab("mix");
              remember(paletteTabKey, "mix");
            }}
          >
            مزج لون
          </button>
        </div>
        {tab === "palette" ? (
          <>
            <div className="desk-palettes" role="group" aria-label="مجموعات الألوان">
              {palettes.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  aria-pressed={p.id === palette}
                  onClick={() => {
                    setPalette(p.id);
                    remember(paletteKey, p.id);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <Swatches
              label="ألوان البالتة"
              entries={palettes.find((p) => p.id === palette)!.colors}
              selected={color}
              choose={choose}
            />
            <span className="desk-subtitle">درجات اللون</span>
            <Swatches
              label="درجات اللون"
              entries={colorShades(color).map((hex) => ({ hex, name: hex }))}
              selected={color}
              choose={choose}
            />
          </>
        ) : (
          <>
            <div
              className="color-plane"
              aria-hidden="true"
              style={{ backgroundColor: `hsl(${hsv.hue} 100% 50%)` }}
              onPointerDown={(e) => {
                if (!e.isPrimary || e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                movePoint(e);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) movePoint(e);
              }}
            >
              <i
                style={{
                  left: hsv.saturation * 100 + "%",
                  top: (1 - hsv.value) * 100 + "%",
                  background: color,
                }}
              />
            </div>
            <input
              className="palette-hue"
              type="range"
              dir="ltr"
              aria-label="طيف اللون"
              min="0"
              max="360"
              value={Math.round(hsv.hue)}
              onChange={(e) => mix({ ...hsv, hue: Number(e.target.value) })}
            />
            <details className="palette-numbers">
              <summary>ضبط التشبّع والسطوع</summary>
              {(["saturation", "value"] as const).map((key) => (
                <label key={key}>
                  {key === "saturation" ? "التشبّع" : "السطوع"} · {Math.round(hsv[key] * 100)}٪
                  <input
                    type="range"
                    dir="ltr"
                    min="0"
                    max="100"
                    value={Math.round(hsv[key] * 100)}
                    onChange={(e) => mix({ ...hsv, [key]: Number(e.target.value) / 100 })}
                  />
                </label>
              ))}
            </details>
          </>
        )}
        <div className="palette-actions">
          <label className="hex-entry">
            <i style={{ background: color }} />
            <input
              dir="ltr"
              aria-label="رمز اللون HEX"
              autoComplete="off"
              spellCheck={false}
              value={hexEntry ?? color.toUpperCase()}
              onChange={(e) => setHexEntry(e.target.value)}
              onBlur={finishHex}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </label>
          <button
            type="button"
            title="التقاط لون من الورقة"
            aria-label="التقاط لون من الورقة"
            onClick={() => {
              setOpen(false);
              onPick();
            }}
          >
            <Pipette size={18} />
          </button>
          <button
            type="button"
            aria-label={isPinned ? "إزالة من ألواني" : "حفظ في ألواني"}
            title={isPinned ? "إزالة من ألواني" : "حفظ في ألواني"}
            disabled={!isPinned && pinned.length >= 8}
            onClick={pin}
          >
            {isPinned ? <Minus size={18} /> : <Plus size={18} />}
          </button>
        </div>
        {notice && (
          <p role="status" className="desk-subtitle">
            {notice}
          </p>
        )}
        {pinned.length > 0 && (
          <>
            <span className="desk-subtitle">ألواني ({pinned.length}/8)</span>
            <Swatches
              label="ألواني المحفوظة"
              entries={pinned.map((hex) => ({ name: hex, hex }))}
              selected={color}
              choose={choose}
            />
          </>
        )}
        {recent.length > 0 && (
          <>
            <span className="desk-subtitle">استخدمتها مؤخرًا</span>
            <Swatches
              label="الألوان الأخيرة"
              entries={recent.map((hex) => ({ name: hex, hex }))}
              selected={color}
              choose={choose}
            />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
