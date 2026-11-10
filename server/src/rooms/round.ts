import { MATCH_ROUNDS, ROUND_DURATION_MS, ROUND_RESULTS_DURATION_MS, type GuessSubmitAck, type GuessSubmitRequest, type OwnRoundState, type RoundResultEvent, type RoundStartEvent } from "@guess-the-date/shared";
import type { HistoricalEvent } from "../content/events.js";
import { compareMatchScores, createPlayerRound, scoreRound, submitGuess, summarizeMatch, type PlayerRoundState } from "../game/index.js";
import { RoomError, type Room } from "./RoomManager.js";

export interface ActiveRound {
  number: number;
  result?: RoundResultEvent;
  event: HistoricalEvent;
  startedAt: number;
  endsAt: number;
  players: Map<string, PlayerRoundState>;
  acks: Map<string, Map<string, GuessSubmitAck>>;
}

export function ownRound(room: Room, playerId: string): OwnRoundState | null {
  const round = room.round;
  const state = round?.players.get(playerId);
  if (!round || !state) return null;
  return {
    round: round.number, clues: round.event.clues.slice(0, state.visibleClueCount),
    guesses: state.guesses.map(({ date, temperature, direction }) => ({ date, temperature, direction })),
    finished: state.finished, roundStartedAt: round.startedAt, roundEndsAt: round.endsAt,
  };
}

export function acceptGuess(room: Room, playerId: string, request: GuessSubmitRequest, now: number): GuessSubmitAck {
  const round = room.round;
  if (!round) throw new RoomError("ROUND_NOT_ACTIVE", 409, "No active round.");
  if (request.round !== round.number) throw new RoomError("ROUND_MISMATCH", 409, "Wrong round.");
  const state = round.players.get(playerId);
  const acks = round.acks.get(playerId);
  if (!state || !acks) throw new RoomError("UNAUTHORIZED", 401, "Player is not in this round.");
  const cached = acks.get(request.requestId);
  if (cached) return cached;
  if (now >= round.endsAt) throw new RoomError("ROUND_EXPIRED", 409, "Round deadline passed.");
  if (room.phase !== "playing") throw new RoomError("ROUND_NOT_ACTIVE", 409, "No active round.");
  const result = submitGuess(round.event.date, state, request.date);
  round.players.set(playerId, result.state);
  const response: GuessSubmitAck = result.ok ? {
    ok: true, requestId: request.requestId,
    temperature: result.guess.temperature, direction: result.guess.direction,
    guessesUsed: result.state.guesses.length, solved: result.state.solved, finished: result.state.finished,
    ...(result.unlockedClueNumber ? { newClue: round.event.clues[result.unlockedClueNumber - 1] } : {}),
  } : { ok: false, requestId: request.requestId, error: { code: result.code, message: "Guess rejected." } };
  acks.set(request.requestId, response);
  // Keep all six accepted guesses; evict only old rejections from the bounded retry window.
  if (acks.size > 64) {
    const oldestRejection = [...acks].find(([, ack]) => !ack.ok)!;
    acks.delete(oldestRejection[0]);
  }
  return response;
}

export function resolveRound(room: Room, now: number): RoundResultEvent | null {
  const round = room.round;
  if (room.phase !== "playing" || !round) return null;
  if (now < round.endsAt && ![...round.players.values()].every((state) => state.finished)) return null;
  const { id, title, date, explanation, sources } = round.event;
  round.result = {
    round: round.number, event: { id, title, date, explanation, sources },
    players: room.players.map((player) => {
      const state = round.players.get(player.playerId)!;
      const score = scoreRound(date, state.guesses.map((guess) => guess.date));
      round.players.set(player.playerId, { ...state, finished: true });
      const previousTotal = room.results.at(-1)?.players.find((result) => result.playerId === player.playerId)?.totalPoints ?? 0;
      return { playerId: player.playerId, nickname: player.nickname, ...score, totalPoints: previousTotal + score.points };
    }),
    nextRoundStartsAt: round.number < MATCH_ROUNDS ? now + ROUND_RESULTS_DURATION_MS : null,
  };
  room.results.push(round.result);
  room.phase = "roundResults";
  if (room.results.length === MATCH_ROUNDS) {
    const players = room.players.map(({ playerId, nickname }) => {
      const rounds = room.results.map((result) => {
        const { points, errorDays, solved } = result.players.find((player) => player.playerId === playerId)!;
        return { round: result.round, points, errorDays, solved };
      });
      return { playerId, nickname, ...summarizeMatch(rounds), rounds };
    });
    const comparison = compareMatchScores(players[0], players[1]);
    const winner = comparison > 0 ? 0 : comparison < 0 ? 1 : null;
    room.matchResult = {
      winnerPlayerId: winner === null ? null : players[winner].playerId,
      players,
      shareText: `Guess the Date Duel — ${winner === null ? "Draw" : `Player ${winner + 1} wins`}\n5 rounds | ${players[0].totalPoints}–${players[1].totalPoints} points | ${players[0].exactSolves}–${players[1].exactSolves} exact solves`,
    };
    room.phase = "matchResults";
  }
  return round.result;
}

export function startRound(room: Room, event: HistoricalEvent, now = Date.now()): Omit<RoundStartEvent, "serverNow"> {
  const startedAt = room.phase === "countdown" ? room.countdownStartsAt
    : room.phase === "roundResults" ? room.round?.result?.nextRoundStartsAt : null;
  if (startedAt == null || now < startedAt || room.results.length >= MATCH_ROUNDS || room.results.some((result) => result.event.id === event.id)) {
    throw new RoomError("ROOM_STATE_CONFLICT", 409, "Round cannot start.");
  }
  const number = room.results.length + 1;
  room.round = {
    number, event, startedAt, endsAt: startedAt + ROUND_DURATION_MS,
    acks: new Map(room.players.map((player) => [player.playerId, new Map()])),
    players: new Map(room.players.map((player) => [player.playerId, createPlayerRound()])),
  };
  room.phase = "playing";
  room.countdownStartsAt = null;
  room.expiresAt = Math.max(room.expiresAt, room.round.endsAt + 30 * 60_000);
  return {
    round: number, roundsTotal: MATCH_ROUNDS, clue: event.clues[0],
    roundStartedAt: startedAt, roundEndsAt: room.round.endsAt,
  };
}
