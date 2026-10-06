/**
 * Statistiche Avanzate API (Milestone 7 / 12)
 *
 * Statistiche giocatore: base, per difficoltà, per tier avversario,
 * attività mensile, distribuzione risultati.
 */

import { supabase } from '../supabase'

export interface UserStats {
  matches_played: number
  matches_won: number
  matches_lost: number
  matches_abandoned: number
  win_rate: number
  average_score: number
  current_streak: number
  streak_type: 'win' | 'loss' | 'none'
  longest_win_streak: number
  longest_loss_streak: number
  best_score: number
}

export interface StatsByDifficulty {
  difficulty: number
  matches_played: number
  matches_won: number
  matches_lost: number
  win_rate: number
}

export interface StatsByOpponentTier {
  opponent_tier: string
  matches_played: number
  matches_won: number
  matches_lost: number
  win_rate: number
}

export interface MonthlyActivity {
  month: string
  year: number
  matches_played: number
  matches_won: number
  total_score: number
}

export interface ResultDistribution {
  result_type: string
  count: number
  percentage: number
}

/**
 * Ottieni statistiche avanzate per un utente
 */
export async function getUserStats(userId: string): Promise<UserStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_user_stats', { p_user_id: userId })

    if (error) throw error

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return null
    }

    const row = Array.isArray(data) ? data[0] : data

    return {
      matches_played: row.matches_played || 0,
      matches_won: row.matches_won || 0,
      matches_lost: row.matches_lost || 0,
      matches_abandoned: row.matches_abandoned || 0,
      win_rate: row.win_rate || 0,
      average_score: row.average_score || 0,
      current_streak: row.current_streak || 0,
      streak_type: row.streak_type || 'none',
      longest_win_streak: row.longest_win_streak || 0,
      longest_loss_streak: row.longest_loss_streak || 0,
      best_score: row.best_score || 0
    }
  } catch (error) {
    console.error('Error getting user stats:', error)
    return null
  }
}

/**
 * Statistiche per difficoltà
 */
export async function getStatsByDifficulty(userId: string): Promise<StatsByDifficulty[]> {
  try {
    const { data, error } = await supabase.rpc('get_stats_by_difficulty', { p_user_id: userId })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting stats by difficulty:', error)
    return []
  }
}

/**
 * Statistiche per tier avversario
 */
export async function getStatsByOpponentTier(userId: string): Promise<StatsByOpponentTier[]> {
  try {
    const { data, error } = await supabase.rpc('get_stats_by_opponent_tier', { p_user_id: userId })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting stats by opponent tier:', error)
    return []
  }
}

/**
 * Attività mensile (ultimi 6 mesi)
 */
export async function getMonthlyActivity(userId: string): Promise<MonthlyActivity[]> {
  try {
    const { data, error } = await supabase.rpc('get_monthly_activity', { p_user_id: userId })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting monthly activity:', error)
    return []
  }
}

/**
 * Distribuzione risultati
 */
export async function getResultDistribution(userId: string): Promise<ResultDistribution[]> {
  try {
    const { data, error } = await supabase.rpc('get_result_distribution_v2', { p_user_id: userId })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting result distribution:', error)
    return []
  }
}
