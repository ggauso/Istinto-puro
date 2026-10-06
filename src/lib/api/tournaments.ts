/**
 * Tornei API (Milestone 5)
 *
 * Tornei a eliminazione diretta: iscrizione libera, bracket generato
 * automaticamente dal server quando il torneo si riempie.
 */

import { supabase } from '../supabase'
import { formatRpcError } from '../../utils'

export interface Tournament {
  id: string
  name: string
  max_players: number
  current_players: number
  league: string
  difficulty: number
  creator_nickname: string
  created_at: string
  start_mode: 'fill' | 'scheduled'
  scheduled_at: string | null
  creator_id: string | null
}

export interface TournamentParticipant {
  user_id: string
  nickname: string
  tier: string
  status: 'active' | 'eliminated' | 'winner'
  eliminated_round: number | null
  final_position: number | null
}

export interface TournamentMatch {
  id: string
  round: number
  match_number: number
  player1_id: string | null
  player1_nickname: string | null
  player2_id: string | null
  player2_nickname: string | null
  winner_id: string | null
  status: 'pending' | 'completed'
  player1_score: number
  player2_score: number
}

export interface TournamentDetails {
  id: string
  name: string
  max_players: number
  current_players: number
  league: string
  difficulty: number
  status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  creator_id: string | null
  winner_id: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  start_mode: 'fill' | 'scheduled'
  scheduled_at: string | null
}

export interface ActiveTournamentMatch {
  match_id: string
  tournament_id: string
  tournament_name: string
  room_id: string
  round: number
  opponent_id: string | null
  opponent_nickname: string
  opponent_tier: string
  is_player1: boolean
  league: string
  difficulty: number
}

export interface TournamentHistoryEntry {
  tournament_id: string
  name: string
  status: string
  final_position: number | null
  max_players: number
  completed_at: string | null
}

/**
 * Crea un nuovo torneo
 */
export async function createTournament(
  name: string,
  maxPlayers: number,
  league: string = 'seria_a',
  difficulty: number = 1,
  startMode: 'fill' | 'scheduled' = 'fill',
  scheduledAt: string | null = null
): Promise<{
  success: boolean
  tournamentId: string | null
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('create_tournament', {
      p_name: name,
      p_max_players: maxPlayers,
      p_league: league,
      p_difficulty: difficulty,
      p_start_mode: startMode,
      p_scheduled_at: startMode === 'scheduled' ? scheduledAt : null
    })

    if (error) throw error

    return { success: true, tournamentId: data, error: null }
  } catch (error) {
    return { success: false, tournamentId: null, error: formatRpcError(error) }
  }
}

/**
 * Cancella un torneo non ancora iniziato (solo il creatore, solo se 'open')
 */
export async function cancelTournament(tournamentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('cancel_tournament', {
      p_tournament_id: tournamentId
    })

    if (error) throw error

    return data || false
  } catch (error) {
    return false
  }
}

/**
 * Avvia i tornei schedulati la cui data/ora è arrivata (polling periodico,
 * nessun pg_cron disponibile: vedi pollFriendChallenges in App.tsx)
 */
export async function startDueTournaments(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('start_due_tournaments')

    if (error) throw error

    return data || 0
  } catch (error) {
    return 0
  }
}

/**
 * Ottieni i tornei aperti (in attesa di giocatori)
 */
export async function getOpenTournaments(): Promise<{
  success: boolean
  tournaments: Tournament[]
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_open_tournaments')

    if (error) throw error

    return { success: true, tournaments: data || [], error: null }
  } catch (error) {
    return { success: false, tournaments: [], error: formatRpcError(error) }
  }
}

/**
 * Ottieni dettaglio completo di un torneo: info, partecipanti, match (bracket)
 */
export async function getTournamentDetails(tournamentId: string): Promise<{
  success: boolean
  tournament: TournamentDetails | null
  participants: TournamentParticipant[]
  matches: TournamentMatch[]
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_tournament_details', {
      p_tournament_id: tournamentId
    })

    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data

    if (!row) {
      return { success: false, tournament: null, participants: [], matches: [], error: 'Torneo non trovato' }
    }

    return {
      success: true,
      tournament: row.tournament || null,
      participants: row.participants || [],
      matches: row.matches || [],
      error: null
    }
  } catch (error) {
    return { success: false, tournament: null, participants: [], matches: [], error: formatRpcError(error) }
  }
}

/**
 * Iscriviti a un torneo
 */
export async function joinTournament(tournamentId: string): Promise<{
  success: boolean
  message: string
  currentPlayers: number
  maxPlayers: number
  started: boolean
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('join_tournament', {
      p_tournament_id: tournamentId
    })

    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data

    if (!row) {
      return { success: false, message: 'Errore sconosciuto', currentPlayers: 0, maxPlayers: 0, started: false, error: 'Errore sconosciuto' }
    }

    return {
      success: row.success,
      message: row.message,
      currentPlayers: row.current_players,
      maxPlayers: row.max_players,
      started: row.started,
      error: row.success ? null : row.message
    }
  } catch (error) {
    return { success: false, message: '', currentPlayers: 0, maxPlayers: 0, started: false, error: formatRpcError(error) }
  }
}

/**
 * Abbandona l'iscrizione a un torneo non ancora iniziato
 */
export async function leaveTournament(tournamentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('leave_tournament', {
      p_tournament_id: tournamentId
    })

    if (error) throw error

    return data || false
  } catch (error) {
    return false
  }
}

/**
 * Ottieni i match di torneo pronti per l'utente corrente (entrambi i
 * giocatori noti, in attesa di essere giocati) — usata dal polling globale.
 */
export async function getMyActiveTournamentMatches(): Promise<{
  success: boolean
  matches: ActiveTournamentMatch[]
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_my_active_tournament_matches')

    if (error) throw error

    return { success: true, matches: data || [], error: null }
  } catch (error) {
    return { success: false, matches: [], error: formatRpcError(error) }
  }
}

/**
 * Completa un match di torneo (fine partita normale)
 */
export async function completeTournamentMatch(
  matchId: string,
  winnerId: string,
  player1Score: number,
  player2Score: number
): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('complete_tournament_match', {
      p_match_id: matchId,
      p_winner_id: winnerId,
      p_player1_score: player1Score,
      p_player2_score: player2Score
    })

    if (error) throw error

    return { success: data || false, error: null }
  } catch (error) {
    return { success: false, error: formatRpcError(error) }
  }
}

/**
 * Abbandona un match di torneo (vittoria per forfeit all'avversario)
 */
export async function abandonTournamentMatch(matchId: string): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('abandon_tournament_match', {
      p_match_id: matchId
    })

    if (error) throw error

    return { success: data || false, error: null }
  } catch (error) {
    return { success: false, error: formatRpcError(error) }
  }
}

/**
 * Storico tornei completati dell'utente corrente
 */
export async function getMyTournamentHistory(): Promise<{
  success: boolean
  history: TournamentHistoryEntry[]
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_my_tournament_history')

    if (error) throw error

    return { success: true, history: data || [], error: null }
  } catch (error) {
    return { success: false, history: [], error: formatRpcError(error) }
  }
}
