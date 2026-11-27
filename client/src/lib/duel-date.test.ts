import { describe, expect, it } from "vitest";
import { parseDateParts } from "./duel-date";

describe("duel date input", () => {
  it.each([
    ["29", "2", "1600", "1600-02-29"],
    ["31", "12", "2099", "2099-12-31"],
  ])("accepts and pads %s/%s/%s", (day, month, year, iso) => {
    expect(parseDateParts(day, month, year)).toEqual({ ok: true, iso });
  });

  it.each([
    ["", "2", "2000"], ["x", "2", "2000"], ["29", "2", "1900"], ["31", "4", "2020"],
    ["1", "1", "1599"], ["1", "1", "2100"],
  ])("rejects %s/%s/%s", (day, month, year) => {
    expect(parseDateParts(day, month, year)).toMatchObject({ ok: false });
  });
});
