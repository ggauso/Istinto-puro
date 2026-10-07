import { cn } from '../../lib/cn';

export type CrestPattern = 'solid' | 'vstripes' | 'halves' | 'sash' | 'band' | 'vband' | 'diag' | 'cross';

function patternBackground(pattern: CrestPattern, c1: string, c2: string): string {
  switch (pattern) {
    case 'solid':
      return c1;
    case 'vstripes':
      return `repeating-linear-gradient(90deg, ${c1} 0 20%, ${c2} 20% 40%)`;
    case 'halves':
      return `linear-gradient(90deg, ${c1} 50%, ${c2} 50%)`;
    case 'sash':
      return `linear-gradient(135deg, ${c1} 45%, ${c2} 45% 55%, ${c1} 55%)`;
    case 'band':
      return `linear-gradient(0deg, ${c1} 35%, ${c2} 35% 65%, ${c1} 65%)`;
    case 'vband':
      return `linear-gradient(90deg, ${c1} 35%, ${c2} 35% 65%, ${c1} 65%)`;
    case 'diag':
      return `repeating-linear-gradient(45deg, ${c1} 0 10px, ${c2} 10px 20px)`;
    case 'cross':
      return `linear-gradient(${c2}, ${c2}) center / 100% 28% no-repeat, linear-gradient(${c2}, ${c2}) center / 28% 100% no-repeat, ${c1}`;
  }
}

export interface TeamCrestProps {
  teamName: string;
  colors: [string, string?];
  pattern?: CrestPattern;
  /** Larghezza del gonfalone in px (l'altezza segue il rapporto del design). */
  size?: number;
  showPole?: boolean;
  className?: string;
}

/**
 * Gonfalone/pennant generico a colori sociali (nessuno stemma ufficiale,
 * scelta deliberata del design system — vedi restyle.md 11.2): fallback
 * stilizzato quando manca un logo reale. Non sostituisce i loghi API-Football
 * esistenti, si usa solo quando `team_logo` è assente.
 */
export function TeamCrest({ teamName, colors, pattern = 'solid', size = 64, showPole = true, className }: TeamCrestProps) {
  const [c1, c2 = c1] = colors;
  const initials = teamName
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 3)
    .toUpperCase();
  const height = size * 0.78;

  return (
    <div className={cn('flex flex-col items-center', className)} style={{ width: size }}>
      {showPole && (
        <div className="flex w-full flex-col items-center">
          <span className="h-[3px] w-full rounded-full bg-gradient-to-r from-white/10 via-white/40 to-white/10" />
          <span className="-mt-0.5 h-1.5 w-1.5 rounded-full bg-white/50" />
        </div>
      )}
      <div
        className="relative flex items-center justify-center text-ink"
        style={{
          width: size,
          height,
          clipPath: 'polygon(0 0, 100% 0, 100% 64%, 50% 100%, 0 64%)',
          background: patternBackground(pattern, c1, c2),
        }}
      >
        <span
          className="mono rounded-np-pill bg-ink/35 px-1.5 py-0.5 font-bold text-chalk"
          style={{ fontSize: size * 0.18 }}
        >
          {initials}
        </span>
      </div>
      <span className="-mt-0.5 h-1.5 w-1.5 rounded-full" style={{ background: c1 }} />
    </div>
  );
}
