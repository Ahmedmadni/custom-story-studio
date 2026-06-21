// Lightweight kid-friendly SFX via Web Audio API — no audio files needed.
// Toggleable via localStorage key "hekayati_sfx_enabled".

const SFX_KEY = "hekayati_sfx_enabled";

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function isSfxEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SFX_KEY) !== "0";
}

export function setSfxEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SFX_KEY, on ? "1" : "0");
}

function tone(
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.18,
) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + startOffset;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function play(fn: () => void) {
  if (!isSfxEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => undefined);
  try { fn(); } catch { /* ignore */ }
}

/** نغمة "صحيح" مرحة — ترنيمة قصيرة صاعدة C5→E5→G5 */
export function playCorrect() {
  play(() => {
    tone(523.25, 0, 0.12, "triangle", 0.22); // C5
    tone(659.25, 0.1, 0.12, "triangle", 0.22); // E5
    tone(783.99, 0.2, 0.18, "triangle", 0.24); // G5
  });
}

/** نغمة "خطأ" لطيفة غير مزعجة — E4→C4 */
export function playWrong() {
  play(() => {
    tone(329.63, 0, 0.12, "sine", 0.18); // E4
    tone(261.63, 0.1, 0.18, "sine", 0.18); // C4
  });
}

/** نقرة قصيرة عند الضغط */
export function playTap() {
  play(() => tone(880, 0, 0.04, "square", 0.08));
}

/** انتصار/إنهاء اللغز — C5→E5→G5→C6 */
export function playWin() {
  play(() => {
    tone(523.25, 0, 0.14, "triangle", 0.24);
    tone(659.25, 0.12, 0.14, "triangle", 0.24);
    tone(783.99, 0.24, 0.14, "triangle", 0.24);
    tone(1046.5, 0.36, 0.28, "triangle", 0.26);
  });
}

/** صوت مطابقة زوج في لعبة الذاكرة */
export function playPair() {
  play(() => {
    tone(659.25, 0, 0.1, "triangle", 0.2);
    tone(987.77, 0.08, 0.16, "triangle", 0.22);
  });
}
