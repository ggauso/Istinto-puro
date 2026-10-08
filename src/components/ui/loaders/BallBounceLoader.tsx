import { cn } from '../../../lib/cn';

export interface BallBounceLoaderProps {
  label?: string;
  size?: number;
  className?: string;
}

/**
 * Loader "Palleggio": pallone da calcio (pentagono disegnato, non un cerchio
 * pieno) che rimbalza con squash/stretch e ruota, ombra che si allarga e si
 * scurisce al contatto — replica esatta di `loader-microinterazioni.html`.
 * Sostituisce gli spinner generici (`Loader2`/`animate-spin`) per attese
 * brevi in tutta l'app.
 */
export function BallBounceLoader({ label, size = 48, className }: BallBounceLoaderProps) {
  const bounceHeight = size * 1.46;

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="flex flex-col items-center justify-end" style={{ height: bounceHeight + size * 0.3 }}>
        <span className="ball-bounce" style={{ ['--bounce-h' as string]: `${bounceHeight}px` }}>
          <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="ball-spin block">
            <circle cx="24" cy="24" r="22" fill="#F3F5EE" />
            <path d="M24 15l7 5-2.7 8h-8.6L17 20z" fill="#0B0C0A" />
            <path d="M24 2v6M44 18l-6 2M38 41l-4-5M10 41l4-5M4 18l6 2" stroke="#0B0C0A" strokeWidth={2} />
            <circle cx="24" cy="24" r="22" fill="none" stroke="#0B0C0A" strokeWidth={1.5} />
          </svg>
        </span>
        {/*
          Ombra schiarita verso turf-3 invece del nero puro del mockup: lì la
          card di sfondo è #141613 (più chiara dell'ink #0B0C0A su cui questo
          loader vive in quasi tutti i punti reali dell'app), un'ombra nera
          piatta sarebbe stata invisibile — stessa ragione per cui era
          percepita come "generica" prima di questa correzione.
        */}
        <span
          className="ball-shadow mt-1.5 rounded-full bg-turf-3"
          style={{ width: size * 0.92, height: size * 0.17 }}
          aria-hidden="true"
        />
      </div>
      {label && <span className="cond text-xs text-label">{label}</span>}
    </div>
  );
}
