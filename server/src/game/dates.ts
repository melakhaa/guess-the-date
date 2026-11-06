import { MAX_DATE_YEAR, MIN_DATE_YEAR } from "@guess-the-date/shared";

const DAY_MS = 86_400_000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ParsedIsoDate {
  value: string;
  year: number;
  month: number;
  day: number;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseIsoDate(value: string): ParsedIsoDate | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    year < MIN_DATE_YEAR ||
    year > MAX_DATE_YEAR ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }

  return { value, year, month, day };
}

export function calendarDayDifference(targetIso: string, guessIso: string): number {
  const target = parseIsoDate(targetIso);
  const guess = parseIsoDate(guessIso);
  if (!target || !guess) throw new RangeError("Dates must be valid ISO dates in the supported range.");

  const targetDay = Date.UTC(target.year, target.month - 1, target.day) / DAY_MS;
  const guessDay = Date.UTC(guess.year, guess.month - 1, guess.day) / DAY_MS;
  return targetDay - guessDay;
}
