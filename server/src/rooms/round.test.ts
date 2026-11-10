import { describe, expect, it } from "vitest";
import type { HistoricalEvent } from "../content/events.js";
import { RoomManager } from "./RoomManager.js";
import { acceptGuess, ownRound, resolveRound, startRound } from "./round.js";

const event: HistoricalEvent = {
  id: "test-event", title: "Synthetic event", date: "2000-01-10",
  clues: ["One", "Two", "Three", "Four", "Five"],
  explanation: "Test content", sources: [{ label: "Example", url: "https://example.com" }],
  tags: ["Test"], difficulty: "easy",
};

function countdownRoom() {
  const rooms = new RoomManager();
  const host = rooms.create("Host");
  rooms.join(host.code, "Guest");
  const room = rooms.get(host.code);
  room.phase = "countdown";
  room.countdownStartsAt = 1000;
  return { rooms, room };
}

describe("authoritative round state", () => {
  it("keeps feedback private and replays accepted guesses without consuming another attempt", () => {
    const { room } = countdownRoom();
    startRound(room, event);
    const [host, guest] = room.players;
    const request = { round: 1, date: "2000-01-09", requestId: "guess-1" };
    const response = acceptGuess(room, host.playerId, request, 1001);
    expect(response).toEqual({
      ok: true, requestId: "guess-1", temperature: "burning", direction: "later",
      guessesUsed: 1, solved: false, finished: false, newClue: "Two",
    });
    expect(acceptGuess(room, host.playerId, request, 1002)).toEqual(response);
    expect(ownRound(room, host.playerId)).toEqual({
      round: 1, clues: ["One", "Two"],
      guesses: [{ date: "2000-01-09", temperature: "burning", direction: "later" }],
      finished: false, roundStartedAt: 1000, roundEndsAt: 61000,
    });
    expect(ownRound(room, guest.playerId)).toMatchObject({ clues: ["One"], guesses: [] });
  });
  it("resolves once at the deadline and rejects late guesses even before the timer runs", () => {
    const { rooms, room } = countdownRoom();
    startRound(room, event);
    const host = room.players[0];
    const request = { round: 1, date: event.date, requestId: "solve" };
    expect(acceptGuess(room, host.playerId, request, 60999)).toMatchObject({ ok: true, solved: true });
    expect(resolveRound(room, 60999)).toBeNull();
    expect(() => acceptGuess(room, room.players[1].playerId, request, 61000)).toThrow("Round deadline passed");
    expect(resolveRound(room, 61000)).toEqual({
      round: 1,
      event: { id: event.id, title: event.title, date: event.date, explanation: event.explanation, sources: event.sources },
      players: [
        { playerId: host.playerId, nickname: "Host", bestGuess: event.date, errorDays: 0, points: 5000, totalPoints: 5000, solved: true },
        { playerId: room.players[1].playerId, nickname: "Guest", bestGuess: null, errorDays: null, points: 0, totalPoints: 0, solved: false },
      ],
      nextRoundStartsAt: 69000,
    });
    expect(resolveRound(room, 61001)).toBeNull();
    expect(rooms.snapshot(room)).toMatchObject({ phase: "roundResults", players: [{ finished: true, totalPoints: 5000 }, { finished: true, totalPoints: 0 }] });
    expect(acceptGuess(room, host.playerId, request, 62000)).toMatchObject({ ok: true, guessesUsed: 1 });
  });

  it("replays rejected request IDs without accepting a changed date", () => {
    const { room } = countdownRoom();
    startRound(room, event);
    const host = room.players[0];
    const invalid = { round: 1, date: "2000-02-30", requestId: "invalid" };
    const rejected = acceptGuess(room, host.playerId, invalid, 1001);
    expect(rejected).toMatchObject({ ok: false, requestId: "invalid", error: { code: "INVALID_DATE" } });
    expect(acceptGuess(room, host.playerId, { ...invalid, date: event.date }, 1002)).toEqual(rejected);
    expect(ownRound(room, host.playerId)?.guesses).toEqual([]);
  });

  it("bounds rejection retries without evicting an accepted guess", () => {
    const { room } = countdownRoom();
    startRound(room, event);
    const playerId = room.players[0].playerId;
    const accepted = { round: 1, date: "2000-01-09", requestId: "accepted" };
    const original = acceptGuess(room, playerId, accepted, 1001);
    for (let index = 0; index < 100; index++) {
      expect(acceptGuess(room, playerId, { round: 1, date: "invalid", requestId: `invalid-${index}` }, 1002)).toMatchObject({ ok: false });
    }
    expect(acceptGuess(room, playerId, accepted, 1003)).toEqual(original);
    expect(acceptGuess(room, playerId, { round: 1, date: event.date, requestId: "invalid-99" }, 1003)).toMatchObject({ ok: false });
    expect(acceptGuess(room, playerId, { round: 1, date: event.date, requestId: "invalid-0" }, 1003)).toMatchObject({ ok: true, guessesUsed: 2 });
  });

  it("finishes after six distinct guesses and resolves early when both players finish", () => {
    const { room } = countdownRoom();
    startRound(room, event);
    for (const player of room.players) {
      for (let day = 1; day <= 6; day++) {
        expect(acceptGuess(room, player.playerId, { round: 1, date: `2000-01-0${day}`, requestId: `guess-${day}` }, 1001)).toMatchObject({
          ok: true, guessesUsed: day, finished: day === 6,
        });
      }
      expect(acceptGuess(room, player.playerId, { round: 1, date: event.date, requestId: "seventh" }, 1002)).toMatchObject({ ok: false, error: { code: "GUESS_LIMIT_REACHED" } });
    }
    expect(resolveRound(room, 1003)).toMatchObject({ players: [{ bestGuess: "2000-01-06", errorDays: 4 }, { bestGuess: "2000-01-06", errorDays: 4 }] });
    expect(resolveRound(room, 61000)).toBeNull();
  });

  it("starts the next distinct event after eight seconds and preserves cumulative points", () => {
    const { rooms, room } = countdownRoom();
    startRound(room, event);
    for (const player of room.players) {
      acceptGuess(room, player.playerId, { round: 1, date: event.date, requestId: "solve" }, 1001);
    }
    expect(resolveRound(room, 1001)?.nextRoundStartsAt).toBe(9001);
    const second = { ...event, id: "second-event" };
    expect(() => startRound(room, second, 9000)).toThrow();
    expect(() => startRound(room, event, 9001)).toThrow();
    expect(startRound(room, second, 9001)).toMatchObject({ round: 2, roundStartedAt: 9001, roundEndsAt: 69001 });
    expect(rooms.snapshot(room).players.map((player) => player.totalPoints)).toEqual([5000, 5000]);
    for (const player of room.players) {
      expect(acceptGuess(room, player.playerId, { round: 2, date: event.date, requestId: "solve" }, 9002)).toMatchObject({ ok: true, guessesUsed: 1 });
    }
    expect(resolveRound(room, 9002)?.players.map((player) => player.totalPoints)).toEqual([10000, 10000]);
  });

  it.each([false, true])("finishes exactly five rounds with a winner or draw (both solve: %s)", (bothSolve) => {
    const { rooms, room } = countdownRoom();
    let now = 1000;
    for (let round = 1; round <= 5; round++) {
      startRound(room, { ...event, id: `event-${round}` }, now);
      acceptGuess(room, room.players[0].playerId, { round, date: event.date, requestId: "solve" }, now + 1);
      if (bothSolve) acceptGuess(room, room.players[1].playerId, { round, date: event.date, requestId: "solve" }, now + 1);
      const result = resolveRound(room, now + 60000)!;
      expect(result.nextRoundStartsAt).toBe(round === 5 ? null : now + 68000);
      expect(resolveRound(room, now + 60001)).toBeNull();
      now += 68000;
    }
    expect(room.results).toHaveLength(5);
    expect(rooms.snapshot(room).phase).toBe("matchResults");
    expect(room.matchResult).toMatchObject({
      winnerPlayerId: bothSolve ? null : room.players[0].playerId,
      players: [
        { totalPoints: 25000, exactSolves: 5, totalErrorDays: 0, rounds: Array.from({ length: 5 }, (_, index) => ({ round: index + 1, points: 5000, errorDays: 0, solved: true })) },
        { totalPoints: bothSolve ? 25000 : 0, exactSolves: bothSolve ? 5 : 0, totalErrorDays: bothSolve ? 0 : 913105 },
      ],
    });
    expect(room.matchResult?.shareText).toBe(`Guess the Date Duel — ${bothSolve ? "Draw" : "Player 1 wins"}\n5 rounds | 25000–${bothSolve ? 25000 : 0} points | 5–${bothSolve ? 5 : 0} exact solves`);
    expect(() => startRound(room, { ...event, id: "sixth" }, now)).toThrow();
  });

  it("starts once with a 60-second deadline based on the scheduled start", () => {
    const { rooms, room } = countdownRoom();
    expect(startRound(room, event)).toEqual({
      round: 1, roundsTotal: 5, clue: "One", roundStartedAt: 1000, roundEndsAt: 61000,
    });
    expect(room.phase).toBe("playing");
    expect(rooms.snapshot(room)).toMatchObject({ round: 1, countdownStartsAt: null });
    expect(() => startRound(room, event)).toThrow();
  });
});
