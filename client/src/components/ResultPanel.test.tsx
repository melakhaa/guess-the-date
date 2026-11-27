import type { RoundResultEvent } from "@guess-the-date/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResultPanel } from "./ResultPanel";

const result: RoundResultEvent = {
  round: 2,
  event: {
    id: "test-event", title: "Test milestone", date: "1999-12-31", explanation: "An explanation of the milestone.",
    sources: [{ label: "Historical record", url: "https://example.com/record" }],
  },
  players: [
    { playerId: "you", nickname: "Sam", bestGuess: "1999-12-31", errorDays: 0, points: 4_500, totalPoints: 9_500, solved: true },
    { playerId: "other", nickname: "Avery", bestGuess: null, errorDays: null, points: 0, totalPoints: 20, solved: false },
  ],
  nextRoundStartsAt: 8_000,
};

describe("round results", () => {
  it("reveals the answer and both players' results with a countdown", () => {
    const html = renderToStaticMarkup(<ResultPanel result={result} playerId="you" clockOffset={-performance.now()} />);
    expect(html).toContain("Test milestone");
    expect(html).toContain('<time dateTime="1999-12-31">31 December 1999</time>');
    expect(html).toContain('href="https://example.com/record"');
    expect(html).toContain("An explanation of the milestone.");
    expect(html).toContain("Sam (you)");
    expect(html).toContain("Avery");
    expect(html).toContain("No guess");
    expect(html).toContain("4,500");
    expect(html).toContain("9,500");
    expect(html).toContain('aria-label="Next round countdown"');
  });

  it("does not show a next-round countdown for the last reveal", () => {
    const html = renderToStaticMarkup(<ResultPanel result={{ ...result, nextRoundStartsAt: null }} playerId="you" clockOffset={0} />);
    expect(html).not.toContain("Next round countdown");
  });
});
