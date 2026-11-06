import { MAX_CLUES, type GuessDirection, type Temperature } from "@dateguessr/shared";
import { calendarDayDifference } from "./dates.js";

export interface EvaluatedGuess {
  date: string;
  temperature: Temperature;
  direction: GuessDirection;
  distanceDays: number;
}

export function getTemperature(distanceDays: number): Temperature {
  if (distanceDays === 0) return "correct";
  if (distanceDays <= 7) return "burning";
  if (distanceDays <= 30) return "hot";
  if (distanceDays <= 365) return "warm";
  if (distanceDays <= 1_825) return "cool";
  return "freezing";
}

export function evaluateGuess(targetIso: string, guessIso: string): EvaluatedGuess {
  const differenceDays = calendarDayDifference(targetIso, guessIso);
  const distanceDays = Math.abs(differenceDays);

  return {
    date: guessIso,
    temperature: getTemperature(distanceDays),
    direction: differenceDays === 0 ? "exact" : differenceDays > 0 ? "later" : "earlier",
    distanceDays,
  };
}

export function getVisibleClueCount(incorrectGuesses: number): number {
  return Math.min(MAX_CLUES, 1 + incorrectGuesses);
}
