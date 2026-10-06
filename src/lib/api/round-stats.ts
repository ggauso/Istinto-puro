/**
 * Statistiche per-round (Milestone 7, Task 7.2)
 *
 * Tracciamento di ogni singola risposta (corretta o sbagliata) data
 * durante una partita — distinto da src/lib/api/stats.ts, che legge solo
 * l'esito finale delle partite (matches_history).
 */

import { supabase } from '../supabase'

export interface CommonTeamCombo {
  team_a_id: number
  team_a_name: string
  team_b_id: number
  team_b_name: string
  times_played: number
}

export interface AccuracyByDifficulty {
  difficulty: number
  correct_count: number
  incorrect_count: number
  accuracy_pct: number
}

export interface AvgResponseTime {
  difficulty: number | null // null = totale complessivo (riga ROLLUP)
  avg_response_time_ms: number
  sample_count: number
}

export interface MostGuessedPlayer {
  player_name: string
  correct_count: number
}

/**
 * Registra una risposta data durante un round (corretta o sbagliata).
 * Fire-and-forget: chiamata da validatePlayer (gameplaySlice.ts) per ogni
 * round, non deve mai bloccare o alterare il flusso di gioco.
 */
export async function recordRoundAnswer(
  userId: string,
  team1Id: number,
  team2Id: number,
  playerName: string,
  isCorrect: boolean,
  difficulty: number = 1,
  responseTimeMs?: number
): Promise<void> {
  try {
    const { error } = await supabase.rpc('record_round_answer', {
      p_user_id: userId,
      p_team1_id: team1Id,
      p_team2_id: team2Id,
      p_player_name: playerName,
      p_is_correct: isCorrect,
      p_difficulty: difficulty,
      p_response_time_ms: responseTimeMs ?? null
    })

    if (error) throw error
  } catch (error) {
    console.error('Error recording round answer:', error)
  }
}

/**
 * Combinazioni di squadre più frequenti per l'utente.
 */
export async function getCommonTeamCombos(userId: string, limit: number = 10): Promise<CommonTeamCombo[]> {
  try {
    const { data, error } = await supabase.rpc('get_common_team_combos', { p_user_id: userId, p_limit: limit })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting common team combos:', error)
    return []
  }
}

/**
 * Risposte corrette vs errate per difficoltà.
 */
export async function getAccuracyByDifficulty(userId: string): Promise<AccuracyByDifficulty[]> {
  try {
    const { data, error } = await supabase.rpc('get_accuracy_by_difficulty', { p_user_id: userId })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting accuracy by difficulty:', error)
    return []
  }
}

/**
 * Tempo medio di risposta, complessivo (riga con difficulty null) e per
 * difficoltà.
 */
export async function getAvgResponseTime(userId: string): Promise<AvgResponseTime[]> {
  try {
    const { data, error } = await supabase.rpc('get_avg_response_time', { p_user_id: userId })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting avg response time:', error)
    return []
  }
}

/**
 * Giocatori indovinati più spesso (solo risposte corrette).
 */
export async function getMostGuessedPlayers(userId: string, limit: number = 10): Promise<MostGuessedPlayer[]> {
  try {
    const { data, error } = await supabase.rpc('get_most_guessed_players', { p_user_id: userId, p_limit: limit })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting most guessed players:', error)
    return []
  }
}
