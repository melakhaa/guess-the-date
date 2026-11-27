import type { MatchResultEvent } from "@guess-the-date/shared";

export function MatchResults({ result, playerId }: { result: MatchResultEvent; playerId: string }) {
  const { players } = result;

  return (
    <table className="mt-5 w-full table-fixed text-sm">
      <caption className="pb-2 text-left text-sm font-medium text-muted">Match breakdown</caption>
      <thead className="border-b border-line">
        <tr>
          <th scope="col" className="w-24 py-2 text-left">Round</th>
          {players.map((player) => (
            <th key={player.playerId} scope="col" className="wrap-anywhere py-2 pl-2 text-right">
              {player.nickname}{player.playerId === playerId && " (you)"}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {players[0]?.rounds.map(({ round }) => (
          <tr key={round}>
            <th scope="row" className="py-2 text-left font-medium">Round {round}</th>
            {players.map((player) => {
              const score = player.rounds.find((entry) => entry.round === round);
              return (
                <td key={player.playerId} className="py-2 pl-2 text-right tabular-nums">
                  {score?.points.toLocaleString("en-GB") ?? "—"}
                  {score && (
                    <span className="block text-xs text-muted">
                      {score.solved ? "Solved"
                        : score.errorDays === null ? "No guess"
                        : `${score.errorDays.toLocaleString("en-GB")} ${score.errorDays === 1 ? "day" : "days"} off`}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t border-line">
        <tr className="font-semibold">
          <th scope="row" className="py-2 text-left">Match total</th>
          {players.map(({ playerId, totalPoints }) => (
            <td key={playerId} className="py-2 pl-2 text-right tabular-nums">{totalPoints.toLocaleString("en-GB")}</td>
          ))}
        </tr>
        <tr>
          <th scope="row" className="text-left font-medium">Exact solves</th>
          {players.map(({ playerId, exactSolves }) => (
            <td key={playerId} className="pl-2 text-right tabular-nums">{exactSolves}</td>
          ))}
        </tr>
      </tfoot>
    </table>
  );
}
