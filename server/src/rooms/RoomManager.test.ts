import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomManager } from "./RoomManager.js";

afterEach(() => vi.useRealTimers());

describe("room storage", () => {
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
