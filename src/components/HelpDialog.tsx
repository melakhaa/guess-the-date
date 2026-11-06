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
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(92vw,420px)] rounded-md border border-line p-0 text-ink backdrop:bg-black/40"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold tracking-tight">How to play</h2>
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
          Each round names a real historical event. Guess the exact day it happened in six tries. Wrong guesses reveal
          extra clues and tell you how close you are.
        </p>
        <ul className="mt-3 space-y-1 text-sm leading-6">
          <li>Burning: within 14 days</li>
          <li>Hot: within 60 days</li>
          <li>Warm: within 2 years</li>
          <li>Cool: within 10 years</li>
          <li>Freezing: more than 10 years away</li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-muted">
          The direction tells you whether the real date is earlier or later. Invalid and repeated dates do not use a
          guess.
        </p>
      </div>
    </dialog>
  );
}
