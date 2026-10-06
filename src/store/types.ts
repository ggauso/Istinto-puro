import { RealtimeChannel } from '@supabase/supabase-js';
import { AchievementCode } from '../types/game';

export interface Team {
  id: number;
  name: string;
  logo_url: string;
}

export interface MatchData {
  team1_id: number;
  team1_name: string;
  team1_logo: string;
  team2_id: number;
  team2_name: string;
  team2_logo: string;
  // Info avversario per feature di gioco
  opponent_id?: string;
  opponent_name?: string;
  opponent_tier?: string;
}

export type GameStatus = 'idle' | 'searching' | 'joining' | 'starting' | 'playing' | 'won' | 'lost' | 'opponent_won' | 'match_won' | 'match_lost';

// Durata del round in ms per modalità. Condivisa tra host e guest così
// entrambi calcolano il tempo rimanente a partire dallo stesso roundStartTime
// (inviato dall'host), invece di far partire un countdown locale indipendente.
export const ROUND_DURATION_MS: Record<'ai' | 'pvp', number> = { ai: 15000, pvp: 10000 };

// Modalità Hard (selectedDifficulty === 4, Milestone 10): timer fisso a 5s,
// indipendente da ai/pvp — molto più stringente dei normali 10-15s.
export const HARD_MODE_DIFFICULTY = 4;
export const HARD_MODE_ROUND_DURATION_MS = 5000;

export function getRoundDurationMs(gameMode: 'ai' | 'pvp', difficulty: number): number {
  if (difficulty === HARD_MODE_DIFFICULTY) return HARD_MODE_ROUND_DURATION_MS;
  return ROUND_DURATION_MS[gameMode];
}

export function getRemainingSeconds(gameMode: 'ai' | 'pvp', roundStartTime: number | null, difficulty: number = 1): number {
  const duration = getRoundDurationMs(gameMode, difficulty);
  const elapsed = Date.now() - (roundStartTime ?? Date.now());
  return Math.max(0, Math.ceil((duration - elapsed) / 1000));
}

/**
 * Stato e azioni relative al matchmaking (ricerca avversario PvP)
 */
export interface MatchmakingSlice {
  playerId: string;
  matchmakingChannel: RealtimeChannel | null;

  findMatch: () => void;
  joinGameRoom: (roomId: string, isHost: boolean, opponentUserId?: string, opponentNicknameFromPresence?: string | null, challengeId?: string) => void;
}

/**
 * Stato e azioni del round di gioco in corso
 */
export interface GameplaySlice {
  match: MatchData | null;
  score: number;
  timeLeft: number;
  status: GameStatus;
  gameChannel: RealtimeChannel | null;
  selectedLeague: number | null;
  selectedDifficulty: number;
  gameMode: 'pvp' | 'ai';
  correctAnswer: string | null;
  correctAnswerSeasons: { team1: number[], team2: number[] } | null;
  recentTeams: number[];

  isHost: boolean;
  round: number;
  playerRoundsWon: number;
  opponentRoundsWon: number;
  streak: number;
  roundStartTime: number | null;
  lastScoreAdded: number;
  lastRarity: number;
  lastCombo: number;

  // Info avversario per PvP
  opponentInfo: { nickname: string; tier: string } | null;

  // ID della sfida via link corrente (per completarla alla fine della partita)
  currentChallengeId: string | null;
  // ID della sfida tra amici corrente (distinto da currentChallengeId: le due
  // tabelle/RPC di completamento sono diverse — challenges vs friend_challenges)
  currentFriendChallengeId: string | null;
  // ID del match di torneo corrente
  currentTournamentMatchId: string | null;

  setGameMode: (mode: 'pvp' | 'ai') => void;
  setSelectedLeague: (leagueId: number | null) => void;
  setSelectedDifficulty: (difficulty: number) => void;
  fetchMatchAndBroadcast: () => Promise<void>;
  validatePlayer: (playerName: string) => Promise<boolean>;
  tickTimer: () => void;
  setStatus: (status: GameStatus) => void;
  setChallengeId: (id: string | null) => void;
  setFriendChallengeId: (id: string | null) => void;
  setTournamentMatchId: (id: string | null) => void;
}

/**
 * Azioni di fine partita: persistenza risultato, abbandono, reset
 */
export interface LifecycleSlice {
  abandonMatch: () => Promise<void>;
  resetGame: () => void;
  saveMatchResultToDb: (isWin: boolean, finalScore: number) => Promise<void>;

  // Achievement sbloccati e non ancora mostrati (toast) — popolati sia dal
  // controllo server-truth a fine partita (saveMatchResultToDb) sia dagli
  // eventi momentanei rilevati durante il round (validatePlayer in
  // gameplaySlice.ts). Il consumer (App.tsx) li rimuove con clearNewlyUnlockedAchievements.
  newlyUnlockedAchievements: AchievementCode[];
  clearNewlyUnlockedAchievements: () => void;
}

export type GameState = MatchmakingSlice & GameplaySlice & LifecycleSlice;
