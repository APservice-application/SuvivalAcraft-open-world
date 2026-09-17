import { describe, it, expect, afterEach, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket as WsClient } from "ws";
import { WebSocketTransport } from "../web/src/ws-transport.js";
import { HostSession, GuestSession, makeRoomCode } from "../web/src/multiplayer.js";

let server: Server | null = null;
let wss: WebSocketServer | null = null;
const toClose: { close(): void }[] = [];

async function startRelay(): Promise<string> {
  server = createServer(() => {});
  wss = new WebSocketServer({ server });
  const conns = new Set<{ room: string | null; readyState: number; send(d: string): void }>();
  wss.on("connection", (ws: unknown) => {
    const sock = ws as { room: string | null; readyState: number; send(d: string): void; on(ev: string, cb: (d?: unknown) => void): void };
    sock.room = null;
    conns.add(sock as never);
    sock.on("message", (data) => {
      let msg: { room?: string };
      try { msg = JSON.parse(String(data)); } catch { return; }
      if (!msg || typeof msg.room !== "string" || msg.room.length < 3) return;
      if (sock.room === null) sock.room = msg.room;
      if (msg.room !== sock.room) return;
      for (const c of conns) {
        if (c !== sock && c.room === sock.room && c.readyState === 1) c.send(String(data));
      }
    });
    sock.on("close", () => conns.delete(sock as never));
    sock.on("error", () => conns.delete(sock as never));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const addr = server!.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return `ws://127.0.0.1:${port}`;
}

afterEach(async () => {
  for (const t of toClose) {
    try { t.close(); } catch { /* ignore */ }
  }
  toClose.length = 0;
  if (wss) for (const c of wss.clients) c.terminate();
  await new Promise<void>((resolve) => {
    if (server) server.close(() => resolve());
    else resolve();
  });
  server = null;
  wss = null;
});

const me = { id: "h1", name: "โฮสต์", color: "#ff0000", x: 10, z: 10, hp: 20, level: 1 };

describe("WebSocketTransport over real relay (CP-016)", () => {
  it("join -> welcome -> action -> world snapshot flows end-to-end", async () => {
    const url = await startRelay();
    const room = makeRoomCode();

    const hostT = new WebSocketTransport(url, WsClient as never, room);
    const guestT = new WebSocketTransport(url, WsClient as never, room);
    toClose.push(hostT, guestT);
    const host = new HostSession(room, "h1", me, hostT);
    const guest = new GuestSession(room, "g1", "แขก", "#00ff00", guestT);

    guest.join();
    await vi.waitFor(() => expect(guest.joined).toBe(true), { timeout: 3000 });
    expect(host.players.has("g1")).toBe(true);

    // action: guest moves right
    guest.sendAction({ t: "move", dx: 1, dz: 0 });
    await vi.waitFor(() => expect(host.players.get("g1")!.dirX).toBe(1), { timeout: 3000 });

    // host integrates and broadcasts world snapshot
    host.setWorld({ enemies: [{ x: 3, z: 4, kind: "goblin", hp: 9, maxHp: 9 }], pickups: [] });
    host.tick(0.5, 0);
    await vi.waitFor(() => {
      expect(guest.world.enemies.length).toBe(1);
      expect(guest.world.enemies[0]!.kind).toBe("goblin");
      const mine = guest.myAuthoritative();
      expect(mine && mine.x > 10).toBe(true); // host moved the guest ~90*0.5
    }, { timeout: 3000 });

    hostT.close();
    guestT.close();
  });

  it("messages from other rooms do not leak through the relay", async () => {
    const url = await startRelay();
    const roomA = makeRoomCode();
    const roomB = makeRoomCode();
    const hostBT = new WebSocketTransport(url, WsClient as never, roomB);
    const guestAT = new WebSocketTransport(url, WsClient as never, roomA);
    toClose.push(hostBT, guestAT);
    const hostB = new HostSession(roomB, "hB", me, hostBT);
    const guestA = new GuestSession(roomA, "gA", "a", "#0f0", guestAT);
    guestA.join();
    // ให้เวลาเฟรม join เดินทาง (ห้อง A ไม่มีใคร — ต้องไม่มี welcome)
    await new Promise((r) => setTimeout(r, 150));
    // gA join roomA — hostB (roomB) ต้องไม่เห็น และ guestA ต้องไม่ถูก welcome
    expect(hostB.players.has("gA")).toBe(false);
    expect(guestA.joined).toBe(false);
    hostB.close();
  });
});
