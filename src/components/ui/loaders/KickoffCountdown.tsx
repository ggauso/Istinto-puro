import { useEffect, useState } from 'react';
import { cn } from '../../../lib/cn';

export interface KickoffCountdownProps {
  /** Secondi di countdown, es. 3 → mostra 3, 2, 1. */
  seconds?: number;
  onComplete?: () => void;
  className?: string;
}

/**
 * Loader "Fischio d'inizio": countdown circolare 3-2-1 con ring che si
 * scarica (Clock, 1s/step lineare) e colore che passa da volt a ember
 * sull'ultimo secondo. Pre-round, opzionale (vedi restyle.md 10.5 — punto
 * aperto: introdurlo o no è una decisione prodotto, non solo di stile).
 */
export function KickoffCountdown({ seconds = 3, onComplete, className }: KickoffCountdownProps) {
  const [current, setCurrent] = useState(seconds);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (current <= 0) {
      onComplete?.();
      return;
    }
    const timeout = setTimeout(() => setCurrent((c) => c - 1), 1000);
    return () => clearTimeout(timeout);
  }, [current, onComplete]);

  const isLast = current <= 1;

  return (
    <div className={cn('relative flex h-28 w-28 items-center justify-center', className)}>
      <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="var(--color-turf-3)" strokeWidth="6" />
        <circle
          key={current}
          className="kickoff-ring"
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke={isLast ? 'var(--color-ember)' : 'var(--color-volt)'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ ['--ring-circumference' as string]: circumference }}
        />
      </svg>
      <span className={cn('disp absolute text-5xl', isLast ? 'text-ember' : 'text-chalk')}>{Math.max(current, 0)}</span>
    </div>
  );
}
