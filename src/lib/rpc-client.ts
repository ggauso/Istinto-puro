/**
 * RPC Client for Istinto Puro
 *
 * Client-side wrapper per le chiamate alle funzioni RPC di Supabase
 * Include:
 * - Validazione input client-side
 * - Timeout di 10 secondi
 * - Retry automatici (max 3)
 * - Formattazione errori friendly
 * - Circuit breaker pattern
 * - Error logging
 */

import { supabase } from './supabase'
import { isValidTeamId, isValidLeagueId, formatRpcError } from '../utils'
import { rpcCircuitBreaker } from './circuit-breaker'
import { logRpcError } from './error-logger'
import type { PlayerSearchResult } from '../types'

// Timeout e retry config
const TIMEOUT_MS = 10000
const MAX_RETRIES = 3

/**
 * Controlla team_id e league_id per SQL injection
 */
function sanitizeId(id: string | null): boolean {
  if (id === null || id === '') {
    return false
  }
  if (id.length > 20) {
    return false
  }

  // Controllo SQL injection
  const dangerous = ['--', /\*/ , '\'', '\\']
  return !dangerous.some(d => (d as RegExp) instanceof RegExp ? (d as RegExp).test(id) : false)
}

/**
 * Ottieni match casuale con timeout e retry
 */
export async function getMatchFromRpc(
  leagueId: number | null,
  recentTeams: number[],
  difficulty: number
): Promise<PlayerSearchResult[]> {
  const excludeTeamIds = recentTeams.map(id => BigInt(id))

  const result = await getRandomMatch(leagueId ? leagueId.toString() : null, excludeTeamIds, difficulty)

  return result.success ? [result.match!] : []
}

/**
 * Crea match casuale con validazione input
 */
export async function getRandomMatch(
  leagueId: string | null = null,
  excludeTeamIds: bigint[] = [],
  difficulty: number = 1
): Promise<{
  success: boolean
  match: null | {
    team1: { id: bigint; name: string; logoUrl: string | null }
    team2: { id: bigint; name: string; logoUrl: string | null }
    player: { name: string }
    team1Seasons: number[]
    team2Seasons: number[]
  }
  error: string | null
  isFallback?: boolean
}> {
  // Validazione input - permette null (nessun filtro), stringhe vuote, e stringhe fino a 20 char
  if (leagueId !== null && leagueId !== '' && leagueId.length > 20) {
    return { success: false, match: null, error: 'League ID non valido' }
  }

  if (difficulty < 1 || difficulty > 3) {
    difficulty = 1
  }

  // Definisci l'operazione RPC
  const rpcOperation = async () => {
    // Chiamata RPC con timeout
    const rpcCall = supabase.rpc('get_random_match', {
      p_league_id: leagueId || null,
      p_recent_teams: excludeTeamIds.length > 0 ? excludeTeamIds : undefined,
      p_difficulty: difficulty
    })

    // await su una Promise che resuelve dopo TIMEOUT_MS per il timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout RPC')), TIMEOUT_MS)
    )

    const response = await Promise.race([rpcCall, timeoutPromise]) as any

    // Mappa risultato con type assertion per proprietà dinamiche RPC
    const match = {
      team1: { id: response.team1_id ?? 0n, name: response.team1_name ?? '', logoUrl: response.team1_logo ?? null },
      team2: { id: response.team2_id ?? 0n, name: response.team2_name ?? '', logoUrl: response.team2_logo ?? null },
      player: { name: response.player_name ?? '' },
      team1Seasons: response.team1_seasons || [],
      team2Seasons: response.team2_seasons || []
    }

    // Controllo: almeno un team deve essere valido
    if (!match.team1 || !match.team2) {
      throw new Error('Nessun giocatore valido trovato tra i team selezionati')
    }

    return match
  }

  try {
    // Esegui con circuit breaker
    const match = await rpcCircuitBreaker.execute(rpcOperation)
    return { success: true, match, error: null }
  } catch (error: any) {
    // Logga l'errore
    await logRpcError('get_random_match', error, {
      league_id: leagueId,
      difficulty,
      exclude_team_ids: excludeTeamIds.map(String),
    })

    // Se il circuit breaker ha restituito un fallback
    if (error?.isFallback) {
      return {
        success: true,
        match: error.match,
        error: 'Usato match pre-generato per problemi di connessione',
        isFallback: true
      }
    }

    // Formatta errore friendly
    return {
      success: false,
      match: null,
      error: formatRpcError(error)
    }
  }
}

/**
 * Cerca giocatore per validazione (non per ricerca user)
 * Questa funzione è usata per validare che un giocatore esiste
 */
export async function validatePlayerName(
  teamAId: bigint,
  teamBId: bigint,
  name: string
): Promise<{
  success: boolean
  result: {
    valid: boolean
    player_name: string | null
    similarity_score: number
    player_id: string | null
    team_a_seasons: number[]
    team_b_seasons: number[]
  } | null
  error: string | null
}> {
  // Validazione input
  if (teamAId === 0n || teamBId === 0n) {
    return { success: false, result: null, error: 'Team ID non validi' }
  }

  // Sanitizza name
  let sanitized = name
    .replace(/["'\\;]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .trim()

  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100)
  }

  if (sanitized.length === 0) {
    return { success: false, result: null, error: 'Nome giocatore vuoto' }
  }

  try {
    // Converti bigint in string per la RPC call
    const result = await supabase.rpc('validate_player_intersection', {
      team_a_id: teamAId.toString(),
      team_b_id: teamBId.toString(),
      input_name: sanitized
    }) as any[] | null

    if (Array.isArray(result) && result.length > 0) {
      const r = result[0]
      return {
        success: true,
        result: {
          valid: r.valid || false,
          player_name: r.player_name || null,
          similarity_score: r.similarity_score || 0,
          player_id: r.player_id || null,
          team_a_seasons: r.team_a_seasons || [],
          team_b_seasons: r.team_b_seasons || []
        },
        error: null
      }
    }

    return { success: false, result: null, error: 'Giocatore non trovato' }
  } catch (error) {
    return {
      success: false,
      result: null,
      error: formatRpcError(error)
    }
  }
}

/**
 * Ottieni il tuo profilo utente
 */
export async function getCurrentProfile(): Promise<{
  success: boolean
  profile: null | {
    firstName: string
    lastName: string
    totalScore: number
    matchesPlayed: number
    matchesWon: number
  }
  error: string | null
}> {
  try {
    const { data, error } = await supabase.from('profiles').select('*').single()

    if (error) {
      throw error
    }

    return {
      success: true,
      profile: {
        firstName: data?.first_name || '',
        lastName: data?.last_name || '',
        totalScore: data?.total_score || 0,
        matchesPlayed: data?.matches_played || 0,
        matchesWon: data?.matches_won || 0
      },
      error: null
    }
  } catch (error) {
    return {
      success: false,
      profile: null,
      error: formatRpcError(error)
    }
  }
}

/**
 * Verifica se un utente è loggato
 */
export async function isLoggedIn(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  return !!session
}

/**
 * Aggiorna il profilo utente
 */
export async function updateProfile(
  firstName: string,
  lastName: string,
  birthDate?: string,
  favoriteTeam?: string,
  privacyAccepted?: boolean,
  avatarUrl?: string | null
): Promise<{
  success: boolean
  error: string | null
}> {
  // Validazione
  if (!firstName || firstName.length < 2) {
    return { success: false, error: 'Nome non valido' }
  }
  if (!lastName || lastName.length < 2) {
    return { success: false, error: 'Cognome non valido' }
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate || null,
        favorite_team: favoriteTeam || null,
        privacy_accepted: privacyAccepted ?? false,
        avatar_url: avatarUrl || null
      })
      .eq('id', supabase.auth.user()?.id)

    if (error) {
      throw error
    }

    return { success: true, error: null }
  } catch (error) {
    return {
      success: false,
      error: formatRpcError(error)
    }
  }
}

// =====================================================
// LEADERBOARD E CLASSIFICHE
// =====================================================

/**
 * Ottieni la classifica globale
 */
export async function getLeaderboard(
  limit: number = 100,
  tier?: string | null
): Promise<{
  success: boolean
  entries: Array<{
    rank: number
    userId: string
    displayName: string
    totalScore: number
    tier: string
    matchesPlayed: number
    matchesWon: number
    winRate: number
  }>
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

    return {
      success: true,
      entries: data?.map((entry: any) => ({
        rank: entry.rank,
        userId: entry.user_id,
        displayName: entry.display_name,
        totalScore: entry.total_score,
        tier: entry.tier,
        matchesPlayed: entry.matches_played,
        matchesWon: entry.matches_won,
        winRate: entry.win_rate
      })) || [],
      error: null
    }
  } catch (error) {
    return {
      success: false,
      entries: [],
      error: formatRpcError(error)
    }
  }
}

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
  difficulty: number = 1
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
      p_difficulty: difficulty
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

/**
 * Ottieni lo storico partite dell'utente
 */
export async function getMatchHistory(limit: number = 20): Promise<{
  success: boolean
  matches: Array<{
    id: string
    playerName: string
    opponentName: string
    playerScore: number
    opponentScore: number
    isWin: boolean
    playedAt: string
  }>
  error: string | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, matches: [], error: 'Utente non autenticato' }
    }

    const { data, error } = await supabase
      .from('matches_history')
      .select('*')
      .eq('user_id', user.id)
      .order('played_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return {
      success: true,
      matches: data?.map((m: any) => ({
        id: m.id,
        playerName: m.player_name,
        opponentName: m.opponent_name,
        playerScore: m.player_score,
        opponentScore: m.opponent_score,
        isWin: m.is_win,
        playedAt: m.played_at
      })) || [],
      error: null
    }
  } catch (error) {
    return {
      success: false,
      matches: [],
      error: formatRpcError(error)
    }
  }
}

export {
  // Re-export utility functions for convenience
  isValidTeamId,
  isValidLeagueId,
  sanitizePlayerSearch,
  isTeamExcluded,
  withTimeout
} from '../utils'

// Type exports
export type { PlayerSearchResult } from '../types'