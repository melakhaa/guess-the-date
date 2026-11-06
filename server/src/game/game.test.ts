import { describe, expect, it } from "vitest";
import {
  calendarDayDifference,
  evaluateGuess,
  getTemperature,
  getVisibleClueCount,
  parseIsoDate,
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
