import { useState, useEffect } from 'react';

/** Returns live remaining seconds (can be negative when past 0). null = timer not running. */
export function useTimer(timerStartedAt: string | null, timerDurationSeconds: number): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!timerStartedAt) {
      setRemaining(null);
      return;
    }

    const calc = () => {
      const elapsed = (Date.now() - new Date(timerStartedAt).getTime()) / 1000;
      setRemaining(timerDurationSeconds - elapsed);
    };

    calc();
    const t = setInterval(calc, 500);
    return () => clearInterval(t);
  }, [timerStartedAt, timerDurationSeconds]);

  return remaining;
}

export function formatTimer(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60);
  const sign = seconds < 0 ? '-' : '';
  return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
