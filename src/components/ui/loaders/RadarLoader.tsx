import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

export interface RadarLoaderProps {
  /** Contenuto al centro del radar, es. iniziali/avatar dell'utente in cerca. */
  center?: ReactNode;
  size?: number;
  className?: string;
}

/**
 * Loader "Radar": sweep conico rotante, doppio anello sonar + 2 "contatti"
 * (blip ember) che appaiono/svaniscono a posizione fissa, avatar al centro.
 * Proporzioni derivate dalla spec reale 260px di `home-ricerca-avversario.html`
 * (non dalla card dimostrativa 170px di `loader-microinterazioni.html`, che
 * usa valori leggermente diversi per lo stesso componente). Usato in: ricerca
 * avversario (Home), attesa accettazione sfida.
 */
export function RadarLoader({ center, size = 260, className }: RadarLoaderProps) {
  const ringInset = size * 0.3077; // inset:80px @ 260px
  const pingInset = size * 0.3846; // inset:100px @ 260px
  const centerSize = size * 0.1846; // 48px @ 260px, sempre centrato
  const centerOffset = (size - centerSize) / 2;
  const blip1Size = size * 0.0462; // 12px @ 260px
  const blip2Size = size * 0.0385; // 10px @ 260px

  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-full border-[1.5px] border-white/[.12]', className)}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-y-0 left-1/2 w-[1.5px] bg-white/10" aria-hidden="true" />
      <span
        className="absolute rounded-full border-[1.5px] border-white/10"
        style={{ inset: ringInset }}
        aria-hidden="true"
      />
      <span
        className="radar-sweep absolute inset-0 rounded-full"
        style={{ background: 'conic-gradient(from 0deg, rgba(215,255,58,.4), rgba(215,255,58,0) 70deg)' }}
        aria-hidden="true"
      />
      <span className="radar-ping absolute rounded-full border-2 border-volt" style={{ inset: pingInset }} aria-hidden="true" />
      <span className="radar-ping radar-ping2 absolute rounded-full border-2 border-volt" style={{ inset: pingInset }} aria-hidden="true" />
      <span
        className="radar-blip absolute rounded-full bg-ember"
        style={{ left: size * 0.6846, top: size * 0.2154, width: blip1Size, height: blip1Size, boxShadow: '0 0 12px var(--color-ember)' }}
        aria-hidden="true"
      />
      <span
        className="radar-blip radar-blip2 absolute rounded-full bg-ember"
        style={{ left: size * 0.2231, top: size * 0.6462, width: blip2Size, height: blip2Size, boxShadow: '0 0 12px var(--color-ember)' }}
        aria-hidden="true"
      />
      <span
        className="absolute flex items-center justify-center rounded-full bg-volt text-ink shadow-[0_0_0_5px_var(--color-turf-1)]"
        style={{ left: centerOffset, top: centerOffset, width: centerSize, height: centerSize }}
      >
        {center}
      </span>
    </div>
  );
}
