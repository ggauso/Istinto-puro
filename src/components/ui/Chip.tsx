import { type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** Colore dell'indicatore quando selezionato: volt (default) o ember (es. filtro "Hard"). */
  tone?: 'volt' | 'ember';
}

/**
 * Chip filtro pill, es. filtri Classifica (Sempre/Settimana/Mese/Amici/Hard).
 * Altezza 40px (valore esatto di `classifica.html`, non i 36px della scheda
 * componenti generica — qui vince il mockup della schermata reale).
 */
export function Chip({ selected = false, tone = 'volt', className, children, ...props }: ChipProps) {
  const emberSelected = selected && tone === 'ember';
  // L'ember resta leggermente tinto anche da spento (bordo+testo), come
  // avviso persistente — stesso pattern già usato in `DifficultySelector`
  // per l'opzione "Hard". Le altre tonalità sono neutre finché non selezionate.
  const emberUnselected = !selected && tone === 'ember';

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'chip inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-np-pill px-3.5 text-[13px] font-semibold',
        selected && !emberSelected && 'bg-chalk text-ink border border-chalk',
        emberSelected && 'bg-ember/14 text-ember-light border border-ember/35',
        emberUnselected && 'bg-transparent text-ember-light border border-ember/40',
        !selected && !emberUnselected && 'bg-transparent text-chalk-2 border border-white/14',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
