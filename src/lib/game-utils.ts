/**
 * Game utilities per Istinto Puro
 *
 * Include funzioni per:
 * - Tier system
 * - Leaderboard
 * - Guest names
 */

import type {
  Tier,
  TierInfo,
  LeaderboardEntry,
  LeaderboardType,
  MatchResult,
  ActiveMatch,
  GameProfile,
} from '../types/game';

/**
 * Genera un nome guest univoco
 * Format: guest-{random 4 digit}
 */
export function generateGuestName(): string {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `guest-${random}`;
}

/**
 * Verifica se un nome è un nome guest
 */
export function isGuestName(name: string): boolean {
  return /^guest-\d{4}$/.test(name);
}

/**
 * Formatta il nome display per la UI
 * Se è guest, mostra icona anonimo
 */
export function formatDisplayName(name: string, isGuest: boolean): string {
  if (isGuest || isGuestName(name)) {
    return '👤 ' + name;
  }
  return name;
}

/**
 * Calcola il win rate in percentuale
 */
export function calculateWinRate(won: number, played: number): number {
  if (played === 0) return 0;
  return Math.round((won / played) * 100);
}

/**
 * Ordina la leaderboard per punteggio (decrescente)
 */
export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Filtra la leaderboard per tier
 */
export function filterLeaderboardByTier(
  entries: LeaderboardEntry[],
  tier: Tier | 'all'
): LeaderboardEntry[] {
  if (tier === 'all') return entries;
  return entries.filter((e) => e.tier === tier);
}

/**
 * Calcola la posizione in classifica
 */
export function calculateRank(
  userId: string,
  leaderboard: LeaderboardEntry[]
): number {
  const index = leaderboard.findIndex((e) => e.userId === userId);
  return index >= 0 ? index + 1 : -1;
}

/**
 * Formatta il tempo relativo (es. "2 minuti fa", "ieri")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return 'ora';
  if (minutes < 60) return `${minutes} minuti fa`;
  if (hours < 24) return `${hours} ore fa`;
  if (days === 1) return 'ieri';
  if (days < 7) return `${days} giorni fa`;

  return date.toLocaleDateString('it-IT');
}

/**
 * Formatta il numero con separatore migliaia
 * Supporta diverse localizzazioni
 */
export function formatNumber(num: number, locale: string = 'it-IT'): string {
  return num.toLocaleString(locale);
}

/**
 * Valida il nome utente
 * Accetta lettere, numeri, spazi, underscore e trattini
 */
export function isValidDisplayName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 30) return false;
  return /^[a-zA-Z0-9_\- ]+$/.test(name);
}

/**
 * Genera un nome display dal profilo utente
 */
export function generateDisplayName(
  firstName: string | null,
  lastName: string | null
): string {
  if (firstName && lastName) {
    return `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)} ${lastName.charAt(0).toUpperCase()}.`;
  }
  if (firstName) {
    return firstName.charAt(0).toUpperCase() + firstName.slice(1);
  }
  return 'Anonimo';
}

/**
 * Esporta le funzioni di utilità per il gioco
 * Re-esporta da types/game
 */
export * from '../types/game';

export type { Tier, TierInfo, LeaderboardEntry, LeaderboardType, MatchResult, ActiveMatch, GameProfile } from '../types/game';