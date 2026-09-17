// Multiplayer (web) — งานที่ 16: LAN/Local co-op แบบ host-authoritative
// โครงสร้าง: Transport (pluggable) + HostSession (ตัดสินใจ+validate+chained action log)
//           + GuestSession (ส่ง intent + reconcile จาก snapshot)
// Transport ตอนนี้: BroadcastChannel (แท็บ/หน้าต่างเดียวกัน origin เดียว = local co-op)
//                   ต่อยอดข้ามเครื่องได้โดยเพิ่ม WebRTC/WebSocket Transport โดยไม่แก้ protocol

export const MP_SPEED = 90; // ต้องตรงกับ speed ใน main.ts
export const MAX_PLAYERS = 4;
export const MAX_ACTIONS_PER_SEC = 12;
export const LOG_CAP = 200;
export const ROOM_CODE_LEN = 4;

export interface MpPlayerState {
  id: string;
  name: string;
  color: string;
  x: number;
  z: number;
  hp: number;
  level: number;
}

export type MpAction =
  | { t: "move"; dx: number; dz: number }
  | { t: "stop" }
  | { t: "gather" }
  | { t: "place"; item: string }
  | { t: "attack" };

/** สถานะโลกฝั่งโฮสต์ (CP-015 world-effect sync) */
export interface MpWorldEnemy { x: number; z: number; kind: string; hp: number; maxHp: number; }
export interface MpWorldPickup { x: number; z: number; item: string; }
export interface MpWorldState {
  enemies: MpWorldEnemy[];
  pickups: MpWorldPickup[];
  event?: { kind: string; endsIn: number };
  merchant?: { x: number; z: number } | null;
}

export type MpMsg =
  | { m: "join"; room: string; id: string; name: string; color: string }
  | { m: "welcome"; room: string; hostId: string; players: MpPlayerState[] }
  | { m: "action"; room: string; id: string; seq: number; action: MpAction }
  | { m: "snapshot"; room: string; players: MpPlayerState[]; world?: MpWorldState }
  | { m: "leave"; room: string; id: string };

export interface Transport {
  send(msg: MpMsg): void;
  onData(cb: (msg: MpMsg) => void): void;
  close(): void;
}

/** รหัสห้อง 4 ตัวอักษร (ไม่มีตัวอักษรกำกวม) */
export function makeRoomCode(r: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < ROOM_CODE_LEN; i++) code += alphabet[Math.floor(r() * alphabet.length)];
  return code;
}

/** id ผู้เล่นสุ่ม */
export function makePlayerId(r: () => number = Math.random): string {
  return `p-${Date.now().toString(36)}-${Math.floor(r() * 1e9).toString(36)}`;
}

/** --- Transport แบบ in-memory (ทดสอบ/loopback หลาย session ในกระบวนการเดียว) --- */
export class LoopbackTransport implements Transport {
  private peer: LoopbackTransport | null = null;
  private cb: ((msg: MpMsg) => void) | null = null;
  closed = false;

  static pair(): [LoopbackTransport, LoopbackTransport] {
    const a = new LoopbackTransport();
    const b = new LoopbackTransport();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  send(msg: MpMsg): void {
    if (this.closed || !this.peer) return;
    setTimeout(() => this.peer?.cb?.(msg), 0);
  }

  onData(cb: (msg: MpMsg) => void): void {
    this.cb = cb;
  }

  close(): void {
    this.closed = true;
    this.cb = null;
  }
}

/** --- Transport ผ่าน BroadcastChannel (local co-op ข้ามแท็บ) --- */
export class BroadcastChannelTransport implements Transport {
  private ch: unknown = null;
  private cb: ((msg: MpMsg) => void) | null = null;

  constructor(room: string) {
    const g = globalThis as unknown as { BroadcastChannel?: new (name: string) => unknown };
    if (!g.BroadcastChannel) throw new Error("BroadcastChannel unavailable");
    const ch = new g.BroadcastChannel(`suvival-mp-${room}`);
    // ใช้ duck typing เพื่อไม่พึ่ง DOM lib
    type Ch = { onmessage: ((ev: { data?: unknown }) => void) | null; postMessage(d: unknown): void; close(): void };
    this.ch = ch;
    (ch as Ch).onmessage = (ev) => {
      try {
        const msg = ev.data as MpMsg;
        if (msg && typeof msg === "object" && "m" in msg) this.cb?.(msg);
      } catch { /* ignore bad frames */ }
    };
  }

  send(msg: MpMsg): void {
    try {
      (this.ch as { postMessage(d: unknown): void } | null)?.postMessage(msg);
    } catch { /* ignore */ }
  }

  onData(cb: (msg: MpMsg) => void): void {
    this.cb = cb;
  }

  close(): void {
    try { (this.ch as { close(): void } | null)?.close(); } catch { /* ignore */ }
    this.ch = null;
  }
}

// ------------------------------------------------------------
// Validation (host-side)
// ------------------------------------------------------------
/** intent เดินต้องเป็นเวกเตอร์สั้นๆ ที่ finite */
export function validateMoveIntent(a: { dx: number; dz: number }): boolean {
  if (!Number.isFinite(a.dx) || !Number.isFinite(a.dz)) return false;
  return Math.hypot(a.dx, a.dz) <= 1.001;
}

/** ปรับ intent ให้เป็น unit vector (สำหรับ integrate) */
export function normalizedDir(dx: number, dz: number): { dx: number; dz: number } {
  const m = Math.hypot(dx, dz);
  if (m < 1e-6) return { dx: 0, dz: 0 };
  return { dx: dx / m, dz: dz / m };
}

export interface LogEntry { seq: number; id: string; action: MpAction; }

interface HostPlayer extends MpPlayerState {
  dirX: number;
  dirZ: number;
  actionTimes: number[];
}

/** ฝั่งเจ้าบ้าน: ตัดสินใจทุกอย่าง + เก็บ chained action log */
export class HostSession {
  readonly room: string;
  readonly hostId: string;
  players = new Map<string, HostPlayer>();
  log: LogEntry[] = [];
  private seq = 0;
  private transport: Transport;

  constructor(room: string, hostId: string, hostPlayer: MpPlayerState, transport: Transport) {
    this.room = room;
    this.hostId = hostId;
    this.transport = transport;
    this.players.set(hostId, { ...hostPlayer, dirX: 0, dirZ: 0, actionTimes: [] });
    transport.onData((msg) => this.onMsg(msg));
  }

  get myPlayer(): MpPlayerState | undefined {
    return this.players.get(this.hostId);
  }

  /** เรียกทุกเฟรม: เดินผู้เล่นที่มี intent ค้าง แล้วส่ง snapshot ตามรอบ */
  tick(dt: number, broadcastEvery = 0.2): void {
    for (const p of this.players.values()) {
      if (p.dirX !== 0 || p.dirZ !== 0) {
        p.x += p.dirX * MP_SPEED * dt;
        p.z += p.dirZ * MP_SPEED * dt;
      }
    }
    this.snapTimer += dt;
    if (this.snapTimer >= broadcastEvery) {
      this.snapTimer = 0;
      this.transport.send({ m: "snapshot", room: this.room, players: this.playerList(), world: this.world });
    }
  }

  private snapTimer = 0;
  private world: MpWorldState = { enemies: [], pickups: [] };

  /** อัปเดตสถานะโลกที่จะ broadcast ไปพร้อม snapshot (เรียกจากเกมจริงทุก tick) */
  setWorld(world: MpWorldState): void {
    this.world = world;
  }

  get worldState(): MpWorldState {
    return this.world;
  }

  playerList(): MpPlayerState[] {
    return [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, color: p.color, x: p.x, z: p.z, hp: p.hp, level: p.level,
    }));
  }

  /** อัปเดตตำแหน่ง/สถานะของ host เอง (จากเกมจริง) */
  updateSelf(x: number, z: number, hp: number, level: number): void {
    const me = this.players.get(this.hostId);
    if (me) { me.x = x; me.z = z; me.hp = hp; me.level = level; }
  }

  private onMsg(msg: MpMsg): void {
    if (msg.room !== this.room) return;
    switch (msg.m) {
      case "join": this.onJoin(msg); break;
      case "action": this.onAction(msg); break;
      case "leave": this.players.delete(msg.id); break;
      default: break; // host ไม่สน welcome/snapshot
    }
  }

  private onJoin(msg: Extract<MpMsg, { m: "join" }>): void {
    if (this.players.has(msg.id)) return;
    if (this.players.size >= MAX_PLAYERS) return; // เต็ม — ไม่ตอบ welcome
    this.players.set(msg.id, { id: msg.id, name: msg.name.slice(0, 20), color: msg.color, x: 36, z: 36, hp: 20, level: 1, dirX: 0, dirZ: 0, actionTimes: [] });
    this.transport.send({ m: "welcome", room: this.room, hostId: this.hostId, players: this.playerList() });
  }

  private onAction(msg: Extract<MpMsg, { m: "action" }>): void {
    const p = this.players.get(msg.id);
    if (!p) return;
    // rate limit
    const now = Date.now();
    p.actionTimes = p.actionTimes.filter((t) => now - t < 1000);
    if (p.actionTimes.length >= MAX_ACTIONS_PER_SEC) return; // ถูกพัก — ทิ้งเงียบ ๆ
    p.actionTimes.push(now);
    // validate
    if (msg.action.t === "move") {
      if (!validateMoveIntent(msg.action)) return;
      const d = normalizedDir(msg.action.dx, msg.action.dz);
      p.dirX = d.dx;
      p.dirZ = d.dz;
    } else if (msg.action.t === "stop") {
      p.dirX = 0;
      p.dirZ = 0;
    }
    this.pushLog(msg.id, msg.action);
  }

  private pushLog(id: string, action: MpAction): void {
    this.seq += 1;
    this.log.push({ seq: this.seq, id, action });
    if (this.log.length > LOG_CAP) this.log.splice(0, this.log.length - LOG_CAP);
  }

  /** hook สำหรับทดสอบ (บันทึกเข้า log โดยไม่ผ่าน rate limiter) */
  pushLogForTest(id: string, action: MpAction): void {
    this.pushLog(id, action);
  }

  close(): void {
    this.transport.close();
  }
}

/** ฝั่งผู้ร่วมเล่น: ส่ง intent + รับ snapshot เพื่อ render/reconcile */
export class GuestSession {
  readonly id: string;
  readonly room: string;
  players = new Map<string, MpPlayerState>();
  world: MpWorldState = { enemies: [], pickups: [] };
  joined = false;
  private seq = 0;
  private transport: Transport;
  private onJoinedCb: (() => void) | null = null;

  constructor(room: string, id: string, public name: string, public color: string, transport: Transport, onJoined?: () => void) {
    this.room = room;
    this.id = id;
    this.transport = transport;
    this.onJoinedCb = onJoined ?? null;
    transport.onData((msg) => this.onMsg(msg));
  }

  join(): void {
    this.transport.send({ m: "join", room: this.room, id: this.id, name: this.name, color: this.color });
  }

  sendAction(action: MpAction): void {
    if (!this.joined) return;
    this.seq += 1;
    this.transport.send({ m: "action", room: this.room, id: this.id, seq: this.seq, action });
  }

  /** ผู้เล่นคนอื่น (ไม่รวมตัวเอง) สำหรับ render ghost */
  others(): MpPlayerState[] {
    return [...this.players.values()].filter((p) => p.id !== this.id);
  }

  /** ตำแหน่ง authoritative ของตัวเองจาก host (ถ้ามี) */
  myAuthoritative(): MpPlayerState | undefined {
    return this.players.get(this.id);
  }

  private onMsg(msg: MpMsg): void {
    if (msg.room !== this.room) return;
    if (msg.m === "welcome") {
      this.joined = true;
      this.players = new Map(msg.players.map((p) => [p.id, p]));
      this.onJoinedCb?.();
    } else if (msg.m === "snapshot") {
      const seen = new Set<string>();
      for (const p of msg.players) {
        seen.add(p.id);
        this.players.set(p.id, p);
      }
      for (const id of [...this.players.keys()]) {
        if (!seen.has(id)) this.players.delete(id); // คนออกห้อง
      }
      if (msg.world) this.world = msg.world;
    }
  }

  close(): void {
    if (this.joined) this.transport.send({ m: "leave", room: this.room, id: this.id });
    this.transport.close();
  }
}
