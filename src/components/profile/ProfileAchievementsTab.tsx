import { useEffect, useState } from 'react';
import { useAuthStore } from '../../authStore';
import { getUserAchievements } from '../../lib/api/achievements';
import type { Achievement, AchievementCategory, AchievementTier } from '../../types/game';
import { Trophy, Flame, Gem, Zap, Star, Users, Gamepad2, Swords, Lock, Loader2, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

const ICONS: Record<string, LucideIcon> = { Trophy, Flame, Gem, Zap, Star, Users, Gamepad2, Swords };

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  wins: 'Vittorie',
  streak: 'Serie',
  tier: 'Progressione',
  skill: 'Abilità',
  social: 'Sociale',
  dedication: 'Dedizione',
  tournament: 'Tornei',
};

const CATEGORY_ORDER: AchievementCategory[] = ['wins', 'streak', 'tier', 'skill', 'social', 'dedication', 'tournament'];

const TIER_STYLES: Record<AchievementTier, { badgeBg: string; badgeText: string; iconBg: string; iconText: string; border: string }> = {
  bronze: { badgeBg: 'bg-orange-900/40', badgeText: 'text-orange-300', iconBg: 'bg-orange-500/20', iconText: 'text-orange-400', border: 'border-orange-500/30' },
  silver: { badgeBg: 'bg-zinc-600/40', badgeText: 'text-zinc-200', iconBg: 'bg-zinc-400/20', iconText: 'text-zinc-200', border: 'border-zinc-400/30' },
  gold: { badgeBg: 'bg-yellow-900/40', badgeText: 'text-yellow-300', iconBg: 'bg-yellow-500/20', iconText: 'text-yellow-400', border: 'border-yellow-500/30' },
  platinum: { badgeBg: 'bg-cyan-900/40', badgeText: 'text-cyan-200', iconBg: 'bg-cyan-400/20', iconText: 'text-cyan-300', border: 'border-cyan-400/30' },
};

export function ProfileAchievementsTab() {
  const { user } = useAuthStore();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getUserAchievements(user.id)
      .then(setAchievements)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: achievements.filter((a) => a.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-4 py-3">
        <span className="text-zinc-300 text-sm font-medium">Achievement sbloccati</span>
        <span className="text-white font-bold">{unlockedCount} / {achievements.length}</span>
      </div>

      {byCategory.map((group) => (
        <div key={group.category} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {CATEGORY_LABELS[group.category]}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {group.items.map((achievement, index) => {
              const Icon = ICONS[achievement.icon] || Trophy;
              const tierStyle = TIER_STYLES[achievement.tier] || TIER_STYLES.bronze;
              return (
                <motion.div
                  key={achievement.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`relative rounded-xl p-4 border flex flex-col items-center text-center gap-2 ${
                    achievement.unlocked
                      ? `bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 ${tierStyle.border}`
                      : 'bg-zinc-800/40 border-zinc-700/50'
                  }`}
                >
                  <span
                    className={`absolute top-2 right-2 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      achievement.unlocked ? `${tierStyle.badgeBg} ${tierStyle.badgeText}` : 'bg-zinc-700/50 text-zinc-500'
                    }`}
                  >
                    {achievement.tier}
                  </span>
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      achievement.unlocked ? `${tierStyle.iconBg} ${tierStyle.iconText}` : 'bg-zinc-700/50 text-zinc-500'
                    }`}
                  >
                    {achievement.unlocked ? <Icon className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div className={`font-semibold text-sm ${achievement.unlocked ? 'text-white' : 'text-zinc-500'}`}>
                    {achievement.label}
                  </div>
                  <div className="text-xs text-zinc-500">{achievement.description}</div>
                  {achievement.unlocked && achievement.unlockedAt && (
                    <div className="text-[10px] text-zinc-500/70 mt-1">
                      Sbloccato il {new Date(achievement.unlockedAt).toLocaleDateString('it-IT')}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
