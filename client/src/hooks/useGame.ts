import { useEffect, useMemo, useState } from "react";
import { events } from "../lib/events";
import {
  addGuess,
  countdownToNextUtc,
  createRound,
  getDailyPuzzle,
  hydrateRound,
  parseStoredRound,
  pickUnlimitedEvent,
  serializeRound,
  utcDateKey,
  type GameMode,
  type HistoricalEvent,
  type RoundState,
} from "../lib/game";
import { dailyKey, readStorage, recentKey, unlimitedKey, writeStorage } from "../lib/storage";

const RECENT_LIMIT = 10;

function loadDailyRound(event: HistoricalEvent, puzzleId: string): RoundState {
  const stored = parseStoredRound(readStorage(dailyKey(utcDateKey())));
  return stored?.eventId === event.id && stored.puzzleId === puzzleId
    ? hydrateRound(event, stored)
    : createRound(event, "daily", puzzleId);
}

function loadUnlimitedRound(): RoundState | null {
  const stored = parseStoredRound(readStorage(unlimitedKey));
  if (!stored || stored.mode !== "unlimited") return null;
  const event = events.find((candidate) => candidate.id === stored.eventId);
  return event ? hydrateRound(event, stored) : null;
}

function loadRecentIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(readStorage(recentKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function useGame() {
  const [now, setNow] = useState(() => new Date());
  const dateKey = utcDateKey(now);
  const dailyPuzzle = useMemo(
    () => getDailyPuzzle(events, new Date(`${dateKey}T12:00:00Z`)),
    [dateKey],
  );

  const [mode, setMode] = useState<GameMode>("daily");
  const [dailyRound, setDailyRound] = useState(() =>
    loadDailyRound(dailyPuzzle.event, dailyPuzzle.puzzleId),
  );
  const [unlimitedRound, setUnlimitedRound] = useState(loadUnlimitedRound);
  const [recentIds, setRecentIds] = useState(loadRecentIds);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setDailyRound(loadDailyRound(dailyPuzzle.event, dailyPuzzle.puzzleId));
  }, [dailyPuzzle.event, dailyPuzzle.puzzleId]);

  useEffect(() => {
    writeStorage(dailyKey(dailyPuzzle.dateKey), JSON.stringify(serializeRound(dailyRound)));
  }, [dailyPuzzle.dateKey, dailyRound]);

  useEffect(() => {
    if (unlimitedRound) {
      writeStorage(unlimitedKey, JSON.stringify(serializeRound(unlimitedRound)));
    }
  }, [unlimitedRound]);

  useEffect(() => {
    writeStorage(recentKey, JSON.stringify(recentIds));
  }, [recentIds]);

  const startUnlimitedRound = () => {
    const event = pickUnlimitedEvent(events, recentIds);
    setUnlimitedRound(createRound(event, "unlimited", `U${Date.now().toString(36).slice(-5).toUpperCase()}`));
    setRecentIds((current) => [event.id, ...current.filter((id) => id !== event.id)].slice(0, RECENT_LIMIT));
    setMode("unlimited");
  };

  const playUnlimited = () => {
    if (unlimitedRound?.status === "playing") setMode("unlimited");
    else startUnlimitedRound();
  };

  const round = mode === "daily" ? dailyRound : unlimitedRound;
  const event = round ? (events.find((candidate) => candidate.id === round.eventId) ?? null) : null;

  const submitGuess = (iso: string): string | null => {
    if (!round || !event) return "This round is not available.";
    if (round.guessDates.includes(iso)) return "You already tried that date.";

    const next = addGuess(event, round, iso);
    if (round.mode === "daily") setDailyRound(next);
    else setUnlimitedRound(next);
    return null;
  };

  return {
    dailyPuzzleId: dailyPuzzle.puzzleId,
    countdown: countdownToNextUtc(now),
    mode,
    round,
    event,
    submitGuess,
    playDaily: () => setMode("daily"),
    playUnlimited,
    playAnother: startUnlimitedRound,
  };
}
