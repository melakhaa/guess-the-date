import { MAX_DATE_YEAR, MIN_DATE_YEAR } from "@guess-the-date/shared";

export function parseDateParts(
  dayValue: string,
  monthValue: string,
  yearValue: string,
): { ok: true; iso: string } | { ok: false; error: string } {
  if (!dayValue || !monthValue || !yearValue) {
    return { ok: false, error: "Enter a day, month, and four-digit year." };
  }
  if (![dayValue, monthValue, yearValue].every((value) => /^\d+$/.test(value))) {
    return { ok: false, error: "Use numbers only for the date." };
  }

  const [day, month, year] = [dayValue, monthValue, yearValue].map(Number);
  if (yearValue.length !== 4 || year < MIN_DATE_YEAR || year > MAX_DATE_YEAR) {
    return { ok: false, error: `Enter a year from ${MIN_DATE_YEAR} to ${MAX_DATE_YEAR}.` };
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, error: "That date does not exist. Check the day and month." };
  }

  return { ok: true, iso: date.toISOString().slice(0, 10) };
}

export function formatNumericDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day} / ${month} / ${year}`;
}

const longDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatLongDate(iso: string): string {
  return longDate.format(new Date(`${iso}T00:00:00Z`));
}
