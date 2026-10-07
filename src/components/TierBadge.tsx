/**
 * TierBadge — pill tier/progressione del design system Night Pitch.
 * Cerchio iniziale su gradiente metallico + label. Vedi restyle.md 1.6.
 * Le 4 forme geometriche per tier (esagono/scudo/sigillo/ottagono) sono un
 * componente distinto, `AchievementBadge` (1.10): qui resta sempre un
 * cerchio, usato in liste/header dove serve indicare il tier in poco spazio.
 */

import { Tier, TIER_CONFIG } from '../types/game';

interface TierBadgeProps {
  tier: Tier | string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const TIER_VARS: Record<Tier, { from: string; to: string; label: string }> = {
  bronze: { from: 'var(--tier-bronze-from)', to: 'var(--tier-bronze-to)', label: 'var(--tier-bronze-label)' },
  silver: { from: 'var(--tier-silver-from)', to: 'var(--tier-silver-to)', label: 'var(--tier-silver-label)' },
  gold: { from: 'var(--tier-gold-from)', to: 'var(--tier-gold-to)', label: 'var(--tier-gold-label)' },
  platinum: { from: 'var(--tier-platinum-from)', to: 'var(--tier-platinum-to)', label: 'var(--tier-platinum-label)' },
  diamond: { from: 'var(--tier-diamond-from)', to: 'var(--tier-diamond-to)', label: 'var(--tier-diamond-label)' },
};

const SIZES = {
  sm: { pillH: 'h-7', pad: 'pl-[3px] pr-2.5', gap: 'gap-1.5', circle: 20, text: 'text-xs' },
  md: { pillH: 'h-8', pad: 'pl-[6px] pr-3', gap: 'gap-2', circle: 22, text: 'text-[13px]' },
  lg: { pillH: 'h-10', pad: 'pl-2 pr-4', gap: 'gap-2.5', circle: 28, text: 'text-sm' },
} as const;

export function TierBadge({ tier, showLabel = true, size = 'md' }: TierBadgeProps) {
  const tierKey = ((tier as string) || 'bronze').toLowerCase() as Tier;
  const tierInfo = TIER_CONFIG[tierKey] ?? TIER_CONFIG.bronze;
  const vars = TIER_VARS[tierKey] ?? TIER_VARS.bronze;
  const s = SIZES[size];

  const circle = (
    <span
      className="mono flex shrink-0 items-center justify-center rounded-full font-extrabold text-ink"
      style={{
        width: s.circle,
        height: s.circle,
        fontSize: s.circle * 0.5,
        background: `linear-gradient(135deg, ${vars.from}, ${vars.to})`,
      }}
    >
      {tierInfo.label.charAt(0).toUpperCase()}
    </span>
  );

  if (!showLabel) return circle;

  return (
    <span
      className={`inline-flex items-center rounded-np-pill font-bold ${s.pillH} ${s.pad} ${s.gap} ${s.text}`}
      style={{ background: `color-mix(in srgb, ${vars.label} 14%, transparent)`, color: vars.label }}
    >
      {circle}
      {tierInfo.label}
    </span>
  );
}

export default TierBadge;
