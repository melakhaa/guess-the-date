import { describe, expect, it } from "vitest";
import { events, parseEventCatalog } from "./events.js";

describe("server event catalog", () => {
  it("loads all 55 sourced events", () => {
    expect(events).toHaveLength(55);
    expect(events[0]).toMatchObject({ id: "wright-first-flight", date: "1903-12-17" });
    expect(parseEventCatalog(events)).toEqual(events);
  });

  it.each([
    { date: "1900-02-29" },
    { date: "1599-12-31" },
    { date: "2100-01-01" },
    { date: 19031217 },
    { title: " " },
    { clues: ["Only one clue"] },
    { clues: ["a", "b", "c", "d", " "] },
    { clues: ["a", "b", "c", "d", "e", "f"] },
    { sources: [] },
    { sources: [{ label: "Unsafe", url: "javascript:alert(1)" }] },
    { difficulty: "unknown" },
    { tags: [] },
    { unexpected: true },
  ])("rejects malformed content: %j", (patch) => {
    expect(() => parseEventCatalog([{ ...events[0], ...patch }, ...events.slice(1)])).toThrow();
  });

  it("rejects missing content and catalogs below the launch minimum", () => {
    for (const value of [null, {}, [], events.slice(0, 49), [null, ...events.slice(1)]]) {
      expect(() => parseEventCatalog(value)).toThrow();
    }
  });

  it("rejects duplicate event IDs to prevent repeated match events", () => {
    expect(() => parseEventCatalog([...events, events[0]])).toThrow();
  });
});
