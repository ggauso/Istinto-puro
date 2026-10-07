import { cn } from '../../../lib/cn';

export interface PenaltyLoaderProps {
  label?: string;
  className?: string;
}

/**
 * Micro-interazione "Rigore": pallino che vola verso la rete + testo pop-in.
 * Da rimontare (cambiare `key` nel genitore) per far ripartire l'animazione
 * ad ogni invio risposta / avvio partita.
 */
export function PenaltyLoader({ label = 'Gol!', className }: PenaltyLoaderProps) {
  return (
    <div className={cn('relative flex h-20 w-24 items-center justify-center', className)} aria-hidden="true">
      <span className="penalty-fly absolute h-4 w-4 rounded-full bg-chalk" style={{ ['--fly-x' as string]: '48px', ['--fly-y' as string]: '-36px' }} />
      <span className="drop disp absolute bottom-0 text-lg text-volt" style={{ animationDelay: '350ms' }}>
        {label}
      </span>
    </div>
  );
}
