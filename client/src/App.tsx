import { useState } from "react";
import { Header } from "./components/Header";
import { HelpDialog } from "./components/HelpDialog";

export default function App() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="min-h-screen text-ink">
      <Header onHelp={() => setHelpOpen(true)} />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Guess the Date Duel</h1>
        <p className="mt-4 max-w-prose text-sm leading-6">
          Challenge a friend to five rounds of historical mysteries. Follow the clues,
          guess the date, and earn points for accuracy.
        </p>
        <p className="mt-6 text-sm font-medium">Multiplayer is in development.</p>
        <p className="mt-2 max-w-prose text-sm leading-6 text-muted">
          Creating and joining rooms is not available yet. Daily and unlimited puzzles
          have been retired while we prepare the two-player game.
        </p>
      </main>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
