import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface BottomNavItem {
  key: string;
  label: string;
  icon: ReactNode;
}

export interface BottomNavBarProps {
  items: readonly BottomNavItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

/**
 * Nav bar floating con blur, fissa in fondo. La voce attiva si espande per
 * mostrare la label (Glide, 380ms), le altre restano icon-only. Vedi
 * restyle.md Fase 2 per l'integrazione in `App.tsx`.
 */
export function BottomNavBar({ items, active, onChange, className }: BottomNavBarProps) {
  return (
    <nav
      className={cn(
        'shadow-np-sheet fixed inset-x-0 bottom-0 z-40 flex justify-center',
        'pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2',
        className
      )}
    >
      <div className="flex items-center gap-1 rounded-np-pill border border-white/10 bg-turf-2/90 p-1.5 backdrop-blur-md">
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex h-12 items-center gap-2 overflow-hidden rounded-np-pill px-3.5 transition-[background-color,padding] duration-300 ease-[cubic-bezier(.16,1,.3,1)]',
                isActive ? 'bg-volt px-4 text-ink' : 'text-chalk-2'
              )}
            >
              <span className="flex shrink-0 items-center justify-center">{item.icon}</span>
              <span
                className={cn(
                  'overflow-hidden whitespace-nowrap text-sm font-semibold transition-[max-width,opacity] duration-300 ease-[cubic-bezier(.16,1,.3,1)]',
                  isActive ? 'max-w-[100px] opacity-100' : 'max-w-0 opacity-0'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
