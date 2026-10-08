import { useEffect, useState } from 'react';
import { useAuthStore } from '../../authStore';
import { getUserAchievements } from '../../lib/api/achievements';
import type { Achievement, AchievementCategory } from '../../types/game';
import { AchievementBadge } from '../ui/AchievementBadge';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { BallBounceLoader } from '../ui/loaders/BallBounceLoader';
import { ACHIEVEMENT_ICON_PATHS } from './achievementIcons';

const CATEGORY_ORDER: AchievementCategory[] = ['wins', 'streak', 'tier', 'skill', 'social', 'dedication', 'tournament'];
const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  wins: 'Vittorie',
  streak: 'Serie',
  tier: 'Progressione',
  skill: 'Abilità',
  social: 'Sociale',
  dedication: 'Dedizione',
  tournament: 'Tornei',
};

function AchievementIcon({ achievement, size }: { achievement: Achievement; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={ACHIEVEMENT_ICON_PATHS[achievement.code]} />
    </svg>
  );
}

function formatUnlockedDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ProfileAchievementsTab() {
  const { user } = useAuthStore();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<AchievementCategory | 'all'>('all');
  const [selected, setSelected] = useState<Achievement | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserAchievements(user.id).then((data) => {
      setAchievements(data);
      setLoading(false);
    });
  }, [user]);

  if (!user) return null;
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <BallBounceLoader />
      </div>
    );
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = totalCount > 0 ? circumference * (1 - unlockedCount / totalCount) : circumference;

  const groups = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: achievements.filter((a) => a.category === cat),
  })).filter((g) => (category === 'all' || category === g.category) && g.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex items-center gap-4 rounded-np-hero border border-white/7 bg-turf-1 p-[18px]">
        <div className="relative h-24 w-24 shrink-0">
          <svg width="96" height="96" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-turf-3)" strokeWidth="10" />
            <circle
              className="ring"
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--color-volt)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              style={{ strokeDashoffset: offset }}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="disp text-[28px]">{unlockedCount}</span>
            <span className="mono text-[11px] text-chalk-2">/ {totalCount}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-base font-bold">{unlockedCount === totalCount ? 'Tutti sbloccati!' : 'Il prossimo è vicino'}</span>
          <span className="text-[13px] leading-[1.45] text-chalk-2">
            {unlockedCount === totalCount
              ? 'Hai completato l\'intera collezione di trofei.'
              : 'Continua a giocare per sbloccarne altri.'}
          </span>
        </div>
      </section>

      <div className="rail -mx-4 flex gap-1.5 overflow-x-auto px-4">
        <Chip selected={category === 'all'} onClick={() => setCategory('all')}>
          Tutti
        </Chip>
        {CATEGORY_ORDER.map((cat) => (
          <Chip key={cat} selected={category === cat} onClick={() => setCategory(cat)}>
            {CATEGORY_LABELS[cat]}
          </Chip>
        ))}
      </div>

      {groups.map((group) => (
        <section key={group.category} className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className="cond text-xs text-label">{CATEGORY_LABELS[group.category]}</span>
            <span className="mono text-[11px] text-label">
              {group.items.filter((a) => a.unlocked).length} / {group.items.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {group.items.map((achievement) => (
              <button
                key={achievement.code}
                type="button"
                onClick={() => setSelected(achievement)}
                className={`press flex flex-col items-center gap-2 rounded-np-lg border bg-turf-1 px-1.5 py-3.5 text-center ${
                  achievement.unlocked ? 'border-white/[.08]' : 'border-white/[.06]'
                }`}
              >
                <AchievementBadge
                  tier={achievement.tier}
                  state={achievement.unlocked ? 'unlocked' : 'locked'}
                  icon={<AchievementIcon achievement={achievement} size={26} />}
                  size={60}
                />
                <span className={`text-xs font-semibold leading-tight ${achievement.unlocked ? 'text-chalk' : 'text-chalk-2'}`}>
                  {achievement.label}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <BottomSheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="flex flex-col items-center gap-3.5 px-6 pb-8 pt-2 text-center">
            <div className="mt-2">
              <AchievementBadge
                tier={selected.tier}
                state={selected.unlocked ? 'unlocked' : 'locked'}
                icon={<AchievementIcon achievement={selected} size={48} />}
                size={84}
              />
            </div>
            <span className="cond text-xs" style={{ color: selected.unlocked ? undefined : 'var(--color-label)' }}>
              {selected.tier} · {selected.unlocked && selected.unlockedAt ? `Sbloccato il ${formatUnlockedDate(selected.unlockedAt)}` : 'Da sbloccare'}
            </span>
            <h2 className="disp text-2xl" style={{ fontStretch: '110%' }}>
              {selected.label}
            </h2>
            <p className="text-[15px] text-chalk-2">{selected.description}</p>
            <Button variant="chalk" className="mt-1.5 w-full" onClick={() => setSelected(null)}>
              Chiudi
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
