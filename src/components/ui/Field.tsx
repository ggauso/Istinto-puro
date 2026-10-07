import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/cn';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Icona a sinistra (es. lente di ricerca). */
  icon?: ReactNode;
  /** Prefisso mono a sinistra (es. "R1" per il numero di round). Nome diverso da `prefix` per non confliggere con l'attributo HTML `prefix` (RDFa) già tipato da `InputHTMLAttributes`. */
  prefixSlot?: ReactNode;
  /** Contenuto a destra, es. bottone invio integrato. */
  suffix?: ReactNode;
  /** `pill` = barra di ricerca (999px, 48px alto); `answer` = campo risposta grande (radius-lg, 64px alto). */
  shape?: 'pill' | 'answer';
  error?: string;
  containerClassName?: string;
}

/**
 * Campo input del design system: bordo/bg turf-2, focus ring volt via
 * classe globale `.field` (night-pitch.css). Due varianti di forma per i
 * due usi ricorrenti: barra di ricerca pill e campo risposta grande.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { icon, prefixSlot, suffix, shape = 'pill', error, className, containerClassName, ...props },
  ref
) {
  const isAnswer = shape === 'answer';

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className={cn(
          'field flex items-center gap-3 border-[1.5px] bg-turf-2',
          isAnswer ? 'h-16 rounded-np-lg pl-[22px] pr-2.5' : 'h-12 rounded-np-pill px-4',
          error ? 'border-ember' : 'border-white/10',
          containerClassName
        )}
      >
        {prefixSlot && <span className="mono text-xs text-volt">{prefixSlot}</span>}
        {icon && <span className="flex items-center text-chalk-2">{icon}</span>}
        <input
          ref={ref}
          className={cn(
            'flex-1 border-0 bg-transparent font-sans text-chalk placeholder:text-chalk-2',
            isAnswer ? 'text-lg font-semibold' : 'text-[15px]',
            className
          )}
          {...props}
        />
        {suffix}
      </label>
      {error && <span className="text-xs font-semibold text-ember-light">{error}</span>}
    </div>
  );
});
