import { MAX_GUESSES, visibleClueCount, type HistoricalEvent, type RoundState } from "../lib/game";
import { DateForm } from "./DateForm";
import { GuessHistory } from "./GuessHistory";
import { ResultPanel } from "./ResultPanel";

export function GameScreen({
  round,
  event,
  countdown,
  onGuess,
  onAnother,
}: {
  round: RoundState;
  event: HistoricalEvent;
  countdown: string;
  onGuess: (iso: string) => string | null;
  onAnother: () => void;
}) {
  const cluesShown = visibleClueCount(round);

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-6">
      <p className="text-xs font-medium text-muted">
        {round.mode === "daily" ? `Daily mystery · Puzzle ${round.puzzleId}` : "Unlimited mystery"} · Guess the exact
        date
      </p>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">{event.title}</h1>

      <ol className="mt-4 space-y-2" aria-label="Clues" aria-live="polite">
        {event.clues.slice(0, cluesShown).map((clue, index) => {
          const latest = index === cluesShown - 1;
          return (
            <li
              key={clue}
              className={
                latest
                  ? "border-l-2 border-accent py-1 pl-3 text-base font-medium leading-7"
                  : "border-l-2 border-line py-1 pl-3 text-sm leading-6 text-muted"
              }
            >
              <span className="mr-2 text-xs font-medium text-muted">Clue {index + 1}</span>
              {clue}
            </li>
          );
        })}
      </ol>

      <div className="mt-8">
        {round.status === "playing" ? (
          <DateForm key={round.eventId} round={round} onGuess={onGuess} />
        ) : (
          <ResultPanel round={round} event={event} countdown={countdown} onAnother={onAnother} />
        )}
      </div>

      <GuessHistory guesses={round.guesses} />
    </main>
  );
}
