export const MAX_GUESSES = 6;
export const MAX_CLUES = 5;

const DAY_MS = 86_400_000;
const DAILY_EPOCH_MS = Date.UTC(2025, 0, 1);

export type GameMode = "daily" | "unlimited";
export type RoundStatus = "playing" | "won" | "lost";
export type Temperature =
  | "correct"
  | "burning"
  | "hot"
  | "warm"
  | "cool"
  | "freezing";

export interface HistoricalEvent {
  id: string;
  title: string;
  date: string;
  clues: [string, string, string, string, string];
  explanation: string;
  sources: { label: string; url: string }[];
  tags?: string[];
  difficulty?: "easy" | "medium" | "hard";
}

export interface EvaluatedGuess {
  date: string;
  temperature: Temperature;
  direction: "earlier" | "later" | "correct";
  distanceDays: number;
}

export interface StoredRound {
  version: 1;
  eventId: string;
  puzzleId: string;
  mode: GameMode;
  guessDates: string[];
}

export interface RoundState extends StoredRound {
  guesses: EvaluatedGuess[];
  status: RoundStatus;
}

export const temperatureLabels: Record<Temperature, string> = {
  correct: "Correct",
  burning: "Burning",
  hot: "Hot",
  warm: "Warm",
  cool: "Cool",
  freezing: "Freezing",
};

export const DAILY_EVENT_IDS = [
  "wright-first-flight",
  "panama-canal-opens",
  "us-womens-suffrage",
  "tutankhamun-tomb-discovered",
  "first-winter-olympics",
  "baird-television-demonstration",
  "lindbergh-atlantic-flight",
  "penicillin-discovered",
  "first-academy-awards",
  "salt-march-begins",
  "empire-state-building-opens",
  "golden-gate-bridge-opens",
  "indonesia-independence-proclaimed",
  "united-nations-founded",
  "eniac-unveiled",
  "india-independence",
  "universal-declaration-human-rights",
  "everest-first-ascent",
  "brown-v-board",
  "cern-founded",
  "bandung-conference",
  "ghana-independence",
  "sputnik-launch",
  "nasa-begins-operations",
  "first-human-spaceflight",
  "march-on-washington",
  "beatles-ed-sullivan",
  "first-heart-transplant",
  "apollo-11-moon-landing",
  "first-earth-day",
  "first-barcode-scan",
  "viking-1-mars-landing",
  "star-wars-premiere",
  "first-ivf-baby",
  "smallpox-eradicated",
  "ibm-pc-introduced",
  "macintosh-introduced",
  "berlin-wall-opens",
  "mandela-released",
  "first-website",
  "first-sms",
  "mandela-inauguration",
  "deep-blue-defeats-kasparov",
  "iss-first-module",
  "human-genome-draft",
  "wikipedia-launches",
  "first-youtube-video",
  "pluto-reclassified",
  "iphone-unveiled",
  "higgs-boson-announced",
  "curiosity-lands-on-mars",
  "paris-agreement-adopted",
  "first-black-hole-image",
  "james-webb-launch",
  "chandrayaan-3-moon-landing",
] as const;

function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isoToUtc(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseDateParts(
  dayValue: string,
  monthValue: string,
  yearValue: string,
  today = new Date(),
): { ok: true; iso: string } | { ok: false; error: string } {
  if (!dayValue || !monthValue || !yearValue) {
    return { ok: false, error: "Enter a day, month, and four-digit year." };
  }

  if (![dayValue, monthValue, yearValue].every((value) => /^\d+$/.test(value))) {
    return { ok: false, error: "Use numbers only for the date." };
  }

  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);
  const currentYear = today.getUTCFullYear();

  if (yearValue.length !== 4 || year < 1900 || year > currentYear) {
    return {
      ok: false,
      error: `Enter a year from 1900 to ${currentYear}.`,
    };
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, error: "That date does not exist. Check the day and month." };
  }

  if (date.getTime() > utcMidnight(today)) {
    return { ok: false, error: "Enter a date that has already happened." };
  }

  return {
    ok: true,
    iso: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

export function getTemperature(distanceDays: number): Temperature {
  if (distanceDays === 0) return "correct";
  if (distanceDays <= 14) return "burning";
  if (distanceDays <= 60) return "hot";
  if (distanceDays <= 730) return "warm";
  if (distanceDays <= 3_650) return "cool";
  return "freezing";
}

export function evaluateGuess(targetIso: string, guessIso: string): EvaluatedGuess {
  const difference = isoToUtc(targetIso) - isoToUtc(guessIso);
  const distanceDays = Math.abs(Math.round(difference / DAY_MS));

  return {
    date: guessIso,
    distanceDays,
    temperature: getTemperature(distanceDays),
    direction: difference === 0 ? "correct" : difference > 0 ? "later" : "earlier",
  };
}

export function createRound(
  event: HistoricalEvent,
  mode: GameMode,
  puzzleId: string,
): RoundState {
  return hydrateRound(event, {
    version: 1,
    eventId: event.id,
    mode,
    puzzleId,
    guessDates: [],
  });
}

export function hydrateRound(event: HistoricalEvent, stored: StoredRound): RoundState {
  const guessDates = stored.guessDates
    .filter(isValidIsoDate)
    .filter((date, index, dates) => dates.indexOf(date) === index)
    .slice(0, MAX_GUESSES);
  const guesses = guessDates.map((date) => evaluateGuess(event.date, date));
  const won = guesses.some((guess) => guess.temperature === "correct");

  return {
    ...stored,
    eventId: event.id,
    guessDates,
    guesses,
    status: won ? "won" : guesses.length >= MAX_GUESSES ? "lost" : "playing",
  };
}

export function addGuess(
  event: HistoricalEvent,
  round: RoundState,
  guessIso: string,
): RoundState {
  if (round.status !== "playing" || round.guessDates.includes(guessIso)) return round;
  return hydrateRound(event, {
    version: 1,
    eventId: event.id,
    mode: round.mode,
    puzzleId: round.puzzleId,
    guessDates: [...round.guessDates, guessIso],
  });
}

export function serializeRound(round: RoundState): StoredRound {
  return {
    version: 1,
    eventId: round.eventId,
    mode: round.mode,
    puzzleId: round.puzzleId,
    guessDates: round.guessDates,
  };
}

export function parseStoredRound(value: string | null): StoredRound | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;

    const round = parsed as Partial<StoredRound>;
    if (
      round.version !== 1 ||
      typeof round.eventId !== "string" ||
      typeof round.puzzleId !== "string" ||
      (round.mode !== "daily" && round.mode !== "unlimited") ||
      !Array.isArray(round.guessDates) ||
      !round.guessDates.every((date) => typeof date === "string")
    ) {
      return null;
    }

    return round as StoredRound;
  } catch {
    return null;
  }
}

export function utcDateKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getDailyPuzzle(events: HistoricalEvent[], date = new Date()) {
  const dayIndex = Math.floor((utcMidnight(date) - DAILY_EPOCH_MS) / DAY_MS);
  const rotationIndex = ((dayIndex % DAILY_EVENT_IDS.length) + DAILY_EVENT_IDS.length) % DAILY_EVENT_IDS.length;
  const eventId = DAILY_EVENT_IDS[rotationIndex];
  const event = events.find((candidate) => candidate.id === eventId);

  if (!event) throw new Error(`Daily event not found: ${eventId}`);

  return {
    event,
    dateKey: utcDateKey(date),
    puzzleId: String(dayIndex + 1).padStart(3, "0"),
  };
}

export function pickUnlimitedEvent(
  events: HistoricalEvent[],
  recentIds: string[],
  random = Math.random,
): HistoricalEvent {
  const available = events.filter((event) => !recentIds.includes(event.id));
  const pool = available.length ? available : events;
  return pool[Math.floor(random() * pool.length)];
}

export function visibleClueCount(round: RoundState): number {
  const incorrectGuesses = round.guesses.filter(
    (guess) => guess.temperature !== "correct",
  ).length;
  return Math.min(MAX_CLUES, 1 + incorrectGuesses);
}

export function formatNumericDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day} / ${month} / ${year}`;
}

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoToUtc(iso)));
}

export function countdownToNextUtc(date = new Date()): string {
  const next = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
  const seconds = Math.max(0, Math.floor((next - date.getTime()) / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function shareText(round: RoundState): string {
  const symbols: Record<Temperature, string> = {
    correct: "🟩",
    burning: "🟥",
    hot: "🟧",
    warm: "🟨",
    cool: "🟦",
    freezing: "⬜",
  };
  const score = round.status === "won" ? `${round.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;

  return [
    `Guess the Date #${round.puzzleId} 📅`,
    `Score: ${score}`,
    round.guesses.map((guess) => symbols[guess.temperature]).join(" "),
    "Can you uncover the mystery date?",
  ].join("\n");
}
