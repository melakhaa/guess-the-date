import type { GameMode } from "../lib/game";

const tabClass = (active: boolean) =>
  `border-b-2 px-2 py-2 text-sm font-medium transition-colors ${
    active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
  }`;

export function Header({
  mode,
  onDaily,
  onUnlimited,
  onHelp,
}: {
  mode: GameMode;
  onDaily: () => void;
  onUnlimited: () => void;
  onHelp: () => void;
}) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
        <nav aria-label="Game modes" className="flex gap-2">
          <button type="button" onClick={onDaily} aria-pressed={mode === "daily"} className={tabClass(mode === "daily")}>
            Daily
          </button>
          <button type="button" onClick={onUnlimited} aria-pressed={mode === "unlimited"} className={tabClass(mode === "unlimited")}>
            Unlimited
          </button>
        </nav>

        <button
          type="button"
          onClick={onHelp}
          className="rounded px-2 py-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          How to play
        </button>
      </div>
    </header>
  );
}
