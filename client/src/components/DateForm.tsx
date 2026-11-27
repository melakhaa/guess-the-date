import { useRef, useState, type FormEvent, type RefObject } from "react";
import { parseDateParts } from "../lib/duel-date";

function DateField({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
  inputRef,
  invalid,
  readOnly,
}: {
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  invalid: boolean;
  readOnly: boolean;
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
        readOnly={readOnly}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={invalid ? "date-error" : undefined}
        className={`mt-1 h-14 w-full min-w-0 rounded-md border bg-white px-1 text-center text-2xl! font-semibold! tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-muted focus:border-ink focus:outline-2 focus:outline-offset-2 focus:outline-ink ${invalid ? "border-error" : "border-field"}`}
      />
    </label>
  );
}

export function DateForm({
  guessesLeft,
  disabled,
  onGuess,
}: {
  guessesLeft: number;
  disabled: boolean;
  onGuess: (iso: string) => Promise<string | null>;
}) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; invalid?: boolean } | null>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const invalid = error?.invalid ?? false;

  const updateNumeric = (setter: (value: string) => void, maxLength: number) => (value: string) => {
    setter(value.replace(/\D/g, "").slice(0, maxLength));
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || pending) return;
    const parsed = parseDateParts(day, month, year);
    if (!parsed.ok) return setError({ message: parsed.error, invalid: true });

    setError(null);
    setPending(true);
    try {
      const submissionError = await onGuess(parsed.iso);
      if (submissionError) return setError({ message: submissionError });

      setDay("");
      setMonth("");
      setYear("");
      dayRef.current?.focus();
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} aria-busy={pending}>
      <h2 className="text-sm font-semibold">Your next date</h2>
      <fieldset disabled={disabled}>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto_1.4fr] items-end gap-2">
          <DateField label="Day" value={day} placeholder="DD" maxLength={2} onChange={updateNumeric(setDay, 2)} inputRef={dayRef} invalid={invalid} readOnly={pending} />
          <span className="pb-4 text-xl text-muted" aria-hidden="true">/</span>
          <DateField label="Month" value={month} placeholder="MM" maxLength={2} onChange={updateNumeric(setMonth, 2)} invalid={invalid} readOnly={pending} />
          <span className="pb-4 text-xl text-muted" aria-hidden="true">/</span>
          <DateField label="Year" value={year} placeholder="YYYY" maxLength={4} onChange={updateNumeric(setYear, 4)} invalid={invalid} readOnly={pending} />
        </div>
        <button type="submit" disabled={pending} className="duel-primary mt-4 h-12 w-full">
          {pending ? "Checking…" : "Check this date"}
        </button>
      </fieldset>
      <div className="mt-2 flex items-start justify-between gap-3 text-xs">
        <p className="text-muted">
          {guessesLeft} {guessesLeft === 1 ? "guess" : "guesses"} left
        </p>
        <p id="date-error" className="text-right font-medium text-error" role="alert">
          {error?.message}
        </p>
      </div>
    </form>
  );
}
