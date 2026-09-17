// Save system (web) — versioned multi-world saves with pluggable storage.
// Storage preference: IndexedDB -> localStorage -> in-memory.
// Save format v2 (multi-world). Legacy v1 single-slot payload is migrated once.

import type { PlayerState } from "./state.js";
import type { PlotSave } from "./farming.js";

export interface WorldMeta {
  id: string;
  name: string;
  seed: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorldSaveV2 {
  v: 2;
  meta: WorldMeta;
  time: number;         // game-hour 0..24
  dayCount: number;
  gameSeconds: number;  // drives crop growth
  player: PlayerState;
  /** world edits from player: [x, z, tile][] */
  edits: [number, number, number][];
  /** farm plots: key "x,z" -> plot (crop + plantedAt + fert) */
  crops: Record<string, PlotSave>;
  /** quest progress (CP-012 quest chain) */
  quests?: { progress: Record<string, number>; done: Record<string, boolean> };
  /** explored zone keys "zx,zz" (explore quest) */
  zones?: string[];
  savedAt: number;
}

export const SAVE_VERSION = 2;
export const LEGACY_KEY = "suvival-save-v1";
export const LEGACY_ID = "migrated-v1";

const PREFIX = "suvival:";
const INDEX_KEY = `${PREFIX}worlds-index`;
const worldKey = (id: string) => `${PREFIX}world:${id}`;

// ------------------------------------------------------------
// Storage backends
// ------------------------------------------------------------
export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export class MemoryKV implements KVStore {
  private m = new Map<string, string>();
  async get(key: string): Promise<string | null> { return this.m.get(key) ?? null; }
  async set(key: string, value: string): Promise<void> { this.m.set(key, value); }
  async del(key: string): Promise<void> { this.m.delete(key); }
  async keys(): Promise<string[]> { return [...this.m.keys()]; }
}

export class LocalStorageKV implements KVStore {
  private ls: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; key(i: number): string | null; length: number };
  constructor(ls?: unknown) {
    const g = globalThis as unknown as { localStorage?: unknown };
    const chosen = ls ?? g.localStorage;
    if (!chosen) throw new Error("localStorage unavailable");
    this.ls = chosen as typeof this.ls;
  }
  async get(key: string): Promise<string | null> {
    try { return this.ls.getItem(key); } catch { return null; }
  }
  async set(key: string, value: string): Promise<void> {
    try { this.ls.setItem(key, value); } catch { /* quota / private mode */ }
  }
  async del(key: string): Promise<void> {
    try { this.ls.removeItem(key); } catch { /* ignore */ }
  }
  async keys(): Promise<string[]> {
    const out: string[] = [];
    try {
      for (let i = 0; i < this.ls.length; i++) {
        const k = this.ls.key(i);
        if (k !== null) out.push(k);
      }
    } catch { /* ignore */ }
    return out;
  }
}

export class IndexedDBKV implements KVStore {
  private dbp: Promise<unknown> | null = null;
  constructor(private dbname = "suvivalacraft", private storeName = "kv") {}

  private idbFactory(): { open(name: string, version: number): IDBReqLike } | null {
    const g = globalThis as unknown as { indexedDB?: { open(name: string, version: number): IDBReqLike } };
    return g.indexedDB ?? null;
  }

  private db(): Promise<unknown> {
    if (!this.dbp) {
      this.dbp = new Promise((resolve, reject) => {
        const factory = this.idbFactory();
        if (!factory) { reject(new Error("indexedDB unavailable")); return; }
        const req = factory.open(this.dbname, 1);
        req.onupgradeneeded = () => {
          const db = req.result as { createObjectStore?(name: string): unknown };
          db.createObjectStore?.(this.storeName);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbp;
  }

  private async tx<T>(mode: string, fn: (store: IDBStoreLike) => IDBReqLike): Promise<T> {
    const db = (await this.db()) as IDBDbLike;
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const rq = fn(tx.objectStore(this.storeName));
      rq.onsuccess = () => resolve(rq.result as T);
      rq.onerror = () => reject(rq.error);
    });
  }

  async get(key: string): Promise<string | null> {
    const v = await this.tx<string | undefined>("readonly", (s) => s.get(key));
    return v ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    await this.tx("readwrite", (s) => s.put(value, key));
  }
  async del(key: string): Promise<void> {
    await this.tx("readwrite", (s) => s.delete(key));
  }
  async keys(): Promise<string[]> {
    return this.tx<unknown[]>("readonly", (s) => s.getAllKeys()).then((ks) => ks.map(String));
  }
}

/** Minimal structural types for IndexedDB (avoids DOM lib dependency). */
interface IDBReqLike {
  result: unknown;
  error: unknown;
  onupgradeneeded: ((ev: unknown) => void) | null;
  onsuccess: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}
interface IDBStoreLike {
  get(key: string): IDBReqLike;
  put(value: string, key: string): IDBReqLike;
  delete(key: string): IDBReqLike;
  getAllKeys(): IDBReqLike;
}
interface IDBDbLike {
  createObjectStore?(name: string): unknown;
  transaction(name: string, mode: string): { objectStore(name: string): IDBStoreLike };
}

/** Pick the best available storage backend. */
export async function pickStore(): Promise<KVStore> {
  const g = globalThis as unknown as { indexedDB?: unknown; localStorage?: unknown };
  if (g.indexedDB) {
    try {
      const kv = new IndexedDBKV();
      await kv.get("__probe__");
      return kv;
    } catch { /* fall through */ }
  }
  try {
    const kv = new LocalStorageKV();
    await kv.get("__probe__");
    return kv;
  } catch { /* fall through */ }
  return new MemoryKV();
}

// ------------------------------------------------------------
// Migration (legacy single-slot v1 -> multi-world v2)
// ------------------------------------------------------------
/** Pure: convert a legacy v1 payload string into a v2 save. Returns null if invalid. */
export function migrateV1(raw: string, now = Date.now()): WorldSaveV2 | null {
  try {
    const d = JSON.parse(raw) as { v?: number; p?: PlayerState; seed?: number; time?: number };
    if (d.v !== 1 || !d.p || typeof d.p !== "object") return null;
    const meta: WorldMeta = {
      id: LEGACY_ID,
      name: "โลกเดิม",
      seed: typeof d.seed === "number" ? d.seed : 0,
      createdAt: now,
      updatedAt: now,
    };
    return {
      v: 2,
      meta,
      time: typeof d.time === "number" ? d.time : 6,
      dayCount: 1,
      gameSeconds: 0,
      player: d.p,
      edits: [],
      crops: {},
      savedAt: now,
    };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// SaveManager
// ------------------------------------------------------------
export class SaveManager {
  constructor(private kv: KVStore, private legacyRaw: (() => string | null) | null = null) {}

  async listWorlds(): Promise<WorldMeta[]> {
    const raw = await this.kv.get(INDEX_KEY);
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw) as WorldMeta[];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(metas: WorldMeta[]): Promise<void> {
    await this.kv.set(INDEX_KEY, JSON.stringify(metas));
  }

  async createWorld(name: string, seed: number): Promise<WorldMeta> {
    const meta: WorldMeta = {
      id: `w-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`,
      name,
      seed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const metas = await this.listWorlds();
    metas.push(meta);
    await this.writeIndex(metas);
    return meta;
  }

  async loadWorld(id: string): Promise<WorldSaveV2 | null> {
    const raw = await this.kv.get(worldKey(id));
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as WorldSaveV2;
      if (s.v !== SAVE_VERSION || !s.meta || !s.player) return null;
      return s;
    } catch {
      return null;
    }
  }

  async saveWorld(save: WorldSaveV2): Promise<void> {
    save.meta.updatedAt = Date.now();
    await this.kv.set(worldKey(save.meta.id), JSON.stringify(save));
    const metas = await this.listWorlds();
    const i = metas.findIndex((m) => m.id === save.meta.id);
    if (i >= 0) metas[i] = save.meta;
    else metas.push(save.meta);
    await this.writeIndex(metas);
  }

  async deleteWorld(id: string): Promise<void> {
    await this.kv.del(worldKey(id));
    await this.writeIndex((await this.listWorlds()).filter((m) => m.id !== id));
  }

  /** Migrate the legacy v1 slot once. Returns the created meta or null. */
  async migrateLegacy(): Promise<WorldMeta | null> {
    if (!this.legacyRaw) return null;
    const raw = this.legacyRaw();
    if (!raw) return null;
    const metas = await this.listWorlds();
    if (metas.some((m) => m.id === LEGACY_ID)) return null; // already migrated
    const save = migrateV1(raw);
    if (!save) return null;
    await this.saveWorld(save);
    return save.meta;
  }
}
