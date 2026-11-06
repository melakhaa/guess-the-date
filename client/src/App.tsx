import { useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { Header } from "./components/Header";
import { HelpDialog } from "./components/HelpDialog";
import { useGame } from "./hooks/useGame";

export default function App() {
  const game = useGame();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="min-h-screen text-ink">
      <Header mode={game.mode} onDaily={game.playDaily} onUnlimited={game.playUnlimited} onHelp={() => setHelpOpen(true)} />

      {game.round && game.event ? (
        <GameScreen
          round={game.round}
          event={game.event}
          countdown={game.countdown}
          onGuess={game.submitGuess}
          onAnother={game.playAnother}
        />
      ) : (
        <main className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="text-xl font-bold">This mystery could not be loaded.</h1>
          <button
            type="button"
            onClick={game.playDaily}
            className="mt-6 h-11 rounded bg-accent px-4 font-semibold text-white hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Play today's mystery
          </button>
        </main>
      )}

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
