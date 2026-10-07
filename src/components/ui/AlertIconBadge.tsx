import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface AlertIconBadgeProps {
  icon: ReactNode;
  /** `ember` = quadrato 18px radius, tinta ember (distruttivo/errore); `gold` = cerchio gradiente oro, con flip 3D (`.coin`) — solo informativo, nessun colore d'allarme. */
  tone?: 'ember' | 'gold';
  /** Wobble (rotazione a scatti) per l'icona distruttiva — non per l'errore di rete, che resta statica. */
  wobble?: boolean;
}

/** Badge icona 56×56 in testa agli `AlertDialog`. */
export function AlertIconBadge({ icon, tone = 'ember', wobble }: AlertIconBadgeProps) {
  if (tone === 'gold') {
    return (
      <span
        className="coin flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: 'linear-gradient(135deg,#FFE08A,#C4901C)' }}
      >
        {icon}
      </span>
    );
  }

  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-ember/[.14] text-ember">
      <span className={cn('flex', wobble && 'wobble')}>{icon}</span>
    </span>
  );
}
