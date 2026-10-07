import { cn } from '../../lib/cn';

export interface RoundProgressBarProps {
  total: number;
  /** Indice del round corrente (1-based). */
  current: number;
  className?: string;
}

/**
 * Barra segmentata a N celle, sostituisce i pallini vittorie/sconfitte
 * separati di GameScreen: la cella del round corrente è piena volt, le
 * precedenti restano piene (storico), le successive vuote.
 */
export function RoundProgressBar({ total, current, className }: RoundProgressBarProps) {
  return (
    <div className={cn('flex gap-1.5', className)} role="progressbar" aria-valuenow={current} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => {
        const index = i + 1;
        const filled = index <= current;
        return (
          <span
            key={index}
            className={cn('h-1.5 flex-1 rounded-np-pill transition-colors duration-300', filled ? 'bg-volt' : 'bg-turf-3')}
          />
        );
      })}
    </div>
  );
}
