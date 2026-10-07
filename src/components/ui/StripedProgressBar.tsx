import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface StripedProgressBarProps {
  /** Percentuale di riempimento, 0-100. */
  progress: number;
  title?: ReactNode;
  /** Es. "250" in volt. */
  currentValue?: ReactNode;
  /** Es. "/ 501 pt". */
  totalValue?: ReactNode;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  className?: string;
}

/**
 * Barra di progresso striata animata (classe `.stripe`, night-pitch.css),
 * usata per la progressione tier ("Verso Silver · 250/501 pt").
 */
export function StripedProgressBar({
  progress,
  title,
  currentValue,
  totalValue,
  footerLeft,
  footerRight,
  className,
}: StripedProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn('flex flex-col gap-3 rounded-np-lg bg-turf-2 p-[18px]', className)}>
      {(title || currentValue || totalValue) && (
        <div className="flex items-baseline justify-between">
          {title && <span className="text-[15px] font-semibold">{title}</span>}
          <span className="mono text-[13px] text-chalk-2">
            {currentValue && <span className="font-semibold text-volt">{currentValue}</span>} {totalValue}
          </span>
        </div>
      )}
      <div className="h-3 overflow-hidden rounded-np-pill bg-ink">
        <div
          className="stripe h-full rounded-np-pill bg-volt transition-[width] duration-[600ms] ease-[cubic-bezier(.16,1,.3,1)]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {(footerLeft || footerRight) && (
        <div className="mono flex justify-between text-[11px] text-label">
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </div>
      )}
    </div>
  );
}
