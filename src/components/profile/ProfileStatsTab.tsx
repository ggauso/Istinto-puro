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
import { Trophy, Target, Users, Loader2, Shuffle, Crosshair, Timer, Star } from 'lucide-react';
import { motion } from 'motion/react';

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
  }>({
    byDifficulty: [],
    byOpponentTier: [],
    monthly: [],
    distribution: []
  });
  const [loadingAdvancedStats, setLoadingAdvancedStats] = useState(false);

  // Statistiche per-round (Milestone 7, Task 7.2) — caricate insieme alle
  // altre statistiche avanzate, stessa sezione espandibile.
  const [roundStats, setRoundStats] = useState<{
    combos: CommonTeamCombo[];
    accuracy: AccuracyByDifficulty[];
    responseTime: AvgResponseTime[];
    mostGuessed: MostGuessedPlayer[];
  }>({ combos: [], accuracy: [], responseTime: [], mostGuessed: [] });

  useEffect(() => {
    if (!user) return;
    loadStats();
  }, [user]);

  useEffect(() => {
    if (!user || !showAdvancedStats) return;
    loadAdvancedStats();
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
          best_score: profile.best_score || 0
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
        getMostGuessedPlayers(user!.id)
      ]);
      setAdvancedStats({ byDifficulty, byOpponentTier, monthly, distribution });
      setRoundStats({ combos, accuracy, responseTime, mostGuessed });
    } catch (err) {
      console.error('Error loading advanced stats:', err);
    }
    setLoadingAdvancedStats(false);
  }

  const difficultyLabel = (d: number) => d === 1 ? 'Facile' : d === 2 ? 'Medio' : d === 3 ? 'Difficile' : d === 4 ? 'Hard' : `Liv. ${d}`;
  const overallResponseTime = roundStats.responseTime.find((r) => r.difficulty === null);
  const responseTimeByDifficulty = roundStats.responseTime.filter((r) => r.difficulty !== null);

  if (!user || !profile) return null;

  const totalScore = profile.total_score || 0;
  const tier = calculateTier(totalScore);
  const tierProgress = getTierProgress(totalScore);
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <div className="space-y-6">
      {/* Basic Stats */}
      <div className="bg-[#1E1E1E] rounded-3xl p-6 shadow-2xl border border-white/5">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Statistiche
        </h2>

        {loadingStats ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : stats ? (
          <div className="space-y-4">
            {/* Card Progresso Tier */}
            <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 rounded-2xl p-5 border border-purple-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    tier === 'diamond' ? 'bg-purple-900/50' :
                    tier === 'platinum' ? 'bg-cyan-900/50' :
                    tier === 'gold' ? 'bg-yellow-900/50' :
                    tier === 'silver' ? 'bg-gray-600/50' :
                    'bg-amber-900/50'
                  }`}>
                    {tier === 'diamond' ? '💎' : tier === 'platinum' ? '⭐' : tier === 'gold' ? '🏆' : tier === 'silver' ? '🥈' : '🥉'}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">Tier {tierLabel}</div>
                    <div className="text-sm text-zinc-400">Punteggio: {totalScore}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-400">{tierProgress}%</div>
                  <div className="text-xs text-zinc-500">al prossimo livello</div>
                </div>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${tierProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-500 mt-2">
                <span>{totalScore} pt</span>
                <span>{tier === 'diamond' ? 'MAX' : `${getNextTierScore(tier)} pt`}</span>
              </div>
            </div>

            {/* Card Partite */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white">{stats.matches_played}</div>
                <div className="text-sm text-zinc-400 mt-1">Partite</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-400">{stats.matches_won}</div>
                <div className="text-sm text-zinc-400 mt-1">Vinte</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-red-400">{stats.matches_lost}</div>
                <div className="text-sm text-zinc-400 mt-1">Perse</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-yellow-400">{stats.win_rate}%</div>
                <div className="text-sm text-zinc-400 mt-1">Win Rate</div>
              </div>
            </div>

            {/* Card Statistiche Dettagliate */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{Math.round(stats.average_score)}</div>
                <div className="text-xs text-zinc-400 mt-1">Media Punti</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-400">{stats.best_score}</div>
                <div className="text-xs text-zinc-400 mt-1">Best Score</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-orange-400">{stats.matches_abandoned}</div>
                <div className="text-xs text-zinc-400 mt-1">Abbandonate</div>
              </div>
            </div>

            {/* Card Streak */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`bg-zinc-800/50 rounded-xl p-4 ${stats.streak_type === 'win' ? 'border border-green-500/50' : stats.streak_type === 'loss' ? 'border border-red-500/50' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  {stats.streak_type === 'win' ? (
                    <span className="text-green-400 text-sm">🔥 Serie Vittorie</span>
                  ) : stats.streak_type === 'loss' ? (
                    <span className="text-red-400 text-sm">❄️ Serie Sconfitte</span>
                  ) : (
                    <span className="text-zinc-400 text-sm">Streak</span>
                  )}
                </div>
                <div className="text-3xl font-bold text-white">{stats.current_streak}</div>
                <div className="text-xs text-zinc-500 mt-1">attuale</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <div className="text-sm text-zinc-400 mb-3">Record Streak</div>
                <div className="flex justify-between">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">🏆</div>
                    <div className="text-lg font-bold text-green-400">{stats.longest_win_streak}</div>
                    <div className="text-xs text-zinc-500">vittorie</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">📉</div>
                    <div className="text-lg font-bold text-red-400">{stats.longest_loss_streak}</div>
                    <div className="text-xs text-zinc-500">sconfitte</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-400">
            <p>Caricamento statistiche...</p>
          </div>
        )}
      </div>

      {/* Advanced Stats Section (Expandable) */}
      <div className="bg-[#1E1E1E] rounded-3xl p-6 shadow-2xl border border-white/5">
        <button
          onClick={() => setShowAdvancedStats(!showAdvancedStats)}
          className="w-full flex items-center justify-between mb-4"
        >
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            Statistiche Avanzate
          </h2>
          <motion.div
            animate={{ rotate: showAdvancedStats ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </button>

        {showAdvancedStats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {loadingAdvancedStats ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Win Rate by Difficulty - Card migliorata */}
                <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 rounded-2xl p-5 border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold text-cyan-300">Win Rate per Difficoltà</h3>
                  </div>
                  <div className="space-y-4">
                    {advancedStats.byDifficulty.length > 0 ? advancedStats.byDifficulty.map((item) => {
                      const difficultyLabel = item.difficulty === 1 ? 'Facile' : item.difficulty === 2 ? 'Medio' : 'Difficile';
                      const difficultyColors: Record<number, string> = {
                        1: 'from-green-500 to-emerald-500',
                        2: 'from-yellow-500 to-orange-500',
                        3: 'from-red-500 to-rose-500'
                      };
                      return (
                        <div key={item.difficulty} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-zinc-300">{difficultyLabel}</span>
                            <span className="text-lg font-bold text-white">{item.win_rate}%</span>
                          </div>
                          <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${difficultyColors[item.difficulty] || 'from-zinc-500 to-zinc-400'} rounded-full transition-all duration-500`}
                              style={{ width: `${item.win_rate}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-zinc-500">
                            <span>{item.matches_won} vittorie</span>
                            <span>{item.matches_lost} sconfitte</span>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-6 text-zinc-500">
                        <p>Nessuna partita giocata</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Performance vs Opponent Tier - Card migliorata */}
                <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-2xl p-5 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-purple-400" />
                    </div>
                    <h3 className="text-base font-semibold text-purple-300">Performance vs Tier Avversario</h3>
                  </div>
                  <div className="space-y-4">
                    {advancedStats.byOpponentTier.length > 0 ? advancedStats.byOpponentTier.map((item) => {
                      const tierColors: Record<string, string> = {
                        Bronze: 'from-amber-600 to-yellow-500',
                        Silver: 'from-gray-400 to-slate-300',
                        Gold: 'from-yellow-500 to-amber-400',
                        Platinum: 'from-cyan-500 to-teal-400',
                        Diamond: 'from-purple-500 to-pink-400',
                        AI: 'from-red-500 to-orange-400'
                      };
                      const tierIcons: Record<string, string> = {
                        Bronze: '🥉',
                        Silver: '🥈',
                        Gold: '🏆',
                        Platinum: '⭐',
                        Diamond: '💎',
                        AI: '🤖'
                      };
                      return (
                        <div key={item.opponent_tier} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-zinc-300">
                              {tierIcons[item.opponent_tier] || '❓'} {item.opponent_tier}
                            </span>
                            <span className="text-lg font-bold text-white">{item.win_rate}%</span>
                          </div>
                          <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${tierColors[item.opponent_tier] || 'from-zinc-500 to-zinc-400'} rounded-full transition-all duration-500`}
                              style={{ width: `${item.win_rate}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-zinc-500">
                            <span>{item.matches_won} vittorie</span>
                            <span>{item.matches_lost} sconfitte</span>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-6 text-zinc-500">
                        <p>Nessuna partita PvP</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Monthly Activity - Card migliorata */}
                <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-2xl p-5 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold text-green-300">Attività Mensile</h3>
                  </div>
                  <div className="flex items-end gap-3 h-40">
                    {advancedStats.monthly.length > 0 ? advancedStats.monthly.slice(-6).map((item, idx) => {
                      const maxMatches = Math.max(...advancedStats.monthly.map(m => m.matches_played), 1);
                      const height = Math.max((item.matches_played / maxMatches) * 100, 10);
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                          <div className="w-full flex flex-col items-center justify-end h-32">
                            <div
                              className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t-lg hover:from-green-500 hover:to-green-300 transition-all cursor-pointer"
                              style={{ height: `${height}%` }}
                              title={`${item.matches_played} partite, ${item.matches_won} vittorie`}
                            />
                          </div>
                          <span className="text-xs font-medium text-zinc-400">{item.month}</span>
                          <span className="text-xs text-zinc-500">{item.matches_played}</span>
                        </div>
                      );
                    }) : (
                      <div className="flex-1 text-center py-6 text-zinc-500">
                        <p>Nessuna attività recente</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Result Distribution - Card migliorata */}
                <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 rounded-2xl p-5 border border-orange-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold text-orange-300">Distribuzione Risultati</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {advancedStats.distribution.length > 0 ? advancedStats.distribution.map((item) => {
                      const colors: Record<string, string> = {
                        'Vittorie': 'from-green-600 to-emerald-500',
                        'Sconfitte': 'from-red-600 to-rose-500',
                        'Abbandoni': 'from-yellow-600 to-amber-500'
                      };
                      const icons: Record<string, string> = {
                        'Vittorie': '✅',
                        'Sconfitte': '❌',
                        'Abbandoni': '⏸️'
                      };
                      const labels: Record<string, string> = {
                        'Vittorie': 'Vinte',
                        'Sconfitte': 'Perse',
                        'Abbandoni': 'Abb.'
                      };
                      return (
                        <div key={item.result_type} className="text-center">
                          <div className="text-3xl mb-2">{icons[item.result_type] || '❓'}</div>
                          <div className="text-2xl font-bold text-white">{item.percentage}%</div>
                          <div className="text-sm text-zinc-400">{labels[item.result_type] || item.result_type}</div>
                          <div className="w-full bg-zinc-800 rounded-full h-2 mt-3 overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${colors[item.result_type] || 'from-zinc-500 to-zinc-400'} rounded-full`}
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">{item.count} partite</div>
                        </div>
                      );
                    }) : (
                      <div className="col-span-3 text-center py-6 text-zinc-500">
                        <p>Nessuna partita giocata</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Accuracy per Difficoltà (Task 7.2.2) */}
                <div className="bg-gradient-to-br from-indigo-900/30 to-blue-900/30 rounded-2xl p-5 border border-indigo-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                      <Crosshair className="w-4 h-4 text-indigo-400" />
                    </div>
                    <h3 className="text-base font-semibold text-indigo-300">Precisione per Difficoltà</h3>
                  </div>
                  <div className="space-y-4">
                    {roundStats.accuracy.length > 0 ? roundStats.accuracy.map((item) => (
                      <div key={item.difficulty} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-zinc-300">{difficultyLabel(item.difficulty)}</span>
                          <span className="text-lg font-bold text-white">{item.accuracy_pct}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${item.accuracy_pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>{item.correct_count} corrette</span>
                          <span>{item.incorrect_count} sbagliate</span>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-6 text-zinc-500">
                        <p>Nessuna risposta registrata</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tempo Medio di Risposta (Task 7.2.3) */}
                <div className="bg-gradient-to-br from-teal-900/30 to-cyan-900/30 rounded-2xl p-5 border border-teal-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center">
                      <Timer className="w-4 h-4 text-teal-400" />
                    </div>
                    <h3 className="text-base font-semibold text-teal-300">Tempo Medio di Risposta</h3>
                  </div>
                  {overallResponseTime ? (
                    <div className="space-y-4">
                      <div className="text-center bg-zinc-800/50 rounded-xl p-4">
                        <div className="text-3xl font-bold text-white">{(overallResponseTime.avg_response_time_ms / 1000).toFixed(1)}s</div>
                        <div className="text-xs text-zinc-400 mt-1">media complessiva ({overallResponseTime.sample_count} risposte)</div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {responseTimeByDifficulty.map((item) => (
                          <div key={item.difficulty} className="bg-zinc-800/50 rounded-xl p-3 text-center">
                            <div className="text-lg font-bold text-teal-300">{(item.avg_response_time_ms / 1000).toFixed(1)}s</div>
                            <div className="text-xs text-zinc-500 mt-1">{difficultyLabel(item.difficulty!)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-zinc-500">
                      <p>Nessuna risposta registrata</p>
                    </div>
                  )}
                </div>

                {/* Giocatori Più Indovinati (Task 7.2.4) */}
                <div className="bg-gradient-to-br from-rose-900/30 to-pink-900/30 rounded-2xl p-5 border border-rose-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-rose-500/20 rounded-lg flex items-center justify-center">
                      <Star className="w-4 h-4 text-rose-400" />
                    </div>
                    <h3 className="text-base font-semibold text-rose-300">Giocatori Più Indovinati</h3>
                  </div>
                  {roundStats.mostGuessed.length > 0 ? (
                    <div className="space-y-2">
                      {roundStats.mostGuessed.map((item, idx) => (
                        <div key={item.player_name} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-4 py-2.5">
                          <span className="text-sm text-zinc-300">
                            <span className="text-zinc-500 mr-2">#{idx + 1}</span>{item.player_name}
                          </span>
                          <span className="text-sm font-bold text-rose-300">{item.correct_count}×</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-zinc-500">
                      <p>Nessun giocatore indovinato ancora</p>
                    </div>
                  )}
                </div>

                {/* Combinazioni Squadre Più Comuni (Task 7.2.1) */}
                <div className="bg-gradient-to-br from-violet-900/30 to-fuchsia-900/30 rounded-2xl p-5 border border-violet-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center">
                      <Shuffle className="w-4 h-4 text-violet-400" />
                    </div>
                    <h3 className="text-base font-semibold text-violet-300">Combinazioni Squadre Più Comuni</h3>
                  </div>
                  {roundStats.combos.length > 0 ? (
                    <div className="space-y-2">
                      {roundStats.combos.map((item) => (
                        <div key={`${item.team_a_id}-${item.team_b_id}`} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-4 py-2.5">
                          <span className="text-sm text-zinc-300">{item.team_a_name} vs {item.team_b_name}</span>
                          <span className="text-sm font-bold text-violet-300">{item.times_played}×</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-zinc-500">
                      <p>Nessuna partita giocata</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
