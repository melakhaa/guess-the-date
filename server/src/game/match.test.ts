import { describe, expect, it } from "vitest";
import { compareMatchScores, scoreRound, summarizeMatch } from "./index.js";

describe("match comparison", () => {
  it("breaks tied points and solves by smaller error, otherwise draws", () => {
    const higher = { totalPoints: 10000, exactSolves: 1, totalErrorDays: 499 };
    const lower = { totalPoints: 10000, exactSolves: 1, totalErrorDays: 500 };
    expect(compareMatchScores(higher, lower)).toBe(1);
    expect(compareMatchScores(lower, higher)).toBe(-1);
    expect(compareMatchScores(higher, { ...higher })).toBe(0);
  });

  it("breaks equal points by exact solves before day error", () => {
    const higher = { totalPoints: 10000, exactSolves: 2, totalErrorDays: 500 };
    const lower = { totalPoints: 10000, exactSolves: 1, totalErrorDays: 1 };
    expect(compareMatchScores(higher, lower)).toBe(1);
    expect(compareMatchScores(lower, higher)).toBe(-1);
  });

  it("ranks points ahead of exact solves and day error", () => {
    const higher = { totalPoints: 10001, exactSolves: 0, totalErrorDays: 900000 };
    const lower = { totalPoints: 10000, exactSolves: 2, totalErrorDays: 0 };
    expect(compareMatchScores(higher, lower)).toBe(1);
    expect(compareMatchScores(lower, higher)).toBe(-1);
  });
});

describe("match totals", () => {
  it("starts with zero totals before any rounds have completed", () => {
    expect(summarizeMatch([])).toEqual({ totalPoints: 0, exactSolves: 0, totalErrorDays: 0 });
  });

  it("awards 25000 points for five first-guess solves", () => {
    const rounds = Array.from({ length: 5 }, () => scoreRound("2000-01-01", ["2000-01-01"]));
    expect(summarizeMatch(rounds)).toEqual({ totalPoints: 25000, exactSolves: 5, totalErrorDays: 0 });
  });

  it("does not improve the error tiebreaker by skipping a round", () => {
    const skipped = summarizeMatch([scoreRound("1600-01-01", [])]);
    const worstGuess = summarizeMatch([scoreRound("1600-01-01", ["2099-12-31"])]);
    expect(skipped).toEqual({ totalPoints: 0, exactSolves: 0, totalErrorDays: 182621 });
    expect(compareMatchScores(skipped, worstGuess)).toBe(0);
  });

  it("applies the maximum supported day error for each unplayed round", () => {
    expect(summarizeMatch([
      { points: 0, errorDays: null, solved: false },
      { points: 0, errorDays: null, solved: false },
      { points: 5000, errorDays: 0, solved: true },
      { points: 4488, errorDays: 1, solved: false },
      { points: 0, errorDays: 182621, solved: false },
    ])).toEqual({ totalPoints: 9488, exactSolves: 1, totalErrorDays: 547864 });
  });

  it("sums five round scores and counts exact solves", () => {
    expect(summarizeMatch([
      { points: 5000, errorDays: 0, solved: true },
      { points: 4488, errorDays: 1, solved: false },
      { points: 1655, errorDays: 365, solved: false },
      { points: 4500, errorDays: 0, solved: true },
      { points: 0, errorDays: 10000, solved: false },
    ])).toEqual({ totalPoints: 15643, exactSolves: 2, totalErrorDays: 10366 });
  });
});
