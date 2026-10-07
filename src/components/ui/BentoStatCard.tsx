import type { ReactNode } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '../../lib/cn';

/** Card hero win-rate: anello SVG animato (`ring-in`) + percentuale grande. Occupa 2 righe nel bento. */
export function WinRateHeroCard({ percent, matchesLabel, className }: { percent: number; matchesLabel: string; className?: string }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);

  return (
    <div
      className={cn(
        'flex flex-col justify-between overflow-hidden rounded-np-hero bg-volt p-6 text-ink',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="cond text-xs">Win rate</span>
        <span className="mono text-xs font-semibold">{matchesLabel}</span>
      </div>
      <svg width="140" height="140" viewBox="0 0 120 120" className="mx-auto" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(11,12,10,.14)" strokeWidth="12" />
        <circle
          className="ring"
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#0B0C0A"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashoffset }}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="disp flex items-baseline gap-1">
        <span className="text-[64px]">{Math.round(percent)}</span>
        <span className="text-[28px]">%</span>
      </div>
    </div>
  );
}

/** Mini-card statistica semplice: label + numero grande `.disp` (Partite, Media punti, Best score, ...). */
export function StatTile({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col justify-between rounded-np-lg border border-white/7 bg-turf-1 p-5', className)}>
      <span className="cond text-xs text-label">{label}</span>
      <span className="disp text-[48px]">{value}</span>
    </div>
  );
}

/** Card serie attuale: fiamma animata (reduced-motion safe) + sparkline barre ultimi round. */
export function StreakCard({
  streak,
  sparkline,
  className,
}: {
  streak: number;
  /** Valori 0-100 (altezza percentuale delle barre), es. ultimi 5 round. */
  sparkline: number[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-np-lg border border-white/7 bg-turf-1 p-5',
        className
      )}
    >
      <div className="flex flex-col gap-2">
        <span className="cond text-xs text-label">Serie attuale</span>
        <div className="flex items-center gap-2.5">
          <Flame className="flame h-9 w-9 fill-ember text-ember" aria-hidden="true" />
          <span className="disp text-[48px]">{streak}</span>
          <span className="text-sm text-chalk-2">vittorie di fila</span>
        </div>
      </div>
      <div className="flex h-15 items-end gap-1">
        {sparkline.map((v, i) => (
          <span
            key={i}
            className={cn('w-3.5 rounded-sm', i >= sparkline.length - 2 ? 'bg-volt' : 'bg-turf-3')}
            style={{ height: `${Math.max(8, v)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Card tempo medio di risposta: numero mono + unità. */
export function TimeAvgCard({ seconds, className }: { seconds: number; className?: string }) {
  return (
    <div className={cn('flex flex-col justify-between rounded-np-lg border border-white/7 bg-turf-1 p-5', className)}>
      <span className="cond text-xs text-label">Tempo medio</span>
      <div className="flex items-baseline gap-1">
        <span className="mono text-[40px] font-semibold">{seconds.toFixed(1)}</span>
        <span className="mono text-base text-chalk-2">s</span>
      </div>
    </div>
  );
}
