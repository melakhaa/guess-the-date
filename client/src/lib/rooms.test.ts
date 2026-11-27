import { afterEach, describe, expect, it, vi } from "vitest";
import { enterRoom, inviteUrl } from "./rooms";

const code = "aBcDeFgH12are_-2";

afterEach(() => vi.unstubAllGlobals());

describe("room entry", () => {
  it("builds a same-origin invitation with only the case-sensitive code", () => {
    expect(inviteUrl("https://example.test", code)).toBe(`https://example.test/?code=${code}`);
  });

  it("does not submit an invalid invite code", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(enterRoom("Ada", "not-a-code")).rejects.toThrow("Enter the 16-character room code");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, "/api/rooms"],
    [code, `/api/rooms/${code}/join`],
  ])("accepts a created or joined player session (code: %s)", async (invite, path) => {
    const session = { code, playerId: "player-id", playerToken: "x".repeat(43) };
    const fetch = vi.fn().mockResolvedValue(Response.json(session, { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    await expect(enterRoom("Ada", invite)).resolves.toEqual(session);
    expect(fetch).toHaveBeenCalledWith(path, expect.objectContaining({
      method: "POST", body: '{"nickname":"Ada"}',
    }));
  });

  it("does not enter a different room from the one invited", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      code: "z".repeat(16), playerId: "player-id", playerToken: "x".repeat(43),
    }, { status: 201 })));
    await expect(enterRoom("Ada", code)).rejects.toThrow("Could not confirm the room request");
  });

  it.each([
    [409, "ROOM_FULL", "This room already has two players."],
    [410, "ROOM_EXPIRED", "This room has expired."],
  ])("surfaces the room error from HTTP %s", async (status, errorCode, message) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: false, error: { code: errorCode, message } }, { status }));
    vi.stubGlobal("fetch", fetch);
    await expect(enterRoom("Ada", code)).rejects.toThrow(message);
    expect(fetch).toHaveBeenCalledWith(`/api/rooms/${code}/join`, expect.objectContaining({
      method: "POST", body: '{"nickname":"Ada"}',
    }));
  });

  it("does not retry a create request after a network failure", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Network unavailable"));
    vi.stubGlobal("fetch", fetch);
    await expect(enterRoom("Ada")).rejects.toThrow("Could not confirm the room request");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
