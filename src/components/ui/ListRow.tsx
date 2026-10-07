import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface ListRowProps {
  /** Avatar/icona a sinistra — tipicamente un <RowAvatar> o un'immagine. */
  leading: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Valore/risultato/azione a destra (es. punteggio, bottone Sfida, chevron). */
  trailing?: ReactNode;
  /** Riga evidenziata con glow volt (es. la posizione dell'utente in classifica). */
  highlighted?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Riga lista generica del design system: storico match, amici, classifica.
 * Hover via classe globale `.row-hover` (night-pitch.css).
 */
export function ListRow({ leading, title, subtitle, trailing, highlighted, onClick, className }: ListRowProps) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={cn(
        'row-hover flex w-full items-center gap-3.5 rounded-np-lg bg-turf-1 py-3 pl-3 pr-4 text-left',
        highlighted && 'shadow-np-e2-volt bg-turf-2',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="shrink-0">{leading}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{title}</span>
        {subtitle && <span className="mono truncate text-xs text-label">{subtitle}</span>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </Tag>
  );
}

export interface RowAvatarProps {
  /** Iniziale/i mostrate al centro (es. "V"/"A", o le iniziali di un nickname). */
  children: ReactNode;
  /** `square` (storico match, radius-md) o `circle` (persone). */
  shape?: 'square' | 'circle';
  tone?: 'volt' | 'neutral' | 'ember';
  size?: number;
}

/** Avatar a iniziali per `ListRow`, colorato per "chi ha fatto cosa" (volt = tu, ember = avversario/neutro). */
export function RowAvatar({ children, shape = 'square', tone = 'neutral', size = 48 }: RowAvatarProps) {
  const toneClasses = {
    volt: 'bg-volt text-ink',
    neutral: 'bg-turf-3 text-chalk-2',
    ember: 'bg-ember/20 text-ember-light',
  }[tone];

  return (
    <span
      className={cn(
        'disp flex items-center justify-center font-bold',
        shape === 'square' ? 'rounded-np-md' : 'rounded-full',
        toneClasses
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {children}
    </span>
  );
}
