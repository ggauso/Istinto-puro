import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { Tier } from '../../types/game';

function regularPolygon(sides: number, rotationDeg = -90): string {
  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (rotationDeg + (360 / sides) * i) * (Math.PI / 180);
    const x = 50 + 50 * Math.cos(angle);
    const y = 50 + 50 * Math.sin(angle);
    points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${points.join(', ')})`;
}

function scallopedSeal(points = 16, innerRatio = 0.86): string {
  const coords: string[] = [];
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? 50 : 50 * innerRatio;
    const angle = (-90 + (360 / total) * i) * (Math.PI / 180);
    const x = 50 + r * Math.cos(angle);
    const y = 50 + r * Math.sin(angle);
    coords.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${coords.join(', ')})`;
}

/**
 * Forma per tier, da badge-achievement.html: Bronze=esagono, Silver=scudo,
 * Gold=sigillo/rosetta, Platinum=ottagono. Diamond non ha una forma propria
 * nel mockup fornito: qui un rombo come proposta provvisoria — vedi
 * restyle.md "Punti aperti" (11.3), da validare prima di considerarla
 * definitiva.
 */
const TIER_SHAPE: Record<Tier, string> = {
  bronze: regularPolygon(6),
  silver: 'polygon(50% 0%, 100% 18%, 100% 58%, 50% 100%, 0% 58%, 0% 18%)',
  gold: scallopedSeal(16),
  platinum: regularPolygon(8),
  diamond: regularPolygon(4, -45),
};

const TIER_GRADIENT: Record<Tier, string> = {
  bronze: 'linear-gradient(135deg, var(--tier-bronze-from), var(--tier-bronze-to))',
  silver: 'linear-gradient(135deg, var(--tier-silver-from), var(--tier-silver-to))',
  gold: 'linear-gradient(135deg, var(--tier-gold-from), var(--tier-gold-to))',
  platinum: 'linear-gradient(135deg, var(--tier-platinum-from), var(--tier-platinum-to))',
  diamond: 'linear-gradient(135deg, var(--tier-diamond-from), var(--tier-diamond-to))',
};

export type AchievementBadgeState = 'locked' | 'in-progress' | 'unlocked';

export interface AchievementBadgeProps {
  tier: Tier;
  state: AchievementBadgeState;
  icon: ReactNode;
  size?: 84 | 64 | 40;
  /** Mostrata sotto forma di anello/etichetta quando `state === 'in-progress'`, es. "8 / 10". */
  progressLabel?: string;
  className?: string;
}

/**
 * Badge achievement a forma geometrica per tier (clip-path), con shine
 * diagonale animato quando sbloccato (classe `.shine`). Usato nella griglia
 * Trofei del profilo e nella schermata Achievement dedicata.
 */
export function AchievementBadge({ tier, state, icon, size = 64, progressLabel, className }: AchievementBadgeProps) {
  const shape = TIER_SHAPE[tier];
  const locked = state === 'locked';

  return (
    <div className={cn('relative inline-flex flex-col items-center gap-1.5', className)}>
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          width: size,
          height: size,
          clipPath: shape,
          background: locked ? 'var(--color-turf-3)' : TIER_GRADIENT[tier],
        }}
      >
        {state === 'unlocked' && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="shine h-full w-[28%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)]" />
          </div>
        )}
        <span className={cn('relative', locked ? 'text-label' : 'text-ink')} style={{ width: size * 0.4, height: size * 0.4 }}>
          {icon}
        </span>
      </div>
      {locked && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-turf-1">
          <Lock className="h-3 w-3 text-label" strokeWidth={2.4} />
        </span>
      )}
      {state === 'in-progress' && progressLabel && (
        <span className="mono text-[10px] text-label">{progressLabel}</span>
      )}
    </div>
  );
}
