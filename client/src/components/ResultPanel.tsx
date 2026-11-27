import { ROUND_RESULTS_DURATION_MS, type RoundResultEvent } from "@guess-the-date/shared";
import { useSecondsLeft } from "../hooks/useSecondsLeft";
import { formatLongDate, formatNumericDate } from "../lib/duel-date";

function NextRoundTimer({ startsAt, clockOffset }: { startsAt: number; clockOffset: number }) {
  const seconds = useSecondsLeft(startsAt, clockOffset, ROUND_RESULTS_DURATION_MS);
  return (
    <p className="mt-1 text-xs font-medium text-muted" role="timer" aria-label="Next round countdown">
      {seconds > 0 ? <>Next round in <strong className="tabular-nums text-ink">{seconds}s</strong></> : "Starting next round…"}
    </p>
  );
}

export function ResultPanel({ result, playerId, clockOffset }: {
  result: RoundResultEvent;
  playerId: string;
  clockOffset: number;
}) {
  const { event, players, nextRoundStartsAt } = result;

  return (
    <>
      {nextRoundStartsAt !== null && <NextRoundTimer startsAt={nextRoundStartsAt} clockOffset={clockOffset} />}
      <section className="mt-5" aria-labelledby="revealed-event">
        <h2 id="revealed-event" className="text-xl font-bold tracking-tight">{event.title}</h2>
        <p className="mt-1 text-base font-semibold text-ink">
          <time dateTime={event.date}>{formatLongDate(event.date)}</time>
        </p>
        <p className="mt-3 text-sm leading-6">{event.explanation}</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {event.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer" className="text-muted underline underline-offset-4 hover:text-ink">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
      <ul className="mt-5 border-b border-line" aria-label="Player results">
        {players.map((player) => (
          <li key={player.playerId} className="border-t border-line py-3">
            <p className="wrap-anywhere text-sm font-semibold">{player.nickname}{player.playerId === playerId && " (you)"}</p>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-muted">Best guess</dt>
                <dd>
                  {player.bestGuess ? (
                    <time className={player.solved ? "font-semibold text-accent" : undefined} dateTime={player.bestGuess}>
                      {formatNumericDate(player.bestGuess)}
                    </time>
                  ) : "No guess"}
                </dd>
              </div>
              <div><dt className="text-muted">Day error</dt><dd>{player.errorDays?.toLocaleString("en-GB") ?? "—"}</dd></div>
              <div><dt className="text-muted">Round points</dt><dd>{player.points.toLocaleString("en-GB")}</dd></div>
              <div><dt className="text-muted">Match total</dt><dd>{player.totalPoints.toLocaleString("en-GB")}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
