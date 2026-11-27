import type { OwnRoundState } from "@guess-the-date/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameScreen } from "./GameScreen";

const round: OwnRoundState = {
  round: 2,
  clues: ["First clue", "Your unlocked clue"],
  guesses: [{ date: "1999-03-02", temperature: "hot", direction: "later" }],
  finished: false,
  roundStartedAt: 0,
  roundEndsAt: 60_000,
};

function render(state: OwnRoundState, connected = true) {
  return renderToStaticMarkup(
    <GameScreen
      round={state}
      opponent={{ playerId: "other", nickname: "Avery", connected: true, ready: true, finished: true, totalPoints: 0 }}
      clockOffset={-performance.now()}
      connected={connected}
      onGuess={async () => null}
    />,
  );
}

describe("playing a round", () => {
  it("shows private clues and history with only the opponent’s status", () => {
    const html = render(round);
    expect(html).toContain('aria-label="Time left in round"');
    expect(html).toContain("Your unlocked clue");
    expect(html).toContain("02 / 03 / 1999");
    expect(html).toContain("Hot");
    expect(html).toContain("Later");
    expect(html).toContain("Avery: Finished");
    expect(html).toContain("Check this date");
  });

  it("waits for results after an exact guess instead of offering another guess", () => {
    const html = render({
      ...round,
      finished: true,
      guesses: [{ date: "2000-01-02", temperature: "correct", direction: "exact" }],
    });
    expect(html).toContain("Exact date!");
    expect(html).toContain("Waiting for round results");
    expect(html).not.toContain("Check this date");
  });

  it("disables guessing while disconnected", () => {
    const html = render(round, false);
    expect(html).toContain("Avery: Status unknown");
    expect(html).toContain("<fieldset disabled");
  });
});
