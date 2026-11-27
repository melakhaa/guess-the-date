import { useEffect, useRef, useState } from "react";

export function CopyResult({ text }: { text: string }) {
  const [status, setStatus] = useState<"copied" | "manual" | null>(null);
  const fallback = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status !== "manual") return;
    fallback.current?.focus();
    fallback.current?.select();
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("manual");
      fallback.current?.focus();
      fallback.current?.select();
    }
  }

  return (
    <div className={status === "manual" ? "w-full" : undefined}>
      <button type="button" className="duel-secondary" onClick={copy}>Copy result</button>
      <p role="status" className="text-xs text-muted">
        {status === "copied" ? "Result copied." : status === "manual" ? "Copy the selected result text." : ""}
      </p>
      {status === "manual" && (
        <label className="mt-2 block text-sm font-medium">
          Result text
          <textarea
            ref={fallback}
            readOnly
            rows={3}
            value={text}
            className="mt-1 block w-full rounded-md border border-field px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
        </label>
      )}
    </div>
  );
}
