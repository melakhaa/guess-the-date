import type { MatchResultEvent } from "@guess-the-date/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MatchResults } from "./MatchResults";

const result: MatchResultEvent = {
  winnerPlayerId: "you",
  players: [
    {
      playerId: "you", nickname: "Sam", totalPoints: 25_000, exactSolves: 5, totalErrorDays: 0,
      rounds: [1, 2, 3, 4, 5].map((round) => ({ round, points: 5_000, errorDays: 0, solved: true })),
    },
    {
      playerId: "other", nickname: "Avery", totalPoints: 4_488, exactSolves: 0, totalErrorDays: 730_485,
      rounds: [{ round: 1, points: 4_488, errorDays: 1, solved: false },
        ...[2, 3, 4, 5].map((round) => ({ round, points: 0, errorDays: null, solved: false }))],
    },
  ],
  shareText: "Spoiler-free result",
};

describe("final standings", () => {
  it("shows all five rounds and both players’ match totals and solves", () => {
    const html = renderToStaticMarkup(<MatchResults result={result} playerId="you" />);
    expect(html).toContain("Sam (you)");
    expect(html).toContain("Avery");
    for (const round of [1, 2, 3, 4, 5]) expect(html).toContain(`Round ${round}`);
    expect(html).toContain("25,000");
    expect(html).toContain("4,488");
    expect(html).toContain("1 day off");
    expect(html).toContain("No guess");
    expect(html).toContain("Exact solves");
  });
});
