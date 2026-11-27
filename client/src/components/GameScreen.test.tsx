import type { OwnRoundState } from "@guess-the-date/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameScreen } from "./GameScreen";

const round: OwnRoundState = {
  round: 2,
  clues: ["First clue", "Your unlocked clue"],
  guesses: [],
  finished: false,
  roundStartedAt: 0,
  roundEndsAt: 60_000,
};

function render(connected: boolean) {
  return renderToStaticMarkup(
    <GameScreen
      round={round}
      opponent={{ playerId: "other", nickname: "Avery", connected: true, ready: true, finished: true, totalPoints: 0 }}
      clockOffset={-performance.now()}
      connected={connected}
    />,
  );
}

describe("playing a round", () => {
  it("shows the current clues, server timer, and opponent status", () => {
    const html = render(true);
    expect(html).toContain('aria-label="Time left in round"');
    expect(html).toContain("Your unlocked clue");
    expect(html).toContain("Avery: Finished");
    expect(render(false)).toContain("Avery: Status unknown");
  });
});
