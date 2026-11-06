import { useRef, useState, type FormEvent, type RefObject } from "react";
import { MAX_GUESSES, parseDateParts, type RoundState } from "../lib/game";

function DateField({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
  inputRef,
  invalid,
}: {
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  invalid: boolean;
}) {
  return (
    <label className="block min-w-0 text-xs font-medium text-muted">
      {label}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={invalid ? "date-error" : undefined}
        className={`mt-1 h-14 w-full min-w-0 rounded-md border bg-white px-1 text-center text-2xl font-semibold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-muted focus:border-ink focus:outline-2 focus:outline-offset-2 focus:outline-ink ${invalid ? "border-error" : "border-field"}`}
      />
    </label>
  );
}

export function DateForm({
  round,
  onGuess,
}: {
  round: RoundState;
  onGuess: (iso: string) => string | null;
}) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState("");
  const dayRef = useRef<HTMLInputElement>(null);
  const guessesLeft = MAX_GUESSES - round.guesses.length;

  const updateNumeric = (setter: (value: string) => void, maxLength: number) => (value: string) => {
    setter(value.replace(/\D/g, "").slice(0, maxLength));
    setError("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDateParts(day, month, year);
    if (!parsed.ok) return setError(parsed.error);

    const submissionError = onGuess(parsed.iso);
    if (submissionError) return setError(submissionError);

    setDay("");
    setMonth("");
    setYear("");
    setError("");
    dayRef.current?.focus();
  };

  return (
    <form onSubmit={submit}>
      <h2 className="text-sm font-semibold">Your next date</h2>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto_1.4fr] items-end gap-2">
        <DateField label="Day" value={day} placeholder="DD" maxLength={2} onChange={updateNumeric(setDay, 2)} inputRef={dayRef} invalid={Boolean(error)} />
        <span className="pb-4 text-xl text-muted" aria-hidden="true">/</span>
        <DateField label="Month" value={month} placeholder="MM" maxLength={2} onChange={updateNumeric(setMonth, 2)} invalid={Boolean(error)} />
        <span className="pb-4 text-xl text-muted" aria-hidden="true">/</span>
        <DateField label="Year" value={year} placeholder="YYYY" maxLength={4} onChange={updateNumeric(setYear, 4)} invalid={Boolean(error)} />
      </div>
      <button
        type="submit"
        className="mt-4 h-12 w-full rounded-md bg-accent text-base font-semibold text-white transition-colors hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Check this date
      </button>
      <div className="mt-2 flex items-start justify-between gap-3 text-xs">
        <p className="text-muted">
          {guessesLeft} {guessesLeft === 1 ? "guess" : "guesses"} left
        </p>
        <p id="date-error" className="text-right font-medium text-error" role="alert">
          {error}
        </p>
      </div>
    </form>
  );
}
