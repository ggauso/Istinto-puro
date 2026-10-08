import { useEffect, useState } from 'react';
import { useAuthStore } from '../../authStore';
import { calculateTier, getTierProgress, getNextTierScore } from '../../lib/game-utils';
import {
  getUserStats, getStatsByDifficulty, getStatsByOpponentTier, getMonthlyActivity, getResultDistribution,
  type UserStats, type StatsByDifficulty, type StatsByOpponentTier, type MonthlyActivity, type ResultDistribution
} from '../../lib/api/stats';
import {
  getCommonTeamCombos, getAccuracyByDifficulty, getAvgResponseTime, getMostGuessedPlayers,
  type CommonTeamCombo, type AccuracyByDifficulty, type AvgResponseTime, type MostGuessedPlayer
} from '../../lib/api/round-stats';
import { WinRateHeroCard, StatTile } from '../ui/BentoStatCard';
import { StripedProgressBar } from '../ui/StripedProgressBar';
import { EmptyState } from '../ui/EmptyState';
import { BallBounceLoader } from '../ui/loaders/BallBounceLoader';
import { ChevronDown, Flame, Shuffle, Crosshair, Timer, Star, Users2, BarChart3, PieChart } from 'lucide-react';
import { motion } from 'motion/react';

function AdvancedCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-np-lg bg-turf-1 p-[18px]">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-np-sm bg-turf-2 text-volt">{icon}</span>
        <span className="text-[15px] font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function LabeledBar({ label, pct, color = 'var(--color-volt)' }: { label: React.ReactNode; pct: number; color?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between">
        <span className="text-xs text-chalk-2">{label}</span>
        <span className="mono text-xs font-semibold" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-np-pill bg-ink">
        <div className="h-full rounded-np-pill transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function ProfileStatsTab() {
  const { user, profile } = useAuthStore();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [advancedStats, setAdvancedStats] = useState<{
    byDifficulty: StatsByDifficulty[];
    byOpponentTier: StatsByOpponentTier[];
    monthly: MonthlyActivity[];
    distribution: ResultDistribution[];
  }>({ byDifficulty: [], byOpponentTier: [], monthly: [], distribution: [] });
  const [loadingAdvancedStats, setLoadingAdvancedStats] = useState(false);

  const [roundStats, setRoundStats] = useState<{
    combos: CommonTeamCombo[];
    accuracy: AccuracyByDifficulty[];
    responseTime: AvgResponseTime[];
    mostGuessed: MostGuessedPlayer[];
  }>({ combos: [], accuracy: [], responseTime: [], mostGuessed: [] });

  useEffect(() => {
    if (!user) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || !showAdvancedStats) return;
    loadAdvancedStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showAdvancedStats]);

  async function loadStats() {
    setLoadingStats(true);
    try {
      const userStats = await getUserStats(user!.id);
      if (userStats) {
        setStats(userStats);
      } else if (profile) {
        const played = profile.matches_played || 0;
        const won = profile.matches_won || 0;
        setStats({
          matches_played: played,
          matches_won: won,
          matches_lost: profile.matches_lost || 0,
          matches_abandoned: profile.matches_abandoned || 0,
          win_rate: played > 0 ? Math.round((won / played) * 100) : 0,
          average_score: played > 0 ? Math.round((profile.total_score || 0) / played) : 0,
          current_streak: profile.current_streak || 0,
          streak_type: profile.streak_type || 'none',
          longest_win_streak: profile.longest_win_streak || 0,
          longest_loss_streak: profile.longest_loss_streak || 0,
          best_score: profile.best_score || 0,
        });
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
    setLoadingStats(false);
  }

  async function loadAdvancedStats() {
    setLoadingAdvancedStats(true);
    try {
      const [byDifficulty, byOpponentTier, monthly, distribution, combos, accuracy, responseTime, mostGuessed] = await Promise.all([
        getStatsByDifficulty(user!.id),
        getStatsByOpponentTier(user!.id),
        getMonthlyActivity(user!.id),
        getResultDistribution(user!.id),
        getCommonTeamCombos(user!.id),
        getAccuracyByDifficulty(user!.id),
        getAvgResponseTime(user!.id),
        getMostGuessedPlayers(user!.id),
      ]);
      setAdvancedStats({ byDifficulty, byOpponentTier, monthly, distribution });
      setRoundStats({ combos, accuracy, responseTime, mostGuessed });
    } catch (err) {
      console.error('Error loading advanced stats:', err);
    }
    setLoadingAdvancedStats(false);
  }

  const difficultyLabel = (d: number) => (d === 1 ? 'Facile' : d === 2 ? 'Medio' : d === 3 ? 'Difficile' : d === 4 ? 'Hard' : `Liv. ${d}`);
  const overallResponseTime = roundStats.responseTime.find((r) => r.difficulty === null);
  const responseTimeByDifficulty = roundStats.responseTime.filter((r) => r.difficulty !== null);

  if (!user || !profile) return null;

  const totalScore = profile.total_score || 0;
  const tier = calculateTier(totalScore);
  const tierProgress = getTierProgress(totalScore);
  const nextTierScore = getNextTierScore(tier);

  if (loadingStats || !stats) {
    return (
      <div className="flex justify-center py-16">
        <BallBounceLoader />
      </div>
    );
  }

  const maxMonthly = Math.max(...advancedStats.monthly.map((m) => m.matches_played), 1);
  const distributionTotal = advancedStats.distribution.reduce((sum, d) => sum + d.count, 0);
  const distByType = (type: string) => advancedStats.distribution.find((d) => d.result_type === type);

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 grid-rows-[118px_118px_96px] gap-2.5">
        <WinRateHeroCard percent={stats.win_rate} matchesLabel={`${stats.matches_played} partite`} className="row-span-2 p-4" />
        <StatTile label="Partite" value={stats.matches_played} className="p-3.5" />
        <div className="flex flex-col justify-between rounded-np-lg bg-turf-1 p-3.5">
          <span className="cond text-[11px] text-label">Serie</span>
          <div className="flex items-center gap-1.5">
            <Flame className="flame h-[26px] w-[26px] fill-ember text-ember" />
            <span className="disp text-[40px]">{stats.current_streak}</span>
          </div>
        </div>
        <div className="col-span-2 flex flex-col justify-center gap-2.5 rounded-np-lg bg-turf-1 p-4">
          {tier !== 'diamond' ? (
            <StripedProgressBar
              progress={tierProgress}
              title={`Verso ${tier === 'bronze' ? 'Silver' : tier === 'silver' ? 'Gold' : tier === 'gold' ? 'Platinum' : 'Diamond'}`}
              currentValue={totalScore}
              totalValue={`/ ${nextTierScore}`}
              className="bg-transparent p-0"
            />
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Tier massimo raggiunto</span>
              <span className="mono text-sm font-semibold text-volt">{totalScore} pt</span>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        <div className="flex flex-col gap-1 rounded-np-md bg-turf-1 p-3">
          <span className="cond text-[11px] text-label">Media pt</span>
          <span className="mono text-xl font-semibold">{Math.round(stats.average_score)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-np-md bg-turf-1 p-3">
          <span className="cond text-[11px] text-label">Best</span>
          <span className="mono text-xl font-semibold">{stats.best_score}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-np-md bg-turf-1 p-3">
          <span className="cond text-[11px] text-label">Abband.</span>
          <span className="mono text-xl font-semibold text-chalk-2">{stats.matches_abandoned}</span>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setShowAdvancedStats((v) => !v)}
        className="flex items-center justify-between rounded-np-lg bg-turf-1 px-4 py-3.5"
      >
        <span className="text-[15px] font-semibold">Statistiche avanzate</span>
        <motion.span animate={{ rotate: showAdvancedStats ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 text-label" />
        </motion.span>
      </button>

      {showAdvancedStats && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }} className="overflow-hidden">
          {loadingAdvancedStats ? (
            <div className="flex justify-center py-10">
              <BallBounceLoader />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <AdvancedCard icon={<PieChart className="h-4 w-4" />} title="Distribuzione risultati">
                {distributionTotal > 0 ? (
                  <>
                    <span className="mono -mt-2 text-xs text-label">{distributionTotal} partite</span>
                    <div className="flex h-4 gap-[3px] overflow-hidden rounded-np-pill bg-ink">
                      <div className="rounded-l-np-pill bg-volt" style={{ width: `${distByType('Vittorie')?.percentage ?? 0}%` }} />
                      <div className="bg-ember" style={{ width: `${distByType('Sconfitte')?.percentage ?? 0}%` }} />
                      <div className="flex-1 bg-turf-3" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'Vittorie', label: 'Vinte', color: 'var(--color-volt)' },
                        { key: 'Sconfitte', label: 'Perse', color: 'var(--color-ember)' },
                        { key: 'Abbandoni', label: 'Abband.', color: '#5E655A' },
                      ].map(({ key, label, color }) => {
                        const d = distByType(key);
                        return (
                          <div key={key} className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 text-[11px] text-chalk-2">
                              <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
                              {label}
                            </span>
                            <span className="mono text-lg font-semibold">
                              {d?.percentage ?? 0}
                              <span className="text-xs text-label">%</span>
                            </span>
                            <span className="mono text-[11px] text-label">{d?.count ?? 0} partite</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <EmptyState icon={<PieChart className="h-5 w-5" />} title="Nessuna partita giocata" />
                )}
              </AdvancedCard>

              <div className="grid grid-cols-2 gap-2.5">
                <AdvancedCard icon={<BarChart3 className="h-4 w-4" />} title="Per difficoltà">
                  {advancedStats.byDifficulty.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {advancedStats.byDifficulty.map((item) => (
                        <LabeledBar key={item.difficulty} label={difficultyLabel(item.difficulty)} pct={item.win_rate} />
                      ))}
                    </div>
                  ) : (
                    <span className="mono text-xs text-label">—</span>
                  )}
                </AdvancedCard>
                <AdvancedCard icon={<Users2 className="h-4 w-4" />} title="Vs tier avversario">
                  {advancedStats.byOpponentTier.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {advancedStats.byOpponentTier.map((item) => (
                        <LabeledBar key={item.opponent_tier} label={item.opponent_tier} pct={item.win_rate} />
                      ))}
                    </div>
                  ) : (
                    <span className="mono text-xs text-label">—</span>
                  )}
                </AdvancedCard>
              </div>

              <AdvancedCard icon={<BarChart3 className="h-4 w-4" />} title="Attività mensile">
                {advancedStats.monthly.length > 0 ? (
                  <div className="flex h-28 items-end gap-2.5">
                    {advancedStats.monthly.slice(-6).map((item, idx) => (
                      <div key={idx} className="flex flex-1 flex-col items-center gap-1.5">
                        <div className="flex h-20 w-full items-end">
                          <div
                            className="w-full rounded-t-np-sm bg-volt"
                            style={{ height: `${Math.max((item.matches_played / maxMonthly) * 100, 6)}%` }}
                            title={`${item.matches_played} partite, ${item.matches_won} vittorie`}
                          />
                        </div>
                        <span className="cond text-[10px] text-label">{item.month}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="Nessuna attività registrata" />
                )}
              </AdvancedCard>

              <div className="grid grid-cols-2 gap-2.5">
                <AdvancedCard icon={<Timer className="h-4 w-4" />} title="Tempo medio">
                  {overallResponseTime ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="mono text-[32px] font-semibold">{(overallResponseTime.avg_response_time_ms / 1000).toFixed(1)}</span>
                        <span className="mono text-sm text-chalk-2">s</span>
                      </div>
                      <span className="mono text-[11px] text-label">{overallResponseTime.sample_count} risposte</span>
                      {responseTimeByDifficulty.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {responseTimeByDifficulty.map((item) => (
                            <span key={item.difficulty} className="mono rounded-np-sm bg-turf-2 px-2 py-1 text-[11px]">
                              {difficultyLabel(item.difficulty!)} {(item.avg_response_time_ms / 1000).toFixed(1)}s
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="mono text-[32px] font-semibold text-chalk-2">0.0s</span>
                      <span className="mono text-[11px] text-label">0 risposte</span>
                    </>
                  )}
                </AdvancedCard>
                <AdvancedCard icon={<Crosshair className="h-4 w-4" />} title="Precisione">
                  {roundStats.accuracy.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {roundStats.accuracy.map((item) => (
                        <LabeledBar key={item.difficulty} label={difficultyLabel(item.difficulty)} pct={item.accuracy_pct} />
                      ))}
                    </div>
                  ) : (
                    <span className="mono text-xs text-label">Nessuna risposta</span>
                  )}
                </AdvancedCard>
              </div>

              <AdvancedCard icon={<Star className="h-4 w-4" />} title="Giocatori più indovinati">
                {roundStats.mostGuessed.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {roundStats.mostGuessed.map((item, idx) => (
                      <div key={item.player_name} className="flex items-center justify-between rounded-np-sm bg-turf-2 px-3.5 py-2">
                        <span className="text-[13px]">
                          <span className="mono mr-2 text-label">#{idx + 1}</span>
                          {item.player_name}
                        </span>
                        <span className="mono text-[13px] font-semibold text-volt">{item.correct_count}×</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={<Users2 className="h-5 w-5" />} title="Nessun giocatore indovinato ancora" subtitle="Qui comparirà la tua top 5." />
                )}
              </AdvancedCard>

              <AdvancedCard icon={<Shuffle className="h-4 w-4" />} title="Combinazioni più comuni">
                {roundStats.combos.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {roundStats.combos.map((item) => (
                      <div key={`${item.team_a_id}-${item.team_b_id}`} className="flex items-center justify-between rounded-np-sm bg-turf-2 px-3.5 py-2">
                        <span className="text-[13px]">
                          {item.team_a_name} vs {item.team_b_name}
                        </span>
                        <span className="mono text-[13px] font-semibold text-volt">{item.times_played}×</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={<Shuffle className="h-5 w-5" />} title="Nessuna partita con risposte registrate" />
                )}
              </AdvancedCard>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
