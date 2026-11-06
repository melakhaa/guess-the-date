import { describe, expect, it } from "vitest";
import { scoreRound } from "./index.js";

describe("round scoring", () => {
  it("scores the closest guess, not the last, with no unsolved bonus", () => {
    expect(scoreRound("2000-01-10", ["2000-01-01", "2000-01-09", "2000-01-20"])).toEqual({
      bestGuess: "2000-01-09", errorDays: 1, points: 4488, solved: false,
    });
    expect(scoreRound("2001-01-01", ["2000-01-02"])).toEqual({
      bestGuess: "2000-01-02", errorDays: 365, points: 1655, solved: false,
    });
  });
  it.each([
    [1, 5000], [2, 4900], [3, 4800], [4, 4700], [5, 4600], [6, 4500],
  ])("awards %i-guess exact solves their bonus", (attempt, points) => {
    const misses = ["2000-01-01", "2000-01-02", "2000-01-03", "2000-01-04", "2000-01-05"];
    expect(scoreRound("2000-01-10", [...misses.slice(0, attempt - 1), "2000-01-10"])).toEqual({
      bestGuess: "2000-01-10", errorDays: 0, points, solved: true,
    });
  });

  it("awards zero with no best guess when no dates were accepted", () => {
    expect(scoreRound("2000-01-10", [])).toEqual({
      bestGuess: null, errorDays: null, points: 0, solved: false,
    });
  });
});
