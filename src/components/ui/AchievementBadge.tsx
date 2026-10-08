import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { AchievementTier } from '../../types/game';

/**
 * Forma + palette per tier achievement, **coordinate esatte di
 * `achievement.html`** (non approssimazioni geometriche generiche): Bronze
 * un esagono allungato, Silver uno scudo, Gold un sigillo a 32 punte,
 * Platinum un ottagono con angoli tagliati. Nessun achievement reale usa il
 * tier Diamond (verificato sui 26 `AchievementCode`), quindi qui non serve
 * una quinta forma — a differenza di `TierBadge`, che resta a 5 tier per il
 * tier di gioco del giocatore.
 */
const TIER_SHAPE: Record<AchievementTier, string> = {
  bronze: 'polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',
  silver: 'polygon(50% 0,100% 14%,100% 58%,50% 100%,0 58%,0 14%)',
  gold: 'polygon(50.0% 0.0%,58.8% 5.9%,69.1% 3.8%,75.0% 12.6%,85.4% 14.6%,87.4% 25.0%,96.2% 30.9%,94.1% 41.2%,100.0% 50.0%,94.1% 58.8%,96.2% 69.1%,87.4% 75.0%,85.4% 85.4%,75.0% 87.4%,69.1% 96.2%,58.8% 94.1%,50.0% 100.0%,41.2% 94.1%,30.9% 96.2%,25.0% 87.4%,14.6% 85.4%,12.6% 75.0%,3.8% 69.1%,5.9% 58.8%,0.0% 50.0%,5.9% 41.2%,3.8% 30.9%,12.6% 25.0%,14.6% 14.6%,25.0% 12.6%,30.9% 3.8%,41.2% 5.9%)',
  platinum: 'polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)',
};

const TIER_PALETTE: Record<AchievementTier, { rim: string; core: string; glyph: string; label: string; border: string }> = {
  bronze: { rim: 'linear-gradient(135deg,#F0BC8C,#8E5A34)', core: '#4A2C17', glyph: '#F2C29A', label: '#E0A878', border: 'rgba(201,138,90,.45)' },
  silver: { rim: 'linear-gradient(135deg,#FFFFFF,#8D949E)', core: '#353A42', glyph: '#F0F3F7', label: '#DDE1E7', border: 'rgba(201,206,214,.4)' },
  gold: { rim: 'linear-gradient(135deg,#FFE9A8,#C4901C)', core: '#4E3906', glyph: '#FFE08A', label: '#FFD36E', border: 'rgba(242,193,78,.4)' },
  platinum: { rim: 'linear-gradient(135deg,#E2FFFA,#4FB3A4)', core: '#0F3A35', glyph: '#C6FFF6', label: '#8FE3D6', border: 'rgba(143,227,214,.4)' },
};

const LOCKED = { rim: '#2A2E27', core: '#1C1F1B', glyph: '#4A5046', border: 'rgba(255,255,255,.06)' };

export type AchievementBadgeState = 'locked' | 'unlocked';

export interface AchievementBadgeProps {
  tier: AchievementTier;
  state: AchievementBadgeState;
  icon: ReactNode;
  size?: 84 | 64 | 60 | 52 | 40;
  className?: string;
}

/**
 * Badge achievement a forma geometrica per tier (clip-path a doppio strato
 * rim+core, esatto da `achievement.html`), con shine diagonale animato
 * quando sbloccato (`.shine`) e lucchetto in overlay quando bloccato.
 */
export function AchievementBadge({ tier, state, icon, size = 60, className }: AchievementBadgeProps) {
  const shape = TIER_SHAPE[tier];
  const unlocked = state === 'unlocked';
  const colors = unlocked ? TIER_PALETTE[tier] : LOCKED;

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <div className="absolute inset-0" style={{ clipPath: shape, background: colors.rim }} />
      <div
        className="absolute overflow-hidden"
        style={{ inset: size * 0.067, clipPath: shape, background: colors.core }}
      >
        {unlocked && (
          <div className="shine h-full" style={{ width: size * 0.3, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent)' }} aria-hidden="true" />
        )}
      </div>
      <span
        className="absolute flex items-center justify-center"
        style={{ left: size * 0.283, top: size * 0.283, width: size * 0.433, height: size * 0.433, color: colors.glyph }}
      >
        {icon}
      </span>
      {!unlocked && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-ink border-[1.5px] border-turf-3"
          style={{ right: size * -0.067, bottom: size * -0.033, width: size * 0.367, height: size * 0.367 }}
        >
          <Lock className="text-label" style={{ width: size * 0.167, height: size * 0.167 }} strokeWidth={2.6} />
        </span>
      )}
    </div>
  );
}

export { TIER_PALETTE as ACHIEVEMENT_TIER_PALETTE };
