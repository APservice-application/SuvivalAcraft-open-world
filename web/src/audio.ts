// Audio (web) — SFX สังเคราะห์ด้วย WebAudio ไม่ต้องมีไฟล์เสียง (งาน Audio)
export type SfxName =
  | "attack" | "kill" | "craft" | "place" | "eat" | "harvest"
  | "levelup" | "hurt" | "quest" | "pickup" | "click" | "coin" | "denied";

export interface SfxProfile {
  freq: number;
  endFreq?: number;
  dur: number;
  type: "square" | "sawtooth" | "triangle" | "sine";
  gain: number;
}

export const SFX_PROFILES: Record<SfxName, SfxProfile> = {
  attack: { freq: 220, endFreq: 110, dur: 0.08, type: "square", gain: 0.05 },
  hurt: { freq: 160, endFreq: 80, dur: 0.15, type: "sawtooth", gain: 0.06 },
  kill: { freq: 330, endFreq: 660, dur: 0.2, type: "triangle", gain: 0.07 },
  craft: { freq: 440, endFreq: 880, dur: 0.15, type: "triangle", gain: 0.07 },
  place: { freq: 180, endFreq: 120, dur: 0.1, type: "square", gain: 0.06 },
  eat: { freq: 300, endFreq: 200, dur: 0.12, type: "sine", gain: 0.06 },
  harvest: { freq: 520, endFreq: 780, dur: 0.15, type: "sine", gain: 0.06 },
  levelup: { freq: 523, endFreq: 1046, dur: 0.35, type: "triangle", gain: 0.08 },
  quest: { freq: 660, endFreq: 990, dur: 0.25, type: "sine", gain: 0.07 },
  pickup: { freq: 700, endFreq: 900, dur: 0.08, type: "sine", gain: 0.05 },
  click: { freq: 500, dur: 0.04, type: "square", gain: 0.03 },
  coin: { freq: 880, endFreq: 1320, dur: 0.09, type: "square", gain: 0.05 },
  denied: { freq: 220, endFreq: 160, dur: 0.12, type: "sawtooth", gain: 0.06 },
};

/** Minimal structural AudioContext (typecheck ผ่านทั้ง node/web) */
interface Actx {
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

export class Sfx {
  private ctx: Actx | null = null;
  muted = false;

  /** เรียกจาก user gesture ครั้งแรก (autoplay policy) */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume?.().catch(() => {});
      return;
    }
    const g = globalThis as unknown as { AudioContext?: new () => Actx; webkitAudioContext?: new () => Actx };
    const Ctor = g.AudioContext ?? g.webkitAudioContext;
    if (!Ctor) return;
    try { this.ctx = new Ctor(); } catch { this.ctx = null; }
  }

  /** เล่นเสียง — no-op ถ้ายังไม่ unlock / muted / ไม่มี WebAudio */
  play(name: SfxName): void {
    if (this.muted || !this.ctx) return;
    const p = SFX_PROFILES[name];
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = p.type;
      osc.frequency.setValueAtTime(p.freq, t);
      if (p.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, p.endFreq), t + p.dur);
      gain.gain.setValueAtTime(p.gain, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + p.dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + p.dur + 0.02);
    } catch { /* ignore audio errors */ }
  }
}
