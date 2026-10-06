/**
 * Leaderboard API
 *
 * Classifiche (all-time, settimanale, mensile) e posizione utente
 */

import { supabase } from '../supabase'
import { formatRpcError } from '../../utils'

export interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  totalScore: number
  tier: string
  matchesPlayed: number
  matchesWon: number
  winRate: number
}

function mapLeaderboardEntries(data: any[] | null): LeaderboardEntry[] {
  return data?.map((entry: any) => ({
    rank: entry.rank,
    userId: entry.user_id,
    displayName: entry.display_name,
    totalScore: entry.total_score,
    tier: entry.tier,
    matchesPlayed: entry.matches_played,
    matchesWon: entry.matches_won,
    winRate: entry.win_rate
  })) || []
}

/**
 * Ottieni la classifica globale
 */
export async function getLeaderboard(
  limit: number = 100,
  tier?: string | null
): Promise<{
  success: boolean
  entries: LeaderboardEntry[]
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_limit: limit,
      p_tier: tier || null
    })

    if (error) {
      throw error
    }

    return { success: true, entries: mapLeaderboardEntries(data), error: null }
  } catch (error) {
    return { success: false, entries: [], error: formatRpcError(error) }
  }
}

/**
 * Ottieni la classifica settimanale
 */
export async function getWeeklyLeaderboard(
  limit: number = 100
): Promise<{
  success: boolean
  entries: LeaderboardEntry[]
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_weekly_leaderboard', {
      p_limit: limit
    })

    if (error) {
      throw error
    }

    return { success: true, entries: mapLeaderboardEntries(data), error: null }
  } catch (error) {
    return { success: false, entries: [], error: formatRpcError(error) }
  }
}

/**
 * Ottieni la classifica mensile
 */
export async function getMonthlyLeaderboard(
  limit: number = 100
): Promise<{
  success: boolean
  entries: LeaderboardEntry[]
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_monthly_leaderboard', {
      p_limit: limit
    })

    if (error) {
      throw error
    }

    return { success: true, entries: mapLeaderboardEntries(data), error: null }
  } catch (error) {
    return { success: false, entries: [], error: formatRpcError(error) }
  }
}

/**
 * Ottieni la classifica filtrata sui soli amici dell'utente (+ l'utente
 * stesso) — Milestone 11. Richiede un utente autenticato: la RPC verifica
 * server-side che `auth.uid()` corrisponda all'utente richiesto.
 */
export async function getFriendsLeaderboard(
  limit: number = 100
): Promise<{
  success: boolean
  entries: LeaderboardEntry[]
  error: string | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, entries: [], error: 'Utente non autenticato' }
    }

    const { data, error } = await supabase.rpc('get_friends_leaderboard', {
      p_user_id: user.id,
      p_limit: limit
    })

    if (error) {
      throw error
    }

    return { success: true, entries: mapLeaderboardEntries(data), error: null }
  } catch (error) {
    return { success: false, entries: [], error: formatRpcError(error) }
  }
}

/**
 * Ottieni la classifica dedicata alla modalità hard (Milestone 10, Task
 * 10.3) — aggrega `matches_history` filtrata su `difficulty = 4`.
 * Pubblica come le altre classifiche, nessun utente richiesto.
 */
export async function getHardModeLeaderboard(
  limit: number = 100
): Promise<{
  success: boolean
  entries: LeaderboardEntry[]
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_hard_mode_leaderboard', {
      p_limit: limit
    })

    if (error) {
      throw error
    }

    return { success: true, entries: mapLeaderboardEntries(data), error: null }
  } catch (error) {
    return { success: false, entries: [], error: formatRpcError(error) }
  }
}

/**
 * Ottieni la posizione in classifica dell'utente corrente
 */
export async function getUserRank(): Promise<{
  success: boolean
  rank: number | null
  error: string | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, rank: null, error: 'Utente non autenticato' }
    }

    const { data, error } = await supabase.rpc('get_user_rank', {
      p_user_id: user.id
    })

    if (error) {
      throw error
    }

    return {
      success: true,
      rank: data || null,
      error: null
    }
  } catch (error) {
    return {
      success: false,
      rank: null,
      error: formatRpcError(error)
    }
  }
}
