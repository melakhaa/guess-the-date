import { afterEach, describe, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import type { MatchCountdownEvent, PlayerSession, RoomAttachAck, RoomStateEvent } from "@guess-the-date/shared";
import { buildApp } from "../app.js";

const apps: ReturnType<typeof buildApp>[] = [];
const clients: Socket[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.useRealTimers();
});

async function setup() {
  const app = buildApp();
  apps.push(app);
  const url = await app.listen({ port: 0, host: "127.0.0.1" });
  const host = (await app.inject({ method: "POST", url: "/api/rooms", payload: { nickname: "Host" } })).json<PlayerSession>();
  const guest = (await app.inject({ method: "POST", url: `/api/rooms/${host.code}/join`, payload: { nickname: "Guest" } })).json<PlayerSession>();
  return { app, url, host, guest };
}

async function connect(url: string) {
  const client = io(url, { transports: ["websocket"], reconnection: false, autoConnect: false, timeout: 1000 });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
    client.connect();
  });
  return client;
}

async function attach(client: Socket, session: PlayerSession): Promise<RoomAttachAck> {
  return client.timeout(1000).emitWithAck("room:attach", { code: session.code, playerToken: session.playerToken });
}

describe("socket lobby", () => {
  it("rejects malformed messages without changing readiness", async () => {
    const { url, host } = await setup();
    const client = await connect(url);
    expect(await client.timeout(1000).emitWithAck("room:attach", { code: host.code, playerToken: host.playerToken, role: "admin" })).toMatchObject({
      ok: false, error: { code: "INVALID_REQUEST" },
    });
    await attach(client, host);
    for (const payload of [null, {}, { requestId: "bad-1", ready: "true" }, { requestId: "bad-2", ready: true, score: 5000 }, { requestId: "x".repeat(129), ready: true }]) {
      const response = await client.timeout(1000).emitWithAck("player:ready", payload);
      expect(response).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
    }
    const missingId = await client.timeout(1000).emitWithAck("room:sync", {});
    expect(missingId).toEqual({ ok: false, error: { code: "INVALID_REQUEST", message: "Invalid request." } });
    const synced = await client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" });
    expect(synced.state.players[0].ready).toBe(false);
  });

  it("requires acknowledgment callbacks before mutating state", async () => {
    const { url, host } = await setup();
    const client = await connect(url);
    const errors: unknown[] = [];
    client.on("room:error", (error: unknown) => errors.push(error));
    client.emit("room:attach", { code: host.code, playerToken: host.playerToken });
    expect(await client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" })).toMatchObject({
      ok: false, error: { code: "PLAYER_NOT_ATTACHED" },
    });
    await attach(client, host);
    client.emit("player:ready", { ready: true, requestId: "ready-1" });
    const synced = await client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-2" });
    expect(synced.state.players[0].ready).toBe(false);
    expect(errors).toEqual([
      { code: "INVALID_REQUEST", message: "Acknowledgment required." },
      { code: "INVALID_REQUEST", message: "Acknowledgment required.", requestId: "ready-1" },
    ]);
  });

  it("does not broadcast room state to unattached sockets or another room", async () => {
    const { app, url, host, guest } = await setup();
    const other = (await app.inject({ method: "POST", url: "/api/rooms", payload: { nickname: "Other" } })).json<PlayerSession>();
    const observer = await connect(url);
    const otherClient = await connect(url);
    await attach(otherClient, other);
    // Drain the attach broadcast before recording unrelated traffic.
    await otherClient.timeout(1000).emitWithAck("room:sync", { requestId: "sync-0" });
    const received: unknown[] = [];
    for (const client of [observer, otherClient]) {
      client.on("room:state", (state: unknown) => received.push(state));
      client.on("match:countdown", (event: unknown) => received.push(event));
    }
    const first = await connect(url);
    const second = await connect(url);
    await attach(first, host);
    await attach(second, guest);
    await first.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-1" });
    await second.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-1" });
    await Promise.all([observer, otherClient].map((client) => client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" })));
    expect(received).toEqual([]);
  });

  it("prevents an attached socket from switching to another player", async () => {
    const { url, host, guest } = await setup();
    const client = await connect(url);
    await attach(client, host);
    expect(await attach(client, guest)).toMatchObject({ ok: false, error: { code: "ROOM_STATE_CONFLICT" } });
    const synced = await client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" });
    expect(synced.state.players.map((player: { connected: boolean }) => player.connected)).toEqual([true, false]);
  });

  it("cancels a countdown when a player becomes unready", async () => {
    const { url, host, guest } = await setup();
    const first = await connect(url);
    const second = await connect(url);
    await attach(first, host);
    await attach(second, guest);
    await first.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-1" });
    await second.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-1" });
    await first.timeout(1000).emitWithAck("player:ready", { ready: false, requestId: "ready-2" });
    const synced = await second.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" });
    expect(synced.state).toMatchObject({ phase: "waiting", countdownStartsAt: null });
    expect(synced.state.players[0].ready).toBe(false);
  });

  it("shuts down with connected clients without leaving open transports", async () => {
    const { app, url, host } = await setup();
    const client = await connect(url);
    await attach(client, host);
    await app.close();
    await vi.waitFor(() => expect(client.connected).toBe(false));
  });

  it("bounds the readiness retry window to the latest 64 accepted request IDs", async () => {
    const { url, host } = await setup();
    const client = await connect(url);
    await attach(client, host);
    await client.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-0" });
    for (let i = 1; i <= 64; i++) {
      await client.timeout(1000).emitWithAck("player:ready", { ready: false, requestId: `ready-${i}` });
    }
    await client.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-0" });
    const synced = await client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" });
    expect(synced.state.players[0].ready).toBe(true);
  });

  it("cancels a countdown on disconnect and requires the returning player to ready again", async () => {
    const { url, host, guest } = await setup();
    const first = await connect(url);
    const second = await connect(url);
    const states: RoomStateEvent[] = [];
    first.on("room:state", (state: RoomStateEvent) => states.push(state));
    await attach(first, host);
    await attach(second, guest);
    await first.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "host-1" });
    await second.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "guest-1" });
    second.disconnect();
    await vi.waitFor(() => {
      expect(states.at(-1)).toMatchObject({ phase: "waiting", countdownStartsAt: null });
      expect(states.at(-1)?.players[1]).toMatchObject({ connected: false, ready: false });
    });
    const returning = await connect(url);
    const attached = await attach(returning, guest);
    expect(attached).toMatchObject({ ok: true, state: { phase: "waiting", countdownStartsAt: null } });
    await returning.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "guest-2" });
    expect((await returning.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" })).state.phase).toBe("countdown");
  });

  it("replaces the previous controller without resetting readiness or countdown", async () => {
    const { url, host, guest } = await setup();
    const first = await connect(url);
    const second = await connect(url);
    await attach(first, host);
    await attach(second, guest);
    await first.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "host-1" });
    await second.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "guest-1" });
    const before = await second.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" });
    const replacement = await connect(url);
    const response = await attach(replacement, host);
    expect(response).toMatchObject({ ok: true, state: before.state });
    await vi.waitFor(() => expect(first.connected).toBe(false));
    const synced = await replacement.timeout(1000).emitWithAck("room:sync", { requestId: "sync-2" });
    expect(synced.state).toEqual(before.state);
  });

  it("schedules one shared countdown only after both players attach and become ready", async () => {
    const { url, host, guest } = await setup();
    const first = await connect(url);
    const second = await connect(url);
    const countdowns: MatchCountdownEvent[][] = [[], []];
    first.on("match:countdown", (event: MatchCountdownEvent) => countdowns[0].push(event));
    second.on("match:countdown", (event: MatchCountdownEvent) => countdowns[1].push(event));
    await attach(first, host);
    expect(await first.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-1" })).toEqual({
      ok: true, requestId: "ready-1", ready: true,
    });
    expect((await first.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" })).state.phase).toBe("waiting");
    await attach(second, guest);
    expect((await first.timeout(1000).emitWithAck("room:sync", { requestId: "sync-2" })).state.phase).toBe("waiting");
    await second.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-1" });
    // Sync acks are ordered after earlier broadcasts on each socket.
    const states = await Promise.all([first, second].map((client) => client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-3" })));
    expect(countdowns[0]).toHaveLength(1);
    expect(countdowns[1]).toEqual(countdowns[0]);
    const countdown = countdowns[0][0];
    expect(countdown.startsAt - countdown.serverNow).toBe(3000);
    for (const response of states) {
      expect(response.state).toMatchObject({ phase: "countdown", countdownStartsAt: countdown.startsAt });
    }
    await Promise.all([first, second].map((client) => client.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-2" })));
    await Promise.all([first, second].map((client) => client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-4" })));
    expect(countdowns.map((events) => events.length)).toEqual([1, 1]);
  });

  it("replays a readiness acknowledgment without reverting a newer choice", async () => {
    const { url, host } = await setup();
    const client = await connect(url);
    await attach(client, host);
    const original = await client.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-1" });
    await client.timeout(1000).emitWithAck("player:ready", { ready: false, requestId: "ready-2" });
    const replay = await client.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-1" });
    expect(replay).toEqual(original);
    const response = await client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" });
    expect(response.state.players[0].ready).toBe(false);
  });

  it("rejects forged credentials and actions before attachment", async () => {
    const { url, host } = await setup();
    const client = await connect(url);
    expect(await attach(client, { ...host, playerToken: "x".repeat(43) })).toMatchObject({
      ok: false, error: { code: "UNAUTHORIZED" },
    });
    expect(await client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" })).toMatchObject({
      ok: false, requestId: "sync-1", error: { code: "PLAYER_NOT_ATTACHED" },
    });
    expect(await client.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-1" })).toMatchObject({
      ok: false, requestId: "ready-1", error: { code: "PLAYER_NOT_ATTACHED" },
    });
  });

  it("syncs authenticated public state with server time and no active round", async () => {
    const { url, host, guest } = await setup();
    const client = await connect(url);
    await attach(client, host);
    const response = await client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" });
    expect(response).toMatchObject({ ok: true, requestId: "sync-1", ownRound: null, serverNow: expect.any(Number) });
    expect(response.state.players).toHaveLength(2);
    for (const secret of [host.playerToken, guest.playerToken, "tokenHash", "socketId", "expiresAt", "sources", "clues"]) {
      expect(JSON.stringify(response)).not.toContain(secret);
    }
  });

  it("authenticates a player and returns only public room state", async () => {
    const { url, host, guest } = await setup();
    const client = await connect(url);
    const response = await attach(client, host);
    expect(response).toEqual({
      ok: true,
      playerId: host.playerId,
      serverNow: expect.any(Number),
      state: {
        code: host.code, phase: "waiting", round: null, roundsTotal: 5, countdownStartsAt: null,
        players: [
          { playerId: host.playerId, nickname: "Host", connected: true, ready: false, finished: false, totalPoints: 0 },
          { playerId: guest.playerId, nickname: "Guest", connected: false, ready: false, finished: false, totalPoints: 0 },
        ],
      },
    });
    expect(JSON.stringify(response)).not.toContain(host.playerToken);
    expect(JSON.stringify(response)).not.toContain("tokenHash");
  });
});
