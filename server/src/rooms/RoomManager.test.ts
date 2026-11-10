import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomManager } from "./RoomManager.js";

afterEach(() => vi.useRealTimers());

describe("room storage", () => {
  it("rejects authentication at the lobby expiry boundary", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const rooms = new RoomManager();
    const host = rooms.create("Host");
    expect(rooms.authenticate(host.code, host.playerToken).player.playerId).toBe(host.playerId);
    vi.setSystemTime(30 * 60_000);
    expect(() => rooms.authenticate(host.code, host.playerToken)).toThrow("expired");
  });

  it("normalizes nicknames and stores only token hashes", () => {
    const rooms = new RoomManager();
    const host = rooms.create("  Ａda   Lovelace  ");
    const guest = rooms.join(host.code, "李雷");
    const room = rooms.get(host.code);
    expect(room.players.map((player) => player.nickname)).toEqual(["Ada Lovelace", "李雷"]);
    for (const player of room.players) expect(player.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(room)).not.toContain(host.playerToken);
    expect(JSON.stringify(room)).not.toContain(guest.playerToken);
  });

  it("does not consume the guest slot on invalid input", () => {
    const rooms = new RoomManager();
    const host = rooms.create("a".repeat(24));
    expect(() => rooms.join(host.code, " ")).toThrow();
    expect(rooms.metadata(host.code).playerCount).toBe(1);
    rooms.join(host.code, "Guest");
    expect(rooms.metadata(host.code).playerCount).toBe(2);
  });

  it("refreshes lobby expiry on a successful join, not on metadata reads", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const rooms = new RoomManager();
    const host = rooms.create("Host");
    vi.setSystemTime(20 * 60_000);
    rooms.join(host.code, "Guest");
    vi.setSystemTime(30 * 60_000);
    expect(rooms.metadata(host.code).playerCount).toBe(2);
    vi.setSystemTime(50 * 60_000);
    expect(() => rooms.metadata(host.code)).toThrow("expired");
  });

  it("creates one private rematch lobby per player and does not recreate an expired retry", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const rooms = new RoomManager();
    const host = rooms.create("Host");
    const guest = rooms.join(host.code, "Guest");
    const room = rooms.get(host.code);
    expect(() => rooms.rematch(host.code, host.playerId)).toThrow("Finish the match");
    room.phase = "matchResults";
    expect(() => rooms.rematch(host.code, "forged")).toThrow("Player is not in this room");
    const next = rooms.rematch(host.code, host.playerId);
    expect(rooms.rematch(host.code, host.playerId)).toEqual(next);
    const guestNext = rooms.rematch(host.code, guest.playerId);
    expect(guestNext.code).not.toBe(next.code);
    expect(rooms.metadata(next.code)).toMatchObject({ phase: "waiting", playerCount: 1 });
    expect(rooms.authenticate(next.code, next.playerToken).player.nickname).toBe("Host");
    expect(() => rooms.authenticate(next.code, host.playerToken)).toThrow("Invalid player credential");
    expect(JSON.stringify(rooms.snapshot(room))).not.toContain(next.playerToken);
    vi.setSystemTime(25 * 60_000);
    rooms.touch(room);
    vi.setSystemTime(30 * 60_000);
    expect(() => rooms.rematch(host.code, host.playerId)).toThrow("expired");
    expect(() => rooms.rematch(host.code, host.playerId)).toThrow("not found");
  });

  it("bounds room storage and reclaims expired lobbies before creating another", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const rooms = new RoomManager();
    for (let i = 0; i < 1000; i++) rooms.create("Host");
    expect(() => rooms.create("Host")).toThrow("capacity");
    vi.setSystemTime(30 * 60_000);
    expect(rooms.create("Host")).toMatchObject({ code: expect.any(String) });
  });
});
