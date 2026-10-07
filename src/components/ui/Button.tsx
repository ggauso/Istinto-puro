import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant =
  | 'volt'
  | 'ghost'
  | 'destructive'
  | 'chalk'
  | 'text-ember'
  | 'text-neutral'
  | 'icon-volt'
  | 'icon-neutral'
  | 'icon-ember';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Ignorata per le varianti `icon-*`, che sono sempre quadrate 48×48. */
  size?: ButtonSize;
  /** Mostra una freccia (lucide `ArrowRight` o icona passata) che scivola a destra al hover — pattern `.arr` del design system. */
  withArrow?: ReactNode;
  loading?: boolean;
}

type PillVariant = 'volt' | 'ghost' | 'destructive' | 'chalk' | 'text-ember' | 'text-neutral';

const PILL_VARIANT_CLASSES: Record<PillVariant, string> = {
  volt: 'btn-volt bg-volt text-ink hover:bg-volt active:bg-volt-pressed',
  ghost: 'btn-ghost bg-turf-2 text-chalk border border-white/12',
  destructive: 'bg-ember/14 text-ember-light',
  // "Azione neutra forte": bottone primario quando il contesto non è un
  // successo (es. "Riprova ora" dopo un errore di rete, "Ho capito" di un
  // alert puramente informativo) — vedi Dialogs.dc.html, regola colore:
  // volt è riservato a successo/azione-di-gioco.
  chalk: 'bg-chalk text-ink',
  // Bottone distruttivo "testuale": nessun bg/bordo, solo testo ember — più
  // minimale della variante `destructive` (che ha lo sfondo ember/14),
  // usato quando l'azione distruttiva è la seconda opzione di un Alert.
  'text-ember': 'bg-transparent text-ember-light',
  'text-neutral': 'bg-transparent text-chalk-2',
};

const ICON_VARIANT_CLASSES: Record<'icon-volt' | 'icon-neutral' | 'icon-ember', string> = {
  'icon-volt': 'bg-volt text-ink',
  'icon-neutral': 'bg-turf-3 text-chalk',
  'icon-ember': 'bg-transparent text-ember-light',
};

const PILL_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-[44px] px-[20px] text-sm gap-2',
  md: 'h-[52px] px-[26px] text-base gap-2.5',
};

/**
 * Bottone del design system Night Pitch: pill volt/ghost/destructive oppure
 * quadrato icon-only 48×48. Stato press = scale(.95) via classe globale
 * `.btn` (night-pitch.css); hover/press si azzerano automaticamente sotto
 * `prefers-reduced-motion`.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'volt', size = 'md', withArrow, loading, disabled, className, children, ...props },
  ref
) {
  const isIcon = variant.startsWith('icon-');

  if (isIcon) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={cn(
          'btn ib',
          'flex h-12 w-12 items-center justify-center rounded-[16px] border-0',
          ICON_VARIANT_CLASSES[variant as 'icon-volt' | 'icon-neutral' | 'icon-ember'],
          (disabled || loading) && 'cursor-not-allowed bg-turf-2 text-[#5E655A]',
          className
        )}
        {...props}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
      </button>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cn(
        'btn',
        'inline-flex items-center justify-center rounded-np-pill border-0 font-semibold',
        PILL_VARIANT_CLASSES[variant as PillVariant],
        PILL_SIZE_CLASSES[size],
        (disabled || loading) && 'cursor-not-allowed bg-turf-2 text-[#5E655A] shadow-none',
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
      {withArrow && <span className="arr flex items-center">{withArrow}</span>}
    </button>
  );
});
