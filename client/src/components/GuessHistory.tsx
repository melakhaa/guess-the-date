import type { OwnGuessFeedback, Temperature } from "@guess-the-date/shared";
import { formatNumericDate } from "../lib/duel-date";

const temperatureLabels: Record<Temperature, string> = {
  correct: "Correct",
  burning: "Burning",
  hot: "Hot",
  warm: "Warm",
  cool: "Cool",
  freezing: "Freezing",
};

const temperatureDots: Record<Temperature, string> = {
  correct: "bg-accent",
  burning: "bg-[#b3261e]",
  hot: "bg-[#d9772b]",
  warm: "bg-[#c9a227]",
  cool: "bg-[#4f8cbf]",
  freezing: "bg-muted",
};

function Feedback({ guess }: { guess: OwnGuessFeedback }) {
  const direction =
    guess.direction === "exact" ? "Exact date" : guess.direction === "later" ? "Later" : "Earlier";

  return (
    <span className="inline-grid grid-cols-[0.5rem_8.5ch_10ch] items-center gap-x-2 text-xs text-muted">
      <span className={`h-2 w-2 rounded-full ${temperatureDots[guess.temperature]}`} aria-hidden="true" />
      <span>{temperatureLabels[guess.temperature]}</span>
      <span>{direction}</span>
    </span>
  );
}

export function GuessHistory({ guesses }: { guesses: OwnGuessFeedback[] }) {
  return (
    <section className="mt-8" aria-labelledby="guess-history-title">
      <h2 id="guess-history-title" className="text-sm font-semibold">
        Guess history
      </h2>
      <div aria-live="polite" aria-relevant="additions">
        <ol className="mt-2 overflow-hidden rounded-md border border-line" hidden={guesses.length === 0}>
          {guesses.map((guess, index) => (
            <li
              key={guess.date}
              className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-muted">{index + 1}</span>
                <span className="text-sm font-semibold tabular-nums">{formatNumericDate(guess.date)}</span>
              </div>
              <Feedback guess={guess} />
            </li>
          ))}
        </ol>
      </div>
      {guesses.length === 0 && <p className="mt-2 text-sm text-muted">Your guesses will appear here.</p>}
    </section>
  );
}
