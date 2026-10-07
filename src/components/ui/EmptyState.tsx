import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface EmptyStateProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Stato vuoto illustrato: icona + titolo + sottotitolo + CTA opzionale.
 * Usato in: Amici (nessuna ricerca/richiesta), Sfide (nessuna in attesa),
 * Statistiche avanzate (nessun dato), Storico vuoto. L'icona può animare un
 * leggero "bob" verticale (rispetta `prefers-reduced-motion`).
 */
export function EmptyState({ icon, title, subtitle, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-np-lg border border-dashed border-white/12 px-6 py-10 text-center',
        className
      )}
    >
      <div className="motion-safe:animate-bounce flex h-14 w-14 items-center justify-center rounded-full bg-turf-2 text-chalk-2 [animation-duration:2.2s]">
        {icon}
      </div>
      <span className="text-[15px] font-semibold text-chalk">{title}</span>
      {subtitle && <span className="max-w-xs text-sm text-chalk-2">{subtitle}</span>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
