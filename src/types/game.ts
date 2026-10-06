/**
 * Tipi per le feature di gioco
 */

// =====================================================
// TIER SYSTEM
// =====================================================

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface TierInfo {
  name: Tier;
  label: string;
  color: string;
  minScore: number;
  maxScore: number;
  icon: string;
}

export const TIER_CONFIG: Record<Tier, TierInfo> = {
  bronze: {
    name: 'bronze',
    label: 'Bronze',
    color: '#CD7F32',
    minScore: 0,
    maxScore: 500,
    icon: '🥉',
  },
  silver: {
    name: 'silver',
    label: 'Silver',
    color: '#C0C0C0',
    minScore: 501,
    maxScore: 1500,
    icon: '🥈',
  },
  gold: {
    name: 'gold',
    label: 'Gold',
    color: '#FFD700',
    minScore: 1501,
    maxScore: 3000,
    icon: '🥇',
  },
  platinum: {
    name: 'platinum',
    label: 'Platinum',
    color: '#E5E4E2',
    minScore: 3001,
    maxScore: 5000,
    icon: '💎',
  },
  diamond: {
    name: 'diamond',
    label: 'Diamond',
    color: '#B9F2FF',
    minScore: 5001,
    maxScore: Infinity,
    icon: '🔷',
  },
};

/**
 * Calcola il tier in base al punteggio totale
 */
export function calculateTier(totalScore: number): Tier {
  if (totalScore >= TIER_CONFIG.diamond.minScore) return 'diamond';
  if (totalScore >= TIER_CONFIG.platinum.minScore) return 'platinum';
  if (totalScore >= TIER_CONFIG.gold.minScore) return 'gold';
  if (totalScore >= TIER_CONFIG.silver.minScore) return 'silver';
  return 'bronze';
}

/**
 * Ottiene le informazioni complete per un tier
 */
export function getTierInfo(totalScore: number): TierInfo {
  const tier = calculateTier(totalScore);
  return TIER_CONFIG[tier];
}

/**
 * Calcola la progressione verso il prossimo tier (0-100%)
 */
export function getTierProgress(totalScore: number): number {
  const tier = calculateTier(totalScore);
  const tierInfo = TIER_CONFIG[tier];

  if (tierInfo.maxScore === Infinity) return 100;

  const range = tierInfo.maxScore - tierInfo.minScore;
  const progress = totalScore - tierInfo.minScore;

  return Math.min(100, Math.round((progress / range) * 100));
}

/**
 * Calcola i punti necessari per il prossimo tier
 */
export function getNextTierScore(currentTier: Tier): number {
  const tierOrder: Tier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = tierOrder.indexOf(currentTier);

  if (currentIndex === tierOrder.length - 1) {
    return TIER_CONFIG.diamond.maxScore; // Already at max
  }

  const nextTier = tierOrder[currentIndex + 1];
  return TIER_CONFIG[nextTier].minScore;
}

// =====================================================
// LEADERBOARD
// =====================================================

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  totalScore: number;
  tier: Tier;
  matchesPlayed: number;
  matchesWon: number;
  winRate: number;
}

export type LeaderboardType = 'all_time' | 'weekly' | 'monthly';

// =====================================================
// PARTITE
// =====================================================

export interface MatchResult {
  id: string;
  playerName: string;
  opponentName: string;
  playerScore: number;
  opponentScore: number;
  isWin: boolean;
  playedAt: string;
  tier: Tier;
}

export interface ActiveMatch {
  id: string;
  opponentName: string;
  opponentTier: Tier;
  isAnonymous: boolean;
  difficulty: number;
  startedAt: string;
}

// =====================================================
// UTENTE
// =====================================================

export interface GameProfile {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  totalScore: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  tier: Tier;
  tierProgress: number;
  rank: number | null;
  createdAt: string;
}

// =====================================================
// ACHIEVEMENT (Milestone 8, esteso 2026-10-06 — 26 achievement)
// =====================================================

// Famiglia 1 (22 codici): verificati server-side da
// check_and_unlock_achievements (dati già persistiti in
// profiles/matches_history/tournament_participants).
// Famiglia 2 ('speed', 'speed_flash', 'perfect', 'perfect25'): eventi
// momentanei osservabili solo durante il round in corso, sbloccati dal
// client via unlock_achievement (whitelist lato server).
export type AchievementCode =
  // wins — vittorie totali
  | 'first_win'
  | 'win_10'
  | 'win_50'
  | 'win_150'
  | 'win_500'
  // streak — vittorie consecutive
  | 'streak5'
  | 'streak10'
  | 'streak25'
  // tier — tier giocatore raggiunto
  | 'tier_silver'
  | 'tier_gold'
  | 'tier_platinum'
  | 'tier_diamond'
  // skill — eventi client-side
  | 'speed'
  | 'speed_flash'
  | 'perfect'
  | 'perfect25'
  // social — partite PvP
  | 'social10'
  | 'social50'
  | 'social200'
  // dedication — partite totali (qualunque modalità)
  | 'play50'
  | 'play250'
  | 'play1000'
  // tournament
  | 'tournament_join'
  | 'tournament_win'
  | 'tournament_win5'
  | 'tournament_big_win';

export type AchievementCategory = 'wins' | 'streak' | 'tier' | 'skill' | 'social' | 'dedication' | 'tournament';

// Rarità/difficoltà dell'achievement all'interno della sua famiglia — non
// va confuso con il Tier del giocatore (sopra): un achievement 'platinum'
// non richiede che il giocatore sia nel tier Platinum, es. win_500 è
// 'platinum' per quanto è raro vincere 500 partite.
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// Riflette la riga restituita da get_user_achievements: label/description/
// icon/tier sono il catalogo lato DB, non duplicati qui — questo tipo
// descrive solo la forma della risposta, non i contenuti (fonte di verità
// in supabase/schema/12_achievements.sql + 13_achievements_expansion.sql).
export interface Achievement {
  code: AchievementCode;
  label: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  tier: AchievementTier;
  unlocked: boolean;
  unlockedAt: string | null;
}

// Solo per testo breve nel toast di sblocco (App.tsx), che deve poter
// mostrare un messaggio senza un round-trip di rete — stesse etichette del
// catalogo DB, duplicate qui per lo stesso motivo per cui TIER_CONFIG sopra
// duplica soglie già presenti anche in save_match_result (SQL).
export const ACHIEVEMENT_LABELS: Record<AchievementCode, string> = {
  first_win: 'Prima vittoria',
  win_10: 'Esordiente',
  win_50: 'Veterano',
  win_150: 'Maestro',
  win_500: 'Leggenda',
  streak5: 'Serie vincente',
  streak10: 'Inarrestabile',
  streak25: 'Imbattibile',
  tier_silver: 'Argento',
  tier_gold: 'Oro',
  tier_platinum: 'Platino',
  tier_diamond: 'Diamante',
  speed: 'Fulmine',
  speed_flash: 'Lampo',
  perfect: 'Perfetto',
  perfect25: 'Imperturbabile',
  social10: 'Socievole',
  social50: 'Rivale',
  social200: 'Gladiatore',
  play50: 'Appassionato',
  play250: 'Dedizione',
  play1000: 'Instancabile',
  tournament_join: 'Debuttante',
  tournament_win: 'Campione del torneo',
  tournament_win5: 'Dominatore',
  tournament_big_win: 'Gran maestro',
};