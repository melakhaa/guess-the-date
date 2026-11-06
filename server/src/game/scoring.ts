import { MAX_DATE_YEAR, MIN_DATE_YEAR } from "@guess-the-date/shared";
import { calendarDayDifference } from "./dates.js";

export const SCORING_VERSION = 1;
export const NO_GUESS_ERROR_DAYS = calendarDayDifference(
  `${MAX_DATE_YEAR}-12-31`, `${MIN_DATE_YEAR}-01-01`,
);

export interface RoundScore {
  bestGuess: string | null;
  errorDays: number | null;
  points: number;
  solved: boolean;
}

export interface MatchScore {
  totalPoints: number;
  exactSolves: number;
  totalErrorDays: number;
}

/** Positive means the first player wins; negative means the second; zero is a draw. */
export function compareMatchScores(first: MatchScore, second: MatchScore): number {
  return Math.sign(
    first.totalPoints - second.totalPoints ||
    first.exactSolves - second.exactSolves ||
    second.totalErrorDays - first.totalErrorDays,
  );
}

export function summarizeMatch(
  rounds: readonly Pick<RoundScore, "points" | "errorDays" | "solved">[],
): MatchScore {
  const totals: MatchScore = { totalPoints: 0, exactSolves: 0, totalErrorDays: 0 };
  for (const round of rounds) {
    totals.totalPoints += round.points;
    totals.exactSolves += round.solved ? 1 : 0;
    totals.totalErrorDays += round.errorDays ?? NO_GUESS_ERROR_DAYS;
  }
  return totals;
}

export function scoreRound(targetDate: string, acceptedDates: readonly string[]): RoundScore {
  let bestGuess: string | null = null;
  let errorDays: number | null = null;
  for (const date of acceptedDates) {
    const error = Math.abs(calendarDayDifference(targetDate, date));
    if (errorDays === null || error < errorDays) {
      bestGuess = date;
      errorDays = error;
    }
  }

  const accuracy = errorDays === null ? 0 : Math.round(4500 * Math.exp(-errorDays / 365));
  const exactGuess = acceptedDates.indexOf(targetDate) + 1;
  const bonus = errorDays === 0 ? Math.round(500 * (6 - exactGuess) / 5) : 0;

  return {
    bestGuess,
    errorDays,
    points: Math.min(5000, accuracy + bonus),
    solved: errorDays === 0,
  };
}
