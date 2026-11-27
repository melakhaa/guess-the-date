import { MAX_GUESSES, ROUND_DURATION_MS, type OwnRoundState, type PublicPlayerState } from "@guess-the-date/shared";
import { useSecondsLeft } from "../hooks/useSecondsLeft";
import { DateForm } from "./DateForm";
import { GuessHistory } from "./GuessHistory";

export function GameScreen({
  round,
  opponent,
  clockOffset,
  connected,
  onGuess,
}: {
  round: OwnRoundState;
  opponent?: PublicPlayerState;
  clockOffset: number;
  connected: boolean;
  onGuess: (iso: string) => Promise<string | null>;
}) {
  const seconds = useSecondsLeft(round.roundEndsAt, clockOffset, ROUND_DURATION_MS);

  return (
    <>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 text-xs font-medium text-muted">
        <p role="timer" aria-label="Time left in round">
          <span className="font-semibold tabular-nums text-ink">{seconds}s</span> left
        </p>
        {opponent && (
          <p role="status" className="min-w-0 wrap-anywhere">
            {opponent.nickname}: {!connected ? "Status unknown" : !opponent.connected ? "Disconnected" : opponent.finished ? "Finished" : "Guessing"}
          </p>
        )}
      </div>

      <ol className="mt-5 space-y-2" aria-label="Clues" aria-live="polite">
        {round.clues.map((clue, index) => {
          const latest = index === round.clues.length - 1;
          return (
            <li
              key={index}
              className={latest ? "border-l-2 border-ink py-1 pl-3 text-base font-medium leading-7"
                : "border-l-2 border-line py-1 pl-3 text-sm leading-6 text-muted"}
            >
              <span className="mr-2 text-xs font-medium text-muted">Clue {index + 1}</span>
              {clue}
            </li>
          );
        })}
      </ol>

      <div className="mt-6">
        {round.finished || seconds === 0 ? (
          <p role="status" className="text-sm font-medium">
            {round.guesses.at(-1)?.direction === "exact" ? "Exact date!" : round.finished ? "No guesses left." : "Time’s up."}
            {" Waiting for round results…"}
          </p>
        ) : (
          <DateForm guessesLeft={MAX_GUESSES - round.guesses.length} disabled={!connected} onGuess={onGuess} />
        )}
      </div>

      <GuessHistory guesses={round.guesses} />
    </>
  );
}
