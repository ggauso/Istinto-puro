import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

export interface RadarLoaderProps {
  /** Contenuto al centro del radar, es. iniziali/avatar dell'utente in cerca. */
  center?: ReactNode;
  size?: number;
  className?: string;
}

/**
 * Loader "Radar": sweep conico rotante + ping concentrico + avatar al
 * centro. Usato in: ricerca avversario (Home), attesa accettazione sfida.
 */
export function RadarLoader({ center, size = 180, className }: RadarLoaderProps) {
  return (
    <div className={cn('relative flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <span className="radar-ping absolute rounded-full border border-volt/50" style={{ width: size * 0.5, height: size * 0.5 }} aria-hidden="true" />
      <span
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          background: 'repeating-radial-gradient(circle, rgba(215,255,58,.05) 0 2px, transparent 2px 20px)',
          border: '1px solid rgba(255,255,255,.08)',
        }}
        aria-hidden="true"
      />
      <span
        className="radar-sweep absolute inset-0"
        style={{
          background: 'conic-gradient(from 0deg, rgba(215,255,58,.45), transparent 35%)',
          borderRadius: '50%',
        }}
        aria-hidden="true"
      />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-turf-1 ring-2 ring-volt">
        {center}
      </span>
    </div>
  );
}
