import { useEffect, useRef } from "react";

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="help-title"
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(92vw,420px)] rounded-md border border-line p-0 text-ink backdrop:bg-black/40"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 id="help-title" className="text-lg font-bold tracking-tight">How to play</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close instructions"
            className="-mt-1 rounded px-2 text-xl leading-8 text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-sm leading-6">
          Play five rounds against a friend. Each round gives you 60 seconds and up to six guesses
          to find a historical event's date. Wrong guesses unlock clues, up to five in total.
          The most accurate guesses earn the most points; exact solves earn a bonus.
        </p>
        <ul className="mt-3 space-y-1 text-sm leading-6">
          <li>Burning: 1–7 days away</li>
          <li>Hot: 8–30 days away</li>
          <li>Warm: 31–365 days away</li>
          <li>Cool: 366–1,825 days away</li>
          <li>Freezing: 1,826 or more days away</li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-muted">
          The direction tells you whether the real date is earlier or later. Invalid and repeated dates do not use a
          guess.
        </p>
      </div>
    </dialog>
  );
}
