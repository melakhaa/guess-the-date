import { describe, expect, it } from "vitest";
import {
  calendarDayDifference,
  createPlayerRound,
  evaluateGuess,
  getTemperature,
  getVisibleClueCount,
  parseIsoDate,
  submitGuess,
} from "./index.js";

describe("date rules", () => {
  it("accepts only real ISO dates in the supported range", () => {
    const accepted = ["1600-01-01", "1600-02-29", "2000-02-29", "2099-12-31"];
    const rejected = [
      "1599-12-31",
      "2100-01-01",
      "1900-02-29",
      "2001-02-29",
      "2001-04-31",
      "2000-1-01",
      "01-01-2000",
    ];

    expect(accepted.map((date) => parseIsoDate(date)?.value ?? null)).toEqual(accepted);
    expect(rejected.map((date) => parseIsoDate(date))).toEqual(rejected.map(() => null));
  });

  it("calculates signed UTC calendar-day differences", () => {
    expect(calendarDayDifference("2000-03-01", "2000-02-28")).toBe(2);
    expect(calendarDayDifference("2000-01-01", "2000-01-02")).toBe(-1);
  });
});

describe("guess feedback", () => {
  it("maps every temperature boundary", () => {
    const distances = [0, 1, 7, 8, 30, 31, 365, 366, 1_825, 1_826];

    expect(distances.map(getTemperature)).toEqual([
      "correct",
      "burning",
      "burning",
      "hot",
      "hot",
      "warm",
      "warm",
      "cool",
      "cool",
      "freezing",
    ]);
  });

  it("reports whether the answer is earlier, later, or exact", () => {
    expect(evaluateGuess("2000-01-10", "2000-01-01").direction).toBe("later");
    expect(evaluateGuess("2000-01-10", "2000-01-20").direction).toBe("earlier");
    expect(evaluateGuess("2000-01-10", "2000-01-10")).toMatchObject({
      direction: "exact",
      temperature: "correct",
      distanceDays: 0,
    });
  });

  it("unlocks one clue for each of the first four incorrect guesses", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(getVisibleClueCount)).toEqual([1, 2, 3, 4, 5, 5, 5]);
  });
});

describe("round guess rules", () => {
  it("finishes after six distinct misses, caps clues, and rejects a seventh guess", () => {
    let state = createPlayerRound();
    const unlockedClues = [];
    for (const date of ["2000-01-01", "2000-01-02", "2000-01-03", "2000-01-04", "2000-01-05", "2000-01-06"]) {
      const result = submitGuess("2000-01-10", state, date);
      if (!result.ok) throw new Error("Expected an accepted guess.");
      unlockedClues.push(result.unlockedClueNumber);
      state = result.state;
    }
    expect(unlockedClues).toEqual([2, 3, 4, 5, undefined, undefined]);
    expect(state).toMatchObject({ solved: false, finished: true, visibleClueCount: 5 });
    expect(state.guesses).toHaveLength(6);
    expect(submitGuess("2000-01-10", state, "2000-01-10")).toEqual({
      ok: false, code: "GUESS_LIMIT_REACHED", state,
    });
  });

  it("accepts a valid incorrect guess and unlocks the next clue", () => {
    const result = submitGuess("2000-01-10", createPlayerRound(), "2000-01-01");

    expect(result).toMatchObject({
      ok: true,
      guess: { date: "2000-01-01", direction: "later", temperature: "hot" },
      unlockedClueNumber: 2,
      state: {
        solved: false,
        finished: false,
        visibleClueCount: 2,
      },
    });
  });

  it("rejects an invalid date without consuming a guess", () => {
    const initial = createPlayerRound();

    expect(submitGuess("2000-01-10", initial, "2000-02-30")).toEqual({
      ok: false,
      code: "INVALID_DATE",
      state: initial,
    });
  });

  it("rejects a duplicate date without consuming another guess", () => {
    const first = submitGuess("2000-01-10", createPlayerRound(), "2000-01-01");
    if (!first.ok) throw new Error("Expected the first guess to be accepted.");

    expect(submitGuess("2000-01-10", first.state, "2000-01-01")).toEqual({
      ok: false,
      code: "DUPLICATE_GUESS",
      state: first.state,
    });
  });

  it("finishes the player round on an exact guess", () => {
    const result = submitGuess("2000-01-10", createPlayerRound(), "2000-01-10");

    expect(result).toMatchObject({
      ok: true,
      guess: { direction: "exact", temperature: "correct" },
      state: { solved: true, finished: true, visibleClueCount: 1 },
    });
  });

  it("rejects guesses after the player has solved the round", () => {
    const solved = submitGuess("2000-01-10", createPlayerRound(), "2000-01-10");
    if (!solved.ok) throw new Error("Expected the exact guess to be accepted.");

    expect(submitGuess("2000-01-10", solved.state, "2000-01-11")).toEqual({
      ok: false,
      code: "ALREADY_FINISHED",
      state: solved.state,
    });
  });
});
