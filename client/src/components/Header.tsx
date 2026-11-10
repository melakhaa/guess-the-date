export function Header({ onHelp }: { onHelp: () => void }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
        <span className="text-sm font-medium">Guess the Date</span>
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
