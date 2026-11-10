import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("duel shell", () => {
  it("explains that rooms are unavailable without offering single-player actions", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("Guess the Date Duel");
    expect(html).toContain("Creating and joining rooms is not available yet.");
    expect(html).not.toContain("Game modes");
    expect(html).not.toContain("Play today's mystery");
  });

  it("provides named instructions using the duel feedback thresholds", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('aria-labelledby="help-title"');
    expect(html).toContain("Burning: 1–7 days away");
    expect(html).toContain("60 seconds");
  });
});
