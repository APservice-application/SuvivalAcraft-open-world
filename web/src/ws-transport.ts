// WebSocket Transport (web) — ต่อ co-op ข้ามเครื่องผ่าน relay server (CP-016)
// browser: new WebSocketTransport("ws://192.168.x.x:9310")
// tests/node: new WebSocketTransport(url, WsClientImpl)
import type { MpMsg, Transport } from "./multiplayer.js";

export interface WSLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
}
export type WSImp = new (url: string) => WSLike;

export class WebSocketTransport implements Transport {
  private ws: WSLike;
  private queue: string[] = [];
  private open = false;
  private closed = false;
  private cb: ((msg: MpMsg) => void) | null = null;

  constructor(url: string, imp?: WSImp, room?: string) {
    const g = globalThis as unknown as { WebSocket?: WSImp };
    const Ctor = imp ?? g.WebSocket;
    if (!Ctor) throw new Error("WebSocket unavailable");
    if (room) this.queue.push(JSON.stringify({ m: "bind", room }));
    this.ws = new Ctor(url);
    this.ws.onopen = () => {
      this.open = true;
      for (const q of this.queue) {
        try { this.ws.send(q); } catch { break; }
      }
      this.queue = [];
    };
    this.ws.onmessage = (ev) => {
      if (this.closed) return;
      try {
        const raw = typeof ev.data === "string" ? ev.data : String(ev.data);
        const msg = JSON.parse(raw) as MpMsg;
        if (msg && typeof msg === "object" && "m" in msg) this.cb?.(msg);
      } catch { /* ignore bad frames */ }
    };
    this.ws.onerror = () => { /* caller sees via no connection */ };
    this.ws.onclose = () => { this.open = false; };
  }

  send(msg: MpMsg): void {
    if (this.closed) return;
    const s = JSON.stringify(msg);
    if (this.open) {
      try { this.ws.send(s); } catch { this.queue.push(s); }
    } else {
      this.queue.push(s);
    }
  }

  onData(cb: (msg: MpMsg) => void): void {
    this.cb = cb;
  }

  close(): void {
    this.closed = true;
    try { this.ws.close(); } catch { /* ignore */ }
  }
}
