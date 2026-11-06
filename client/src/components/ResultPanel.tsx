import { useState } from "react";
import { MAX_GUESSES, formatLongDate, shareText, type HistoricalEvent, type RoundState } from "../lib/game";

export function ResultPanel({
  round,
  event,
  countdown,
  onAnother,
}: {
  round: RoundState;
  event: HistoricalEvent;
  countdown: string;
  onAnother: () => void;
}) {
  const [shareStatus, setShareStatus] = useState("");
  const won = round.status === "won";

  const share = async () => {
    const text = `${shareText(round)}\n${window.location.origin}`;
    try {
      if (navigator.share) {
        await navigator.share({ text, title: "Guess the Date result" });
        setShareStatus("Result shared.");
      } else {
        await navigator.clipboard.writeText(text);
        setShareStatus("Result copied to your clipboard.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Sharing is unavailable in this browser.");
    }
  };

  return (
    <section aria-live="polite">
      <p className="text-xs font-medium text-muted">
        {won ? `Solved in ${round.guesses.length}/${MAX_GUESSES}` : "Out of guesses"}
      </p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight">{event.title}</h2>
      <p className="mt-1 text-base font-semibold text-accent">{formatLongDate(event.date)}</p>
      <p className="mt-3 text-sm leading-6">{event.explanation}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {event.sources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="text-muted underline underline-offset-4 hover:text-ink"
          >
            {source.label}
          </a>
        ))}
      </div>
      {round.mode === "daily" ? (
        <p className="mt-6 text-xs text-muted">
          Next daily mystery in <span className="font-semibold tabular-nums text-ink">{countdown}</span>
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={share}
          className="h-12 rounded-md bg-accent text-base font-semibold text-white transition-colors hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Share result
        </button>
        {round.mode === "unlimited" ? (
          <button
            type="button"
            onClick={onAnother}
            className="h-12 rounded-md border border-ink text-base font-semibold transition-colors hover:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Play another
          </button>
        ) : null}
      </div>
      <p className="mt-2 min-h-4 text-xs text-muted" role="status">
        {shareStatus}
      </p>
    </section>
  );
}
