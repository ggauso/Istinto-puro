import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface SegmentedControlOption<T extends string> {
  label: string;
  value: T;
  icon?: ReactNode;
  /** Pillola numerica accanto alla label (es. conteggio richieste/sfide in sospeso). */
  badge?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `pill` (999px, default, tab bar N voci) o `rounded` (20px contenitore/16px indicatore, toggle a 2 voci es. PvP/Vs IA). */
  shape?: 'pill' | 'rounded';
  className?: string;
}

/**
 * Navigazione a schede con indicatore che scivola (Snap, 380ms).
 * Usata per: toggle PvP/IA (Home, shape="rounded"), Aperti/Storico (Tornei),
 * tab Profilo (shape="pill", default).
 * Il numero di opzioni è libero: l'indicatore è dimensionato in percentuale
 * del contenitore e spostato di multipli della propria larghezza (`100%`
 * in `translateX` è sempre relativo al box dell'indicatore stesso), quindi
 * funziona a qualunque numero di voci senza larghezze fisse in px.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  shape = 'pill',
  className,
}: SegmentedControlProps<T>) {
  const count = options.length;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const isRounded = shape === 'rounded';

  return (
    <div
      className={cn(
        'relative flex bg-ink p-[5px]',
        isRounded ? 'rounded-[20px]' : 'rounded-np-pill',
        className
      )}
      role="tablist"
    >
      <div
        className={cn('tab-ind pointer-events-none absolute inset-y-[5px] bg-volt', isRounded ? 'rounded-[16px]' : 'rounded-np-pill')}
        style={{
          width: `calc((100% - 10px) / ${count})`,
          transform: `translateX(calc(${index} * 100%))`,
        }}
        aria-hidden="true"
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'tab relative z-10 flex flex-1 items-center justify-center gap-2 whitespace-nowrap px-4 text-[13px] font-semibold',
              isRounded ? 'h-13 rounded-[16px]' : 'py-2.5 rounded-np-pill',
              active ? 'text-ink' : 'text-chalk-2'
            )}
          >
            {option.icon}
            {option.label}
            {option.badge && (
              <span
                className={cn(
                  'mono flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px]',
                  active ? 'bg-ink text-volt' : 'bg-turf-3 text-chalk'
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
