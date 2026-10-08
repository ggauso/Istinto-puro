import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: ReactNode;
}

/**
 * Checkbox del design system: quadrato bg-turf-2/bordo bianco 20% da spento,
 * bg-volt pieno con spunta "pop" (stesso bounce già usato per il badge di
 * selezione del rail campionati in Home) da acceso. L'`<input>` nativo resta
 * presente ma visivamente nascosto (`sr-only`), per mantenere semantica e
 * navigazione da tastiera reali, non solo l'aspetto.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, checked, ...props },
  ref
) {
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3', className)}>
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0">
        <input ref={ref} id={id} type="checkbox" checked={checked} className="peer sr-only" {...props} />
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-[6px] border-[1.5px] transition-colors',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-volt/40',
            checked ? 'border-volt bg-volt' : 'border-white/20 bg-turf-2'
          )}
        >
          {checked && <Check className="pop h-3.5 w-3.5 text-ink" strokeWidth={3} />}
        </span>
      </span>
      <span className="text-sm text-chalk-2">{label}</span>
    </label>
  );
});
