/**
 * Match History API (Milestone 7, Task 7.3)
 *
 * Storico partite paginato, con filtro per modalità (PvP/IA) e risultato
 * (vittoria/sconfitta). Il dettaglio di ogni partita è già tutto incluso
 * nella riga restituita, nessuna RPC aggiuntiva.
 */

import { supabase } from '../supabase'

export type MatchHistoryMode = 'pvp' | 'ai'
export type MatchHistoryResult = 'win' | 'loss'

export interface MatchHistoryEntry {
  id: string
  opponent_name: string
  player_tier: string
  opponent_tier: string
  player_score: number
  opponent_score: number
  is_win: boolean
  is_pvp: boolean
  difficulty: number
  played_at: string
}

export interface MatchHistoryPage {
  entries: MatchHistoryEntry[]
  totalCount: number
}

const EMPTY_PAGE: MatchHistoryPage = { entries: [], totalCount: 0 }

/**
 * Pagina di storico partite per un utente.
 */
export async function getMatchHistory(
  userId: string,
  options: { limit?: number; offset?: number; mode?: MatchHistoryMode | null; result?: MatchHistoryResult | null } = {}
): Promise<MatchHistoryPage> {
  const { limit = 20, offset = 0, mode = null, result = null } = options

  try {
    const { data, error } = await supabase.rpc('get_match_history', {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset,
      p_mode: mode,
      p_result: result
    })

    if (error) throw error
    if (!data || data.length === 0) return EMPTY_PAGE

    const rows = data as Array<MatchHistoryEntry & { total_count: number }>

    return {
      entries: rows.map(({ total_count, ...entry }) => entry),
      totalCount: rows[0].total_count || 0
    }
  } catch (error) {
    console.error('Error getting match history:', error)
    return EMPTY_PAGE
  }
}
