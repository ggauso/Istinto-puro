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