import { cn } from '../../lib/cn';

export interface DifficultyOption<T extends string | number> {
  value: T;
  label: string;
  /** Tono acceso: volt (default) o ember (es. Hard) — l'ember ha anche un trattamento "pericolo" persistente anche da spento. */
  tone?: 'volt' | 'ember';
}

export interface DifficultySelectorProps<T extends string | number> {
  options: DifficultyOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Selettore difficoltà "a gradino": l'opzione N-esima accende N barre di
 * potenza (il numero totale di barre segue il numero di opzioni, non è
 * fisso a 3). Le opzioni `tone="ember"` (es. Hard) restano leggermente
 * tinte di ember anche da spente, come avviso persistente — le altre sono
 * neutre finché non selezionate.
 */
export function DifficultySelector<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: DifficultySelectorProps<T>) {
  const totalBars = options.length;

  return (
    <div className={cn('grid gap-1.5', className)} style={{ gridTemplateColumns: `repeat(${totalBars}, minmax(0, 1fr))` }}>
      {options.map((option, i) => {
        const active = option.value === value;
        const isEmber = option.tone === 'ember';
        const litColor = active ? (isEmber ? 'var(--color-ember)' : 'var(--color-volt)') : isEmber ? 'rgba(255,91,58,.35)' : 'var(--color-turf-3)';

        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'chip flex h-[60px] flex-col items-start justify-center gap-[7px] rounded-[16px] border-[1.5px] px-2.5',
              active ? (isEmber ? 'bg-ember/12 text-ember-light' : 'bg-turf-2 text-chalk') : isEmber ? 'bg-turf-1 text-ember-light' : 'bg-turf-1 text-chalk-2',
              active ? (isEmber ? 'border-ember' : 'border-volt') : isEmber ? 'border-ember/30' : 'border-transparent'
            )}
          >
            <span className="text-[13px] font-bold">{option.label}</span>
            <span className="flex gap-0.5">
              {Array.from({ length: totalBars }, (_, barIndex) => (
                <span
                  key={barIndex}
                  className="h-1 w-[9px] rounded-sm"
                  style={{ background: barIndex <= i ? litColor : 'var(--color-turf-3)' }}
                />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
