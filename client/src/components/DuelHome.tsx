import { useState, type FormEvent } from "react";
import type { PlayerSession } from "@guess-the-date/shared";
import { enterRoom } from "../lib/rooms";

export function DuelHome({ inviteCode, onEnter }: { inviteCode: string | null; onEnter: (session: PlayerSession) => void }) {
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState(inviteCode ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const actions = code.trim() || inviteCode !== null ? ["join", "create"] : ["create", "join"];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? actions[0];
    setError("");
    setPending(true);
    try {
      onEnter(await enterRoom(nickname, action === "join" ? code.trim() : undefined));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not open the room.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Guess the Date Duel</h1>
      <p className="mt-3 max-w-prose text-sm leading-6">
        Challenge a friend to five rounds of historical mysteries. Follow the clues,
        guess the date, and earn points for accuracy.
      </p>
      <form onSubmit={submit} className="mt-7 max-w-sm" aria-busy={pending}>
        <fieldset disabled={pending} className="space-y-4">
          <div>
            <label htmlFor="nickname" className="text-sm font-medium">Nickname</label>
            <input id="nickname" autoComplete="nickname" required value={nickname} onChange={(event) => setNickname(event.target.value)} className="duel-input" />
          </div>
          <div>
            <label htmlFor="room-code" className="text-sm font-medium">Room code <span className="font-normal text-muted">(to join a friend)</span></label>
            <input id="room-code" autoCapitalize="none" autoComplete="off" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} className="duel-input tracking-wide" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            {actions.map((action, index) => (
              <button key={action} type="submit" value={action} className={index === 0 ? "duel-primary" : "duel-secondary"}>
                {action === "create" ? "Create room" : "Join room"}
              </button>
            ))}
          </div>
        </fieldset>
        {pending && <p role="status" className="mt-3 text-sm text-muted">Opening room…</p>}
        {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
      </form>
    </>
  );
}
