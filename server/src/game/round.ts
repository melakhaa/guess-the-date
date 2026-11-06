import { MAX_GUESSES, type DuelErrorCode } from "@guess-the-date/shared";
import { parseIsoDate } from "./dates.js";
import { evaluateGuess, getVisibleClueCount, type EvaluatedGuess } from "./feedback.js";

export interface PlayerRoundState {
  guesses: readonly EvaluatedGuess[];
  solved: boolean;
  finished: boolean;
  visibleClueCount: number;
}

export interface AcceptedGuessResult {
  ok: true;
  state: PlayerRoundState;
  guess: EvaluatedGuess;
  unlockedClueNumber?: number;
}

export interface RejectedGuessResult {
  ok: false;
  state: PlayerRoundState;
  code: Extract<DuelErrorCode,
    "INVALID_DATE" | "DUPLICATE_GUESS" | "ALREADY_FINISHED" | "GUESS_LIMIT_REACHED"
  >;
}

export type GuessAttemptResult = AcceptedGuessResult | RejectedGuessResult;

export function createPlayerRound(): PlayerRoundState {
  return {
    guesses: [],
    solved: false,
    finished: false,
    visibleClueCount: 1,
  };
}

export function submitGuess(
  targetDate: string,
  state: PlayerRoundState,
  guessDate: string,
): GuessAttemptResult {
  if (state.guesses.length >= MAX_GUESSES) {
    return { ok: false, code: "GUESS_LIMIT_REACHED", state };
  }
  if (state.finished) return { ok: false, code: "ALREADY_FINISHED", state };
  if (!parseIsoDate(guessDate)) {
    return { ok: false, code: "INVALID_DATE", state };
  }
  if (state.guesses.some((guess) => guess.date === guessDate)) {
    return { ok: false, code: "DUPLICATE_GUESS", state };
  }

  const guess = evaluateGuess(targetDate, guessDate);
  const guesses = [...state.guesses, guess];
  const solved = guess.direction === "exact";
  const incorrectGuesses = guesses.filter((candidate) => candidate.direction !== "exact").length;
  const visibleClueCount = getVisibleClueCount(incorrectGuesses);

  return {
    ok: true,
    state: {
      guesses,
      solved,
      finished: solved || guesses.length >= MAX_GUESSES,
      visibleClueCount,
    },
    guess,
    ...(visibleClueCount > state.visibleClueCount
      ? { unlockedClueNumber: visibleClueCount }
      : {}),
  };
}
