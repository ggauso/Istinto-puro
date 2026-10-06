/**
 * Matches API
 *
 * Salvataggio del risultato di una partita (tabella `matches_history` + profilo)
 */

import { supabase } from '../supabase'
import { formatRpcError } from '../../utils'

/**
 * Salva il risultato di una partita
 */
export async function saveMatchResult(
  playerName: string,
  opponentName: string,
  playerTier: string,
  opponentTier: string,
  playerScore: number,
  opponentScore: number,
  isWin: boolean,
  difficulty: number = 1,
  isPvp: boolean = false
): Promise<{
  success: boolean
  matchId: string | null
  error: string | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, matchId: null, error: 'Utente non autenticato' }
    }

    const { data, error } = await supabase.rpc('save_match_result', {
      p_user_id: user.id,
      p_player_name: playerName,
      p_opponent_name: opponentName,
      p_player_tier: playerTier,
      p_opponent_tier: opponentTier,
      p_player_score: playerScore,
      p_opponent_score: opponentScore,
      p_is_win: isWin,
      p_difficulty: difficulty,
      p_is_pvp: isPvp
    })

    if (error) {
      throw error
    }

    return {
      success: true,
      matchId: data || null,
      error: null
    }
  } catch (error) {
    return {
      success: false,
      matchId: null,
      error: formatRpcError(error)
    }
  }
}
