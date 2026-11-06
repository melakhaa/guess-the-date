import { calendarDayDifference } from "./dates.js";

export const SCORING_VERSION = 1;

export interface RoundScore {
  bestGuess: string | null;
  errorDays: number | null;
  points: number;
  solved: boolean;
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
