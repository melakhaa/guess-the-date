import { ROOM_CAPACITY, ROUND_COUNTDOWN_MS, type PlayerSession } from "@guess-the-date/shared";
import { useEffect, useRef, useState } from "react";
import { useLobby } from "../hooks/useLobby";
import { useSecondsLeft } from "../hooks/useSecondsLeft";
import { inviteUrl } from "../lib/rooms";
import { GameScreen } from "./GameScreen";

function Countdown({ startsAt, clockOffset }: { startsAt: number; clockOffset: number }) {
  const seconds = useSecondsLeft(startsAt, clockOffset, ROUND_COUNTDOWN_MS);

  return (
    <div className="mt-2 flex items-baseline gap-3" role="timer" aria-label="Match countdown">
      {seconds > 0 ? <><span className="text-sm">Match starts in</span><strong className="text-2xl tabular-nums">{seconds}</strong></> : <strong className="text-sm">Starting…</strong>}
    </div>
  );
}

export function DuelLobby({ session, onLeave }: { session: PlayerSession; onLeave: () => void }) {
  const { room, ownRound, clockOffset, connection, readyPending, error, setReady, submitGuess, reconnect } = useLobby(session);
  const heading = useRef<HTMLHeadingElement>(null);
  const inviteInput = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const invite = inviteUrl(window.location.origin, session.code);
  const you = room?.players.find((player) => player.playerId === session.playerId);
  const opponent = room?.players.find((player) => player.playerId !== session.playerId);
  const inLobby = room?.phase === "waiting" || room?.phase === "countdown";
  const showLobby = !room || inLobby || room.phase === "cancelled";
  const game = room?.phase === "playing" && ownRound?.round === room.round ? ownRound : null;
  const title = game ? `Round ${game.round} of ${room?.roundsTotal}` : showLobby ? "Duel lobby" : "Match progress";
  const connected = connection === "connected";
  const startsAt = connected ? room?.countdownStartsAt : null;

  useEffect(() => { heading.current?.focus(); }, [title]);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite);
      setCopyStatus("Invite link copied.");
    } catch {
      inviteInput.current?.focus();
      inviteInput.current?.select();
      setCopyStatus("Copy the selected link to share it.");
    }
  }

  const status = connection === "unavailable" ? "This room is no longer available. Return home to create or join a room."
    : connection === "disconnected" ? "Disconnected from the room."
    : connection === "reconnecting" ? "Room connection unavailable. Trying again…"
    : !connected || !room ? "Connecting to the room…"
    : startsAt != null ? "Match countdown started."
    : room.phase === "cancelled" ? "This match was cancelled."
    : room.phase === "matchResults" ? "Match complete."
    : room.phase === "roundResults" ? "Round complete. Waiting for the next round…"
    : room.phase === "playing" ? (game ? null : "Preparing the round…")
    : room.players.length < ROOM_CAPACITY ? "Waiting for a friend to join."
    : room.players.some((player) => !player.connected) ? "Waiting for your friend to reconnect."
    : "The match starts when both players are ready.";

  return (
    <>
      <h1 tabIndex={-1} ref={heading} className="text-2xl font-bold tracking-tight focus:outline-none">{title}</h1>
      {showLobby && (
        <>
          <div className="mt-5 max-w-sm">
            <p className="text-xs font-medium text-muted">Room code</p>
            <p className="mt-1 break-all text-xl font-bold tracking-wider">{session.code}</p>
            <label htmlFor="invite-link" className="mt-4 block text-sm font-medium">Invite link</label>
            <div className="flex items-end gap-2">
              <input id="invite-link" ref={inviteInput} className="duel-input min-w-0" value={invite} readOnly />
              <button type="button" className="duel-secondary shrink-0" onClick={copyInvite}>Copy invite</button>
            </div>
            <p role="status" className="mt-1 text-xs text-muted">{copyStatus}</p>
          </div>
          <h2 className="mt-7 text-sm font-bold">Players</h2>
          <ol className="mt-2 max-w-sm border-b border-line">
            {Array.from({ length: ROOM_CAPACITY }, (_, index) => {
              const player = room?.players[index];
              const isYou = player?.playerId === session.playerId;
              const presence = !player ? "Open slot"
                : (!player.connected || (!connected && isYou)) ? "Disconnected"
                : !connected ? "Status unknown"
                : !inLobby ? "Connected"
                : player.ready ? "Ready" : "Not ready";
              return (
                <li key={index} className="flex items-start justify-between gap-4 border-t border-line py-3 text-sm">
                  <span className="min-w-0 wrap-anywhere font-medium">{player?.nickname ?? `Player ${index + 1}`}{isYou && " (you)"}</span>
                  <span className="shrink-0 text-muted">{presence}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {status && <p role="status" className="mt-4 text-sm text-muted">{status}</p>}
      {game && <GameScreen key={game.round} round={game} opponent={opponent} clockOffset={clockOffset} connected={connected} onGuess={submitGuess} />}
      {startsAt != null && <Countdown key={startsAt} startsAt={startsAt} clockOffset={clockOffset} />}
      {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        {inLobby && you && connection !== "disconnected" && connection !== "unavailable" && (
          <button type="button" className="duel-primary" disabled={!connected || readyPending} onClick={() => void setReady(!you.ready)}>
            {you.ready ? "Cancel ready" : "I'm ready"}
          </button>
        )}
        {connection === "disconnected" && <button type="button" className="duel-primary" onClick={reconnect}>Reconnect</button>}
        <button type="button" className="duel-secondary" onClick={onLeave}>Back to home</button>
      </div>
    </>
  );
}
