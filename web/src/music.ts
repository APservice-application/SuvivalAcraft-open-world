// Music (web) — CP-018: เพลงลูปสังเคราะห์ด้วย WebAudio (ไม่ต้องมีไฟล์)
// ธีมกลางวัน (เบา สดใส) / กลางคืน (ช้า หม่น) สลับตามเวลาในเกม

export function noteFreq(note: string): number {
  // รองรับ "C4" "F#3" ฯลฯ — A4 = 440 Hz
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const m = /^([A-G]#?)(-?\d)$/.exec(note);
  if (!m) return 440;
  const semi = names.indexOf(m[1]!);
  if (semi < 0) return 440;
  const octave = Number(m[2]);
  const midi = (octave + 1) * 12 + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** step ละ 1 บีท (null = เว้นเสียง) */
export const DAY_THEME: readonly (string | null)[] = [
  "C4", "E4", "G4", "E4", "F4", "A4", "G4", null,
  "C4", "E4", "G4", "C5", "B4", "G4", "E4", null,
  "D4", "F4", "A4", "F4", "E4", "G4", "C5", null,
  "G4", "E4", "D4", "C4", "D4", "E4", "C4", null,
];

export const NIGHT_THEME: readonly (string | null)[] = [
  "A3", null, "C4", null, "E4", null, "C4", null,
  "F3", null, "A3", null, "C4", null, "A3", null,
  "D4", null, "F4", null, "E4", null, "C4", null,
  "E4", null, "B3", null, "A3", null, null, null,
];

export interface SeqNote { step: number; freq: number; dur: number; }

/** แปลงชุดโน้ตเป็นลำดับเสียง (pure) — stepSec = ความยาว 1 step วินาที */
export function buildSequence(notes: readonly (string | null)[], stepSec: number, durMult = 0.9): SeqNote[] {
  const out: SeqNote[] = [];
  notes.forEach((n, i) => {
    if (!n) return;
    out.push({ step: i, freq: noteFreq(n), dur: stepSec * durMult });
  });
  return out;
}

export const THEME_STEPS: Record<"day" | "night", { notes: readonly (string | null)[]; stepSec: number; gain: number }> = {
  day: { notes: DAY_THEME, stepSec: 0.28, gain: 0.022 },
  night: { notes: NIGHT_THEME, stepSec: 0.42, gain: 0.02 },
};

export function themeLengthSec(theme: "day" | "night"): number {
  const t = THEME_STEPS[theme];
  return t.notes.length * t.stepSec;
}

/** โครงสร้าง AudioContext แบบ minimal (typecheck ผ่านทั้ง node/web) */
interface Mctx {
  currentTime: number;
  state?: string;
  resume?: () => Promise<void>;
  destination: unknown;
  createOscillator(): {
    type: string;
    frequency: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void };
    connect(n: unknown): void;
    start(t: number): void;
    stop(t: number): void;
  };
  createGain(): {
    gain: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void };
    connect(n: unknown): void;
  };
}

type ThemeName = "day" | "night";

export class MusicEngine {
  muted = false;
  private ctx: Mctx | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private theme: ThemeName = "day";
  private nextTime = 0;
  private step = 0;

  /** เรียกจาก user gesture (ใช้ context เดียวกับ Sfx ได้ถ้าส่งมา) */
  unlock(shared?: unknown): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume?.().catch(() => {});
      return;
    }
    if (shared) { this.ctx = shared as Mctx; return; }
    const g = globalThis as unknown as { AudioContext?: new () => Mctx; webkitAudioContext?: new () => Mctx };
    const Ctor = g.AudioContext ?? g.webkitAudioContext;
    if (!Ctor) return;
    try { this.ctx = new Ctor(); } catch { this.ctx = null; }
  }

  setTheme(theme: ThemeName): void {
    if (this.theme === theme) return;
    this.theme = theme;
    this.step = 0; // เริ่มธีมใหม่จากต้น
  }

  get currentTheme(): ThemeName {
    return this.theme;
  }

  start(): void {
    if (this.muted || !this.ctx || this.timer) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) this.stop();
    else this.start();
    return this.muted;
  }

  /** ตั้งเวลาเสียงล่วงหน้าเล็กน้อยเรื่อย ๆ (look-ahead scheduler) */
  private schedule(): void {
    if (!this.ctx || this.muted) return;
    const t = THEME_STEPS[this.theme];
    const ahead = this.ctx.currentTime + 0.5;
    let guard = 0;
    while (this.nextTime < ahead && guard++ < 32) {
      const seq = buildSequence([t.notes[this.step % t.notes.length] ?? null], t.stepSec, 0.9);
      const n = seq[0];
      if (n) this.playNote(n.freq, this.nextTime, n.dur, t.gain);
      this.nextTime += t.stepSec;
      this.step += 1;
    }
  }

  private playNote(freq: number, at: number, dur: number, gainV: number): void {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(gainV, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    } catch { /* ignore */ }
  }
}
