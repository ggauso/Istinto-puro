import { cn } from '../../../lib/cn';

export interface ScoreboardLoaderProps {
  /** Valore finale da mostrare (es. punteggio round). */
  value: number;
  className?: string;
}

/**
 * Loader "Tabellone": ogni cifra "flappa" (stile tabellone aeroporto) prima
 * di assestarsi sul valore finale, con un leggero sfalsamento per cifra.
 * Usato per il calcolo punteggio a fine round.
 */
export function ScoreboardLoader({ value, className }: ScoreboardLoaderProps) {
  const digits = String(Math.max(0, Math.round(value))).split('');

  return (
    <div className={cn('mono flex gap-1.5', className)} aria-label={`Punteggio ${value}`}>
      {digits.map((digit, i) => (
        <span
          key={i}
          className="flap flex h-14 w-10 items-center justify-center rounded-np-sm bg-turf-2 text-3xl font-bold text-volt"
          style={{ animationDelay: `${i * 90}ms`, perspective: '200px' }}
        >
          {digit}
        </span>
      ))}
    </div>
  );
}
