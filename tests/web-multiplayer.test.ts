import { describe, it, expect, vi } from "vitest";
import {
  makeRoomCode, makePlayerId, validateMoveIntent, normalizedDir,
  HostSession, GuestSession, LoopbackTransport,
  MP_SPEED, MAX_PLAYERS, MAX_ACTIONS_PER_SEC, LOG_CAP, ROOM_CODE_LEN,
} from "../web/src/multiplayer.js";

const me = { id: "host-1", name: "โฮสต์", color: "#ff0000", x: 10, z: 10, hp: 20, level: 1 };

describe("codes & validation", () => {
  it("room code: 4 chars from unambiguous alphabet", () => {
    const code = makeRoomCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(code.length).toBe(ROOM_CODE_LEN);
    // deterministic with rng
    expect(makeRoomCode(() => 0)).toBe("AAAA");
  });

  it("player ids are unique-ish and prefixed", () => {
    const a = makePlayerId(), b = makePlayerId(() => 0.5);
    expect(a).toMatch(/^p-/);
    expect(b).toMatch(/^p-/);
    expect(a).not.toBe(b);
  });

  it("validateMoveIntent rejects NaN/overshoot, accepts unit-ish vectors", () => {
    expect(validateMoveIntent({ dx: NaN, dz: 0 })).toBe(false);
    expect(validateMoveIntent({ dx: Infinity, dz: 0 })).toBe(false);
    expect(validateMoveIntent({ dx: 2, dz: 0 })).toBe(false);
    expect(validateMoveIntent({ dx: 1, dz: 0 })).toBe(true);
    expect(validateMoveIntent({ dx: 0.6, dz: -0.6 })).toBe(true);
    expect(validateMoveIntent({ dx: 0, dz: 0 })).toBe(true);
  });

  it("normalizedDir keeps direction, handles zero", () => {
    expect(normalizedDir(3, 4)).toEqual({ dx: 0.6, dz: 0.8 });
    expect(normalizedDir(0, 0)).toEqual({ dx: 0, dz: 0 });
  });
});

describe("HostSession + GuestSession over loopback", () => {
  it("join -> welcome -> host sees guest", async () => {
    const [hostT, guestT] = LoopbackTransport.pair();
    const host = new HostSession("ABCD", "h1", me, hostT);
    const guest = new GuestSession("ABCD", "g1", "แขก", "#00ff00", guestT);
    guest.join();
    await vi.waitFor(() => {
      expect(guest.joined).toBe(true);
      expect(host.players.has("g1")).toBe(true);
    });
    expect(host.playerList().some((p) => p.id === "g1")).toBe(true);
  });

  it("move intents move the guest on host side at game speed; stop halts", async () => {
    const [hostT, guestT] = LoopbackTransport.pair();
    const host = new HostSession("ROOM", "h1", me, hostT);
    const guest = new GuestSession("ROOM", "g1", "g", "#0f0", guestT);
    guest.join();
    await vi.waitFor(() => expect(guest.joined).toBe(true));
    guest.sendAction({ t: "move", dx: 1, dz: 0 });
    await vi.waitFor(() => expect(host.players.get("g1")!.dirX).toBe(1));
    const x0 = host.players.get("g1")!.x;
    host.tick(1, 999); // no broadcast
    expect(host.players.get("g1")!.x).toBeCloseTo(x0 + MP_SPEED);
    guest.sendAction({ t: "stop" });
    await vi.waitFor(() => expect(host.players.get("g1")!.dirX).toBe(0));
    const x1 = host.players.get("g1")!.x;
    host.tick(1, 999);
    expect(host.players.get("g1")!.x).toBe(x1);
  });

  it("invalid intents are dropped by validation", async () => {
    const [hostT, guestT] = LoopbackTransport.pair();
    const host = new HostSession("R2M", "h1", me, hostT);
    const guest = new GuestSession("R2M", "g1", "g", "#0f0", guestT);
    guest.join();
    await vi.waitFor(() => expect(guest.joined).toBe(true));
    guest.sendAction({ t: "move", dx: 50, dz: NaN });
    await vi.waitFor(() => expect(host.log.length).toBe(0)); // invalid = ถูกทิ้งก่อน log
    const p = host.players.get("g1")!;
    expect(p.dirX).toBe(0);
    expect(p.dirZ).toBe(0);
    expect(validateMoveIntent({ dx: 50, dz: NaN })).toBe(false);
  });

  it("rate limiting drops excess actions within a second", async () => {
    const [hostT, guestT] = LoopbackTransport.pair();
    const host = new HostSession("RATE", "h1", me, hostT);
    const guest = new GuestSession("RATE", "g1", "g", "#0f0", guestT);
    guest.join();
    await vi.waitFor(() => expect(guest.joined).toBe(true));
    for (let i = 0; i < MAX_ACTIONS_PER_SEC + 5; i++) {
      guest.sendAction({ t: "attack" });
    }
    await vi.waitFor(() => expect(host.log.length).toBe(MAX_ACTIONS_PER_SEC));
  });

  it("action log is capped and seq increases monotonically", async () => {
    const [hostT, guestT] = LoopbackTransport.pair();
    const host = new HostSession("LOGS", "h1", me, hostT);
    const guest = new GuestSession("LOGS", "g1", "g", "#0f0", guestT);
    guest.join();
    await vi.waitFor(() => expect(guest.joined).toBe(true));
    const total = LOG_CAP + 30;
    for (let i = 0; i < total; i++) host.pushLogForTest("g1", { t: "attack" });
    expect(host.log.length).toBe(LOG_CAP);
    const seqs = host.log.map((l) => l.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    expect(seqs[0]!).toBeGreaterThan(1);
  });

  it("snapshots propagate to guest and reconcile view; leavers disappear", async () => {
    const [hostT, guestT] = LoopbackTransport.pair();
    const host = new HostSession("SNAP", "host-1", me, hostT);
    const guest = new GuestSession("SNAP", "g1", "g", "#0f0", guestT);
    guest.join();
    await vi.waitFor(() => expect(guest.joined).toBe(true));
    host.players.get("g1")!.x = 55;
    host.players.get("g1")!.z = 66;
    host.tick(0, 0); // force broadcast (snapTimer >= 0)
    await vi.waitFor(() => {
      const mine = guest.myAuthoritative();
      expect(mine?.x).toBe(55);
      expect(mine?.z).toBe(66);
    });
    expect(guest.others().map((p) => p.id)).toEqual(["host-1"]);
    // leave
    guest.close();
    await vi.waitFor(() => expect(host.players.has("g1")).toBe(false));
  });

  it("room capacity: host accepts at most MAX_PLAYERS (รวมโฮสต์)", async () => {
    const [hostT, guestT] = LoopbackTransport.pair();
    const host = new HostSession("FULL", "h1", me, hostT);
    const guest = new GuestSession("FULL", "g0", "g0", "#0f0", guestT);
    guest.join();
    await vi.waitFor(() => expect(host.players.has("g0")).toBe(true));
    // Loopback เป็น 1-to-1 — ส่ง raw join ของผู้เล่นเพิ่มผ่านแชแนลเดียวกัน
    // (BroadcastChannel จริงเป็น many-to-one ทุกแท็บเห็นกันเอง)
    const extra = MAX_PLAYERS + 2;
    for (let i = 1; i < extra; i++) {
      guestT.send({ m: "join", room: "FULL", id: `g${i}`, name: `g${i}`, color: "#0f0" });
    }
    await vi.waitFor(() => expect(host.players.size).toBe(MAX_PLAYERS));
    // เกินความจุ -> ไม่รับ
    guestT.send({ m: "join", room: "FULL", id: "overflow", name: "x", color: "#000" });
    await new Promise((r) => setTimeout(r, 30));
    expect(host.players.size).toBe(MAX_PLAYERS);
    expect(host.players.has("overflow")).toBe(false);
  });

  it("messages from a different room are ignored", async () => {
    const [hostT, guestT] = LoopbackTransport.pair();
    const host = new HostSession("AAA", "h1", me, hostT);
    const guest = new GuestSession("BBB", "g1", "g", "#0f0", guestT);
    guest.join(); // คนละห้อง
    await new Promise((r) => setTimeout(r, 30));
    expect(host.players.has("g1")).toBe(false);
    expect(guest.joined).toBe(false);
  });
});

describe("world-effect sync (CP-015)", () => {
  it("host broadcasts world state with snapshot; guest reads enemies/event/merchant", async () => {
    const [hostT, guestT] = LoopbackTransport.pair();
    const host = new HostSession("WLD", "h1", me, hostT);
    const guest = new GuestSession("WLD", "g1", "g", "#0f0", guestT);
    guest.join();
    await vi.waitFor(() => expect(guest.joined).toBe(true));
    host.setWorld({
      enemies: [{ x: 5, z: 6, kind: "slime_king", hp: 80, maxHp: 90 }],
      pickups: [{ x: 1, z: 2, item: "gold" }],
      event: { kind: "storm", endsIn: 12 },
      merchant: { x: 40, z: 41 },
    });
    host.tick(0, 0); // force broadcast
    await vi.waitFor(() => {
      expect(guest.world.enemies.length).toBe(1);
      expect(guest.world.enemies[0]!.kind).toBe("slime_king");
      expect(guest.world.pickups[0]!.item).toBe("gold");
      expect(guest.world.event?.kind).toBe("storm");
      expect(guest.world.merchant?.x).toBe(40);
    });
    // clear -> guest sees empty after next snapshot
    host.setWorld({ enemies: [], pickups: [] });
    host.tick(0, 0);
    await vi.waitFor(() => expect(guest.world.enemies.length).toBe(0));
  });

  it("guest without world field (legacy snapshot) keeps defaults", async () => {
    const [hostT, guestT] = LoopbackTransport.pair();
    const host = new HostSession("LEG", "h1", me, hostT);
    const guest = new GuestSession("LEG", "g1", "g", "#0f0", guestT);
    guest.join();
    await vi.waitFor(() => expect(guest.joined).toBe(true));
    expect(guest.world.enemies).toEqual([]);
    expect(guest.world.event).toBeUndefined();
  });
});
