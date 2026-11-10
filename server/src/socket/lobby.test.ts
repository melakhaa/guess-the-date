import { afterEach, describe, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import type { MatchCountdownEvent, MatchResultEvent, RoundResultEvent, RoundStartEvent, PlayerSession, RoomAttachAck, RoomStateEvent } from "@guess-the-date/shared";
import { buildApp } from "../app.js";
import { events } from "../content/events.js";

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
  it("plays exactly five distinct rounds and broadcasts one recoverable final result", async () => {
    const { app, url, host, guest } = await setup();
    const other = (await app.inject({ method: "POST", url: "/api/rooms", payload: { nickname: "Other" } })).json<PlayerSession>();
    const observer = await connect(url);
    await attach(observer, other);
    const unrelated: unknown[] = [];
    for (const name of ["round:start", "round:result", "match:result", "opponent:status", "guess:result"]) observer.on(name, (event) => unrelated.push(event));
    const first = await connect(url);
    const second = await connect(url);
    await attach(first, host);
    await attach(second, guest);
    expect(await first.timeout(1000).emitWithAck("player:rematch", { requestId: "early" })).toMatchObject({ ok: false, error: { code: "ROOM_STATE_CONFLICT" } });
    const starts: RoundStartEvent[][] = [[], []];
    const results: RoundResultEvent[][] = [[], []];
    const finals: MatchResultEvent[][] = [[], []];
    [first, second].forEach((client, index) => {
      client.on("round:start", (event) => starts[index].push(event));
      client.on("round:result", (event) => results[index].push(event));
      client.on("match:result", (event) => finals[index].push(event));
    });
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    await first.emitWithAck("player:ready", { ready: true, requestId: "ready" });
    await second.emitWithAck("player:ready", { ready: true, requestId: "ready" });
    const firstStart = new Promise<void>((resolve) => first.once("round:start", () => resolve()));
    await vi.advanceTimersByTimeAsync(3000);
    await firstStart;
    for (let round = 1; round <= 5; round++) {
      const synced = await first.emitWithAck("room:sync", { requestId: `start-${round}` });
      expect(synced.state).toMatchObject({ phase: "playing", round });
      expect(synced.matchResult).toBeNull();
      expect(synced.ownRound.guesses).toEqual([]);
      expect(synced.state.players.map((player: { totalPoints: number }) => player.totalPoints)).toEqual([(round - 1) * 5000, (round - 1) * 5000]);
      const event = events.find((candidate) => candidate.clues[0] === synced.ownRound.clues[0])!;
      if (round > 1) {
        expect(await first.emitWithAck("guess:submit", { round: round - 1, date: event.date, requestId: "solve" })).toMatchObject({ ok: false, error: { code: "ROUND_MISMATCH" } });
      }
      for (const client of [first, second]) {
        expect(await client.emitWithAck("guess:submit", { round, date: event.date, requestId: "solve" })).toMatchObject({ ok: true, guessesUsed: 1 });
      }
      const ended = await first.emitWithAck("room:sync", { requestId: `end-${round}` });
      await second.emitWithAck("room:sync", { requestId: `end-${round}` });
      expect(results[0]).toHaveLength(round);
      expect(results[1]).toEqual(results[0]);
      expect(starts[0]).toHaveLength(round);
      expect(starts[1]).toEqual(starts[0]);
      expect(ended.roundResult.players.map((player: { totalPoints: number }) => player.totalPoints)).toEqual([round * 5000, round * 5000]);
      if (round < 5) {
        expect(finals).toEqual([[], []]);
        expect(ended.roundResult.nextRoundStartsAt).toBe(Date.now() + 8000);
        await vi.advanceTimersByTimeAsync(7999);
        expect((await first.emitWithAck("room:sync", { requestId: "before-next" })).state.phase).toBe("roundResults");
        const nextStart = new Promise<void>((resolve) => first.once("round:start", () => resolve()));
        await vi.advanceTimersByTimeAsync(1);
        await nextStart;
      } else {
        expect(ended.state.phase).toBe("matchResults");
        expect(ended.roundResult.nextRoundStartsAt).toBeNull();
        expect(ended.matchResult).toEqual(finals[0][0]);
      }
    }
    expect(new Set(results[0].map((result) => result.event.id)).size).toBe(5);
    expect(finals[0]).toHaveLength(1);
    expect(finals[1]).toEqual(finals[0]);
    expect(finals[0][0]).toMatchObject({ winnerPlayerId: null, players: [{ totalPoints: 25000, exactSolves: 5, totalErrorDays: 0 }, { totalPoints: 25000, exactSolves: 5, totalErrorDays: 0 }] });
    for (const result of results[0]) {
      for (const secret of [result.event.id, result.event.date, result.event.title]) expect(finals[0][0].shareText).not.toContain(secret);
    }
    await vi.advanceTimersByTimeAsync(8000);
    expect(await first.emitWithAck("guess:submit", { round: 5, date: results[0][4].event.date, requestId: "solve" })).toMatchObject({ ok: true, guessesUsed: 1 });
    const recovered = await first.emitWithAck("room:sync", { requestId: "final-sync" });
    expect(recovered.matchResult).toEqual(finals[0][0]);
    expect(starts[0]).toHaveLength(5);
    expect(finals[0]).toHaveLength(1);
    expect(await first.emitWithAck("player:rematch", { requestId: "bad", nickname: "Override" })).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
    const missingAck = new Promise((resolve) => first.once("room:error", resolve));
    first.emit("player:rematch", { requestId: "no-ack" });
    expect(await missingAck).toMatchObject({ code: "INVALID_REQUEST" });
    const rematch = await first.emitWithAck("player:rematch", { requestId: "rematch" });
    expect(rematch).toMatchObject({ ok: true, requestId: "rematch", code: expect.any(String), playerId: expect.any(String), playerToken: expect.any(String) });
    expect(rematch.code).not.toBe(host.code);
    expect(rematch.playerToken).not.toBe(host.playerToken);
    expect(await first.emitWithAck("player:rematch", { requestId: "rematch" })).toEqual(rematch);
    const returning = await connect(url);
    await attach(returning, host);
    expect(await returning.emitWithAck("player:rematch", { requestId: "retry-new-id" })).toEqual({ ...rematch, requestId: "retry-new-id" });
    const publicState = await second.emitWithAck("room:sync", { requestId: "after-rematch" });
    expect(publicState.state.phase).toBe("matchResults");
    expect(JSON.stringify(publicState)).not.toContain(rematch.playerToken);
    await observer.emitWithAck("room:sync", { requestId: "barrier" });
    expect(unrelated).toEqual([]);
    const next = await connect(url);
    expect(await attach(next, rematch)).toMatchObject({ ok: true, state: { phase: "waiting", round: null, players: [{ nickname: "Host", ready: false, totalPoints: 0 }] } });
  });

  it("starts a shared round and privately accepts guesses before revealing one result", async () => {
    const { url, host, guest } = await setup();
    const first = await connect(url);
    const second = await connect(url);
    await attach(first, host);
    await attach(second, guest);
    const starts: unknown[][] = [[], []];
    const results: unknown[][] = [[], []];
    const privateEvents: unknown[] = [];
    const statuses: unknown[] = [];
    second.on("opponent:status", (status) => statuses.push(status));
    [first, second].forEach((client, index) => {
      client.on("round:start", (event) => starts[index].push(event));
      client.on("round:result", (event) => results[index].push(event));
      client.on("guess:result", (event) => privateEvents.push(event));
    });
    await first.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready" });
    await second.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready" });
    await vi.waitFor(() => expect(starts[0]).toHaveLength(1), { timeout: 4500 });
    const synced = await second.timeout(1000).emitWithAck("room:sync", { requestId: "sync" });
    expect(starts[1]).toEqual(starts[0]);
    const start = starts[0][0] as { clue: string; roundStartedAt: number; roundEndsAt: number };
    expect(start.roundEndsAt - start.roundStartedAt).toBe(60000);
    expect(synced.state).toMatchObject({ phase: "playing", round: 1, countdownStartsAt: null });
    expect(synced.ownRound).toMatchObject({ clues: [start.clue], guesses: [], roundStartedAt: start.roundStartedAt, roundEndsAt: start.roundEndsAt });
    const event = events.find((candidate) => candidate.clues[0] === start.clue)!;
    for (const secret of [event.date, event.id, event.clues[1], "errorDays", "sources"]) {
      expect(JSON.stringify([starts, synced])).not.toContain(secret);
    }
    statuses.length = 0;
    const wrong = { round: 1, date: event.date === "1600-01-01" ? "2099-12-31" : "1600-01-01", requestId: "wrong" };
    const feedback = await first.timeout(1000).emitWithAck("guess:submit", wrong);
    expect(feedback).toMatchObject({ ok: true, guessesUsed: 1, solved: false, finished: false, newClue: event.clues[1] });
    expect(await first.timeout(1000).emitWithAck("guess:submit", wrong)).toEqual(feedback);
    expect(await first.timeout(1000).emitWithAck("guess:submit", { ...wrong, requestId: "duplicate" })).toMatchObject({ ok: false, error: { code: "DUPLICATE_GUESS" } });
    expect(await first.timeout(1000).emitWithAck("guess:submit", { ...wrong, round: 2, requestId: "round-2" })).toMatchObject({ ok: false, error: { code: "ROUND_MISMATCH" } });
    for (const payload of [null, {}, { ...wrong, date: "2000-02-30", requestId: "invalid-date" }, { ...wrong, score: 5000 }, { ...wrong, requestId: "x".repeat(129) }]) {
      expect(await first.timeout(1000).emitWithAck("guess:submit", payload)).toMatchObject({ ok: false });
    }
    first.emit("guess:submit", { round: 1, date: event.date, requestId: "no-ack" });
    expect((await first.timeout(1000).emitWithAck("room:sync", { requestId: "no-ack-check" })).ownRound.guesses).toHaveLength(1);
    const beforeSolve = await second.timeout(1000).emitWithAck("room:sync", { requestId: "private" });
    expect(beforeSolve.ownRound).toMatchObject({ clues: [event.clues[0]], guesses: [] });
    expect(statuses).toEqual([]);
    const request = { round: 1, date: event.date, requestId: "solve" };
    const response = await first.timeout(1000).emitWithAck("guess:submit", request);
    expect(response).toEqual({ ok: true, requestId: "solve", temperature: "correct", direction: "exact", guessesUsed: 2, solved: true, finished: true });
    expect(await first.timeout(1000).emitWithAck("guess:submit", request)).toEqual(response);
    const opponent = await second.timeout(1000).emitWithAck("room:sync", { requestId: "sync-2" });
    expect(opponent.ownRound.guesses).toEqual([]);
    expect(results).toEqual([[], []]);
    await second.timeout(1000).emitWithAck("guess:submit", request);
    await Promise.all([first, second].map((client) => client.timeout(1000).emitWithAck("room:sync", { requestId: "sync-3" })));
    expect(results[0]).toHaveLength(1);
    expect(results[1]).toEqual(results[0]);
    expect(results[0][0]).toMatchObject({ round: 1, event: { date: event.date }, players: [{ points: 4900 }, { points: 5000 }] });
    expect(await first.timeout(1000).emitWithAck("guess:submit", request)).toEqual(response);
    expect(results[0]).toHaveLength(1);
    expect(privateEvents).toEqual([]); // Guess feedback uses only the requesting socket's acknowledgment.
  }, 10000);

  it("executes fixed deadlines, preserves a disconnected round, and recovers the result on sync", async () => {
    const { url, host, guest } = await setup();
    const first = await connect(url);
    const second = await connect(url);
    await attach(first, host);
    await attach(second, guest);

    const results: unknown[] = [];
    first.on("round:result", (event) => results.push(event));
    await first.emitWithAck("player:ready", { ready: true, requestId: "ready" });
    await second.emitWithAck("player:ready", { ready: true, requestId: "ready" });
    expect((await first.emitWithAck("room:sync", { requestId: "before" })).state.phase).toBe("countdown");
    await new Promise<void>((resolve) => first.once("round:start", () => resolve()));
    const active = await first.emitWithAck("room:sync", { requestId: "active" });
    expect(active.state.phase).toBe("playing");
    expect(active.roundResult).toBeNull();
    expect(await first.emitWithAck("player:ready", { ready: false, requestId: "unready" })).toMatchObject({ ok: false, error: { code: "ROOM_STATE_CONFLICT" } });
    const disconnected = new Promise<void>((resolve) => first.once("opponent:status", () => resolve()));
    second.disconnect();
    await disconnected;
    const during = await first.emitWithAck("room:sync", { requestId: "during" });
    expect(during.state.phase).toBe("playing");
    expect(during.ownRound).toEqual(active.ownRound);
    // Real time avoids advancing Socket.IO heartbeat clocks independently of network I/O.
    await new Promise<void>((resolve) => first.once("round:result", () => resolve()));
    const ended = await first.emitWithAck("room:sync", { requestId: "ended" });
    expect(ended.state.phase).toBe("roundResults");
    expect(ended.roundResult).toMatchObject({ players: [{ points: 0 }, { points: 0 }] });
    expect(results).toEqual([ended.roundResult]);
    expect(await first.emitWithAck("guess:submit", { round: 1, date: "2000-01-01", requestId: "late" })).toMatchObject({ ok: false, error: { code: "ROUND_EXPIRED" } });
    const replacement = await connect(url);
    await attach(replacement, guest);
    const recovered = await replacement.emitWithAck("room:sync", { requestId: "recover" });
    expect(recovered.roundResult).toEqual(ended.roundResult);
    expect(recovered.ownRound).toMatchObject({ finished: true, guesses: [], roundEndsAt: active.ownRound.roundEndsAt });
    expect(results).toHaveLength(1);
  }, 75000);

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
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const starts: unknown[] = [];
    first.on("round:start", (event) => starts.push(event));
    await first.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-1" });
    await second.timeout(1000).emitWithAck("player:ready", { ready: true, requestId: "ready-1" });
    await first.timeout(1000).emitWithAck("player:ready", { ready: false, requestId: "ready-2" });
    const synced = await second.timeout(1000).emitWithAck("room:sync", { requestId: "sync-1" });
    expect(synced.state).toMatchObject({ phase: "waiting", countdownStartsAt: null });
    expect(synced.state.players[0].ready).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    expect((await first.emitWithAck("room:sync", { requestId: "after-deadline" })).state.phase).toBe("waiting");
    expect(starts).toEqual([]);
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
    expect(await client.timeout(1000).emitWithAck("guess:submit", { round: 1, date: "2000-01-01", requestId: "guess-1" })).toMatchObject({
      ok: false, error: { code: "PLAYER_NOT_ATTACHED" },
    });
    expect(await client.timeout(1000).emitWithAck("player:rematch", { requestId: "rematch" })).toMatchObject({
      ok: false, error: { code: "PLAYER_NOT_ATTACHED" },
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
