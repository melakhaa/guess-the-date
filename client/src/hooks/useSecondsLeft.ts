import { useEffect, useState } from "react";

export function useSecondsLeft(deadline: number, clockOffset: number, limitMs: number): number {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, []);

  return Math.ceil(Math.min(limitMs, Math.max(0, deadline - now - clockOffset)) / 1000);
}
