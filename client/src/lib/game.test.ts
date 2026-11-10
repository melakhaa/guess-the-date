import { describe, expect, it } from "vitest";
import {
  DAILY_EVENT_IDS,
  evaluateGuess,
  getDailyPuzzle,
  getTemperature,
  hydrateRound,
  parseDateParts,
  pickUnlimitedEvent,
  type HistoricalEvent,
} from "./game";

// Synthetic fixtures only: production event answers belong on the server.
const events: HistoricalEvent[] = DAILY_EVENT_IDS.map((id) => ({
  id,
  title: "Test event",
  date: "2000-02-29",
  clues: ["First", "Second", "Third", "Fourth", "Fifth"],
  explanation: "Synthetic test fixture",
  sources: [{ label: "Example", url: "https://example.com" }],
}));
const event = events[0];
const today = new Date("2025-11-05T12:00:00Z");

describe("date parsing", () => {
  it("accepts valid leap days and rejects impossible dates", () => {
    expect(parseDateParts("29", "02", "2000", today)).toEqual({
      ok: true,
      iso: "2000-02-29",
    });
    expect(parseDateParts("29", "02", "1900", today)).toMatchObject({ ok: false });
    expect(parseDateParts("31", "04", "2020", today)).toMatchObject({ ok: false });
  });

  it("rejects future dates without consuming a guess", () => {
    expect(parseDateParts("06", "11", "2025", today)).toMatchObject({ ok: false });
  });
});

describe("guess feedback", () => {
  it.each([
    [0, "correct"],
    [14, "burning"],
    [15, "hot"],
    [60, "hot"],
    [61, "warm"],
    [730, "warm"],
    [731, "cool"],
    [3650, "cool"],
    [3651, "freezing"],
  ] as const)("maps %i days to %s", (distance, expected) => {
    expect(getTemperature(distance)).toBe(expected);
  });

  it("uses target-relative earlier and later directions", () => {
    expect(evaluateGuess("2000-01-10", "2000-01-01").direction).toBe("later");
    expect(evaluateGuess("2000-01-10", "2000-01-20").direction).toBe("earlier");
    expect(evaluateGuess("2000-01-10", "2000-01-10").direction).toBe("correct");
  });
});

describe("round state", () => {
  it("drops corrupt and duplicate persisted guesses", () => {
    const round = hydrateRound(event, {
      version: 1,
      eventId: event.id,
      mode: "daily",
      puzzleId: "001",
      guessDates: ["not-a-date", "2000-01-01", "2000-01-01"],
    });

    expect(round.guessDates).toEqual(["2000-01-01"]);
    expect(round.guesses).toHaveLength(1);
  });
});

describe("puzzle selection", () => {
  it("uses a stable UTC rotation", () => {
    expect(getDailyPuzzle(events, new Date("2025-01-01T23:59:59Z")).event.id).toBe(
      DAILY_EVENT_IDS[0],
    );
    expect(getDailyPuzzle(events, new Date("2025-02-25T00:00:00Z")).event.id).toBe(
      DAILY_EVENT_IDS[0],
    );
  });

  it("avoids recently played unlimited events when alternatives exist", () => {
    const selected = pickUnlimitedEvent(events.slice(0, 3), [events[0].id, events[1].id], () => 0);
    expect(selected.id).toBe(events[2].id);
  });
});
