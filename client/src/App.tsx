import { useState } from "react";
import type { PlayerSession } from "@guess-the-date/shared";
import { DuelHome } from "./components/DuelHome";
import { DuelLobby } from "./components/DuelLobby";
import { inviteUrl, readSession, saveSession } from "./lib/rooms";
import { Header } from "./components/Header";
import { HelpDialog } from "./components/HelpDialog";

export default function App() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState(() => typeof window === "undefined"
    ? null : new URLSearchParams(window.location.search).get("code"));
  const [session, setSession] = useState(() => typeof window === "undefined" ? null : readSession(inviteCode));

  function enter(session: PlayerSession) {
    saveSession(session);
    window.history.replaceState(window.history.state, "", inviteUrl(window.location.origin, session.code));
    setSession(session);
  }

  function leave() {
    saveSession(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    window.history.replaceState(window.history.state, "", url);
    setInviteCode(null);
    setSession(null);
  }

  return (
    <div className="min-h-screen text-ink">
      <Header onHelp={() => setHelpOpen(true)} />
      <main className="mx-auto max-w-2xl px-4 py-12">
        {session
          ? <DuelLobby key={session.code} session={session} onLeave={leave} onRematch={enter} />
          : <DuelHome inviteCode={inviteCode} onEnter={enter} />}
      </main>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
