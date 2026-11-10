import { z } from "zod";
import { parseIsoDate } from "../game/dates.js";
import catalog from "./events.json" with { type: "json" };

const text = z.string().trim().min(1);
const eventSchema = z.strictObject({
  id: text,
  title: text,
  date: z.string().refine((date) => parseIsoDate(date) !== null, "Invalid event date"),
  clues: z.array(text).length(5),
  explanation: text,
  sources: z.array(z.strictObject({
    label: text,
    url: z.url({ protocol: /^https?$/ }),
  })).min(1),
  tags: z.array(text).min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export type HistoricalEvent = z.infer<typeof eventSchema>;

const catalogSchema = z.array(eventSchema).min(50).refine(
  (events) => new Set(events.map((event) => event.id)).size === events.length,
  "Event IDs must be unique",
);

export function parseEventCatalog(value: unknown): HistoricalEvent[] {
  return catalogSchema.parse(value);
}

// Validate once at module load so malformed content prevents server startup.
export const events = parseEventCatalog(catalog);
