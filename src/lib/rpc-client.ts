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
 * Mappa league text (da friend_challenges) a league ID numerico (per get_random_match)
 */
export const LEAGUE_TEXT_TO_ID: Record<string, number> = {
  'seria_a': 135,
  'premier': 39,
  'la_liga': 140,
  'bundesliga': 78,
  'ligue_1': 61
}

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
 * Ottieni la classifica settimanale
 */
export async function getWeeklyLeaderboard(
  limit: number = 100
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
    const { data, error } = await supabase.rpc('get_weekly_leaderboard', {
      p_limit: limit
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
 * Ottieni la classifica mensile
 */
export async function getMonthlyLeaderboard(
  limit: number = 100
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
    const { data, error } = await supabase.rpc('get_monthly_leaderboard', {
      p_limit: limit
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

/**
 * Ottieni informazioni utente per ID (per visualizzare nickname avversario)
 */
export async function getUserInfo(userId: string): Promise<{
  success: boolean
  user: null | {
    id: string
    nickname: string | null
    firstName: string | null
    lastName: string | null
    tier: string | null
    totalScore: number
  }
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_user_info', {
      p_user_id: userId
    })

    console.log('getUserInfo RPC result:', { data, error, userId, isArray: Array.isArray(data), hasData: !!data });

    if (error) {
      throw error
    }

    // Handle empty result - data could be an empty array or empty object
    if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && Object.keys(data).length === 0)) {
      console.log('getUserInfo - empty data, will use fallback');
      return { success: false, user: null, error: 'Utente non trovato' }
    }

    // Get the first row if data is an array
    const row = Array.isArray(data) ? data[0] : data;

    return {
      success: true,
      user: {
        id: row.id,
        nickname: row.nickname,
        firstName: row.first_name,
        lastName: row.last_name,
        tier: row.tier,
        totalScore: row.total_score
      },
      error: null
    }
  } catch (error) {
    return {
      success: false,
      user: null,
      error: formatRpcError(error)
    }
  }
}

// =====================================================
// RATE LIMITING LOGIN
// =====================================================

/**
 * Verifica se un'email è bloccata per troppi tentativi di login
 */
export async function checkEmailLocked(email: string): Promise<{
  locked: boolean
  remainingSeconds: number
}> {
  try {
    const { data, error } = await supabase.rpc('is_email_locked', {
      p_email: email
    })

    if (error) throw error

    const remainingResult = await supabase.rpc('get_login_lockout_remaining', {
      p_email: email
    })

    return {
      locked: data || false,
      remainingSeconds: remainingResult.data || 0
    }
  } catch (error) {
    // In caso di errore, permetti il login (fail open)
    console.error('Rate limit check failed:', error)
    return { locked: false, remainingSeconds: 0 }
  }
}

/**
 * Verifica se un IP è bloccato per troppi tentativi di login
 */
export async function checkIpLocked(ip: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_ip_locked', {
      p_ip: ip
    })

    if (error) throw error

    return data || false
  } catch (error) {
    // In caso di errore, permetti il login (fail open)
    console.error('IP rate limit check failed:', error)
    return false
  }
}

/**
 * Registra un tentativo di login (fallito o riuscito)
 */
export async function recordLoginAttempt(
  email: string,
  ip: string,
  success: boolean
): Promise<void> {
  try {
    await supabase.rpc('record_login_attempt', {
      p_email: email,
      p_ip: ip,
      p_success: success
    })
  } catch (error) {
    // Non blocchiamo il flusso se la registrazione fallisce
    console.error('Failed to record login attempt:', error)
  }
}

// =====================================================
// AUDIT LOGGING
// =====================================================

/**
 * Registra un evento di audit (auth, game, profile)
 */
export async function recordAuditEvent(
  userId: string | null,
  eventType: string,
  eventCategory: 'auth' | 'game' | 'profile' | 'admin',
  description?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabase.rpc('record_audit_event', {
      p_user_id: userId,
      p_event_type: eventType,
      p_event_category: eventCategory,
      p_description: description || null,
      p_metadata: metadata ? JSON.stringify(metadata) : '{}',
      p_ip_address: null,
      p_user_agent: null
    })
  } catch (error) {
    // Non blocchiamo il flusso se il logging fallisce
    console.error('Failed to record audit event:', error)
  }
}

/**
 * Registra evento di autenticazione
 */
export async function recordAuthAudit(
  userId: string | null,
  eventType: 'login' | 'logout' | 'login_failed' | 'password_change',
  email: string,
  success: boolean = true
): Promise<void> {
  await recordAuditEvent(
    userId,
    eventType,
    'auth',
    `Auth event: ${eventType}`,
    { email, success }
  )
}

/**
 * Registra evento di gioco
 */
export async function recordGameAudit(
  userId: string,
  eventType: 'match_started' | 'match_won' | 'match_lost' | 'match_abandoned',
  matchId?: string,
  score?: number,
  metadata?: Record<string, any>
): Promise<void> {
  await recordAuditEvent(
    userId,
    eventType,
    'game',
    `Game event: ${eventType}`,
    { match_id: matchId, score, ...metadata }
  )
}

// =====================================================
// DATA RETENTION (Admin)
// =====================================================

/**
 * Ottieni statistiche retention (quanti record saranno cancellati)
 */
export async function getRetentionStats(): Promise<{
  success: boolean
  stats: Array<{
    table_name: string
    current_records: number
    records_to_delete: number
    retention_days: number
    oldest_record: string
    newest_record: string
  }>
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_retention_stats')

    if (error) throw error

    return {
      success: true,
      stats: data || [],
      error: null
    }
  } catch (error) {
    return {
      success: false,
      stats: [],
      error: formatRpcError(error)
    }
  }
}

/**
 * Esegui cleanup manuale (solo per admin)
 */
export async function runRetentionCleanup(): Promise<{
  success: boolean
  results: Array<{ cleanup_name: string; rows_deleted: number }>
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('run_retention_cleanup')

    if (error) throw error

    return {
      success: true,
      results: data || [],
      error: null
    }
  } catch (error) {
    return {
      success: false,
      results: [],
      error: formatRpcError(error)
    }
  }
}

// =====================================================
// SFIDE EXPRESS (Challenge Links)
// =====================================================

/**
 * Crea una nuova sfida e restituisce il link
 */
export async function createChallenge(): Promise<{
  success: boolean
  challengeId: string | null
  token: string | null
  challengeUrl: string | null
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('create_challenge')

    if (error) throw error

    if (data && data.length > 0) {
      return {
        success: true,
        challengeId: data[0].challenge_id,
        token: data[0].token,
        challengeUrl: data[0].challenge_url,
        error: null
      }
    }

    return {
      success: false,
      challengeId: null,
      token: null,
      challengeUrl: null,
      error: 'Errore nella creazione della sfida'
    }
  } catch (error) {
    return {
      success: false,
      challengeId: null,
      token: null,
      challengeUrl: null,
      error: formatRpcError(error)
    }
  }
}

/**
 * Accetta una sfida tramite token
 */
export async function acceptChallenge(token: string): Promise<{
  success: boolean
  challengeId: string | null
  message: string
  roomId: string | null
  creatorId: string | null
  creatorNickname: string | null
  creatorTier: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('accept_challenge', { p_token: token })

    if (error) throw error

    if (data && data.length > 0) {
      return {
        success: data[0].success,
        challengeId: data[0].challenge_id,
        message: data[0].message,
        roomId: data[0].room_id,
        creatorId: data[0].creator_id,
        creatorNickname: data[0].creator_nickname,
        creatorTier: data[0].creator_tier
      }
    }

    return {
      success: false,
      challengeId: null,
      message: 'Errore sconosciuto',
      roomId: null,
      creatorId: null,
      creatorNickname: null,
      creatorTier: null
    }
  } catch (error) {
    return {
      success: false,
      challengeId: null,
      message: formatRpcError(error),
      roomId: null,
      creatorId: null,
      creatorNickname: null,
      creatorTier: null
    }
  }
}

/**
 * Rifiuta una sfida
 */
export async function declineChallenge(token: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('decline_challenge', { p_token: token })

    if (error) throw error

    return data || false
  } catch (error) {
    console.error('Decline challenge error:', error)
    return false
  }
}

/**
 * Ottieni i dettagli pubblici di una sfida (senza login)
 */
export async function getChallengeByToken(token: string): Promise<{
  id: string | null
  creatorId: string | null
  creatorName: string | null
  status: string | null
  roomId: string | null
  opponentId: string | null
  opponentName: string | null
  opponentTier: string | null
  createdAt: string | null
  expiresAt: string | null
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_challenge_by_token', { p_token: token })

    if (error) throw error

    if (data && data.length > 0) {
      return {
        id: data[0].id,
        creatorId: data[0].creator_id,
        creatorName: data[0].creator_name,
        status: data[0].status,
        roomId: data[0].room_id,
        opponentId: data[0].opponent_id,
        opponentName: data[0].opponent_name,
        opponentTier: data[0].opponent_tier,
        createdAt: data[0].created_at,
        expiresAt: data[0].expires_at,
        error: null
      }
    }

    return {
      id: null,
      creatorId: null,
      creatorName: null,
      status: null,
      roomId: null,
      opponentId: null,
      opponentName: null,
      opponentTier: null,
      createdAt: null,
      expiresAt: null,
      error: 'Sfida non trovata'
    }
  } catch (error) {
    return {
      id: null,
      creatorId: null,
      creatorName: null,
      status: null,
      roomId: null,
      opponentId: null,
      opponentName: null,
      opponentTier: null,
      createdAt: null,
      expiresAt: null,
      error: formatRpcError(error)
    }
  }
}

/**
 * Ottieni le sfide dell'utente (create e ricevute)
 */
export async function getMyChallenges(): Promise<{
  success: boolean
  challenges: Array<{
    id: string
    creatorName: string
    status: string
    createdAt: string
    opponentName: string | null
    isCreator: boolean
  }>
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_my_challenges')

    if (error) throw error

    return {
      success: true,
      challenges: data || [],
      error: null
    }
  } catch (error) {
    return {
      success: false,
      challenges: [],
      error: formatRpcError(error)
    }
  }
}

/**
 * Ottieni la sfida attiva del creatore (per polling)
 */
export async function getMyActiveChallenge(): Promise<{
  success: boolean
  challenge: null | {
    id: string
    roomId: string | null
    status: string
    opponentName: string | null
    opponentTier: string | null
    opponentId: string | null
  }
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_my_active_challenge')

    if (error) throw error

    if (data && data.length > 0) {
      return {
        success: true,
        challenge: {
          id: data[0].id,
          roomId: data[0].room_id,
          status: data[0].status,
          opponentName: data[0].opponent_name,
          opponentTier: data[0].opponent_tier,
          opponentId: data[0].opponent_id
        },
        error: null
      }
    }

    return {
      success: true,
      challenge: null,
      error: null
    }
  } catch (error) {
    return {
      success: false,
      challenge: null,
      error: formatRpcError(error)
    }
  }
}

/**
 * Debug: visualizza le sfide dell'utente corrente
 */
export async function debugChallenges(): Promise<{
  success: boolean
  challenges: Array<{
    id: string
    creatorId: string
    creatorName: string | null
    opponentId: string | null
    status: string
    roomId: string | null
    createdAt: string
  }>
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('debug_my_challenges')

    if (error) throw error

    return {
      success: true,
      challenges: data?.map((c: any) => ({
        id: c.id,
        creatorId: c.creator_id,
        creatorName: c.creator_name,
        opponentId: c.opponent_id,
        status: c.status,
        roomId: c.room_id,
        createdAt: c.created_at
      })) || [],
      error: null
    }
  } catch (error) {
    return {
      success: false,
      challenges: [],
      error: formatRpcError(error)
    }
  }
}

/**
 * Completa una sfida (mark as completed after game ends)
 */
export async function completeChallenge(challengeId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('complete_challenge', { p_challenge_id: challengeId })

    if (error) throw error

    return data || false
  } catch (error) {
    return false
  }
}

/**
 * Marca una sfida come expired (quando la partita finisce)
 */
export async function expireChallenge(challengeId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('expire_challenge', { p_challenge_id: challengeId })

    if (error) throw error

    return data || false
  } catch (error) {
    return false
  }
}

// =====================================================
// SISTEMA AMICIZIE
// =====================================================

/**
 * Cerca utenti per nickname
 */
export async function searchUsers(nickname: string): Promise<{
  success: boolean
  users: Array<{
    id: string
    nickname: string | null
    firstName: string | null
    tier: string
    totalScore: number
  }>
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('search_users', { p_nickname: nickname })

    if (error) throw error

    return {
      success: true,
      users: data?.map((u: any) => ({
        id: u.id,
        nickname: u.nickname,
        firstName: u.first_name,
        tier: u.tier,
        totalScore: u.total_score
      })) || [],
      error: null
    }
  } catch (error) {
    return {
      success: false,
      users: [],
      error: formatRpcError(error)
    }
  }
}

/**
 * Invia richiesta di amicizia
 */
export async function sendFriendRequest(toUserId: string): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('send_friend_request', { p_to_user_id: toUserId })

    if (error) throw error

    return { success: data || false, error: null }
  } catch (error) {
    return { success: false, error: formatRpcError(error) }
  }
}

/**
 * Accetta richiesta di amicizia
 */
export async function acceptFriendRequest(requestId: string): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('accept_friend_request', { p_request_id: requestId })

    if (error) throw error

    return { success: data || false, error: null }
  } catch (error) {
    return { success: false, error: formatRpcError(error) }
  }
}

/**
 * Rifiuta richiesta di amicizia
 */
export async function rejectFriendRequest(requestId: string): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('reject_friend_request', { p_request_id: requestId })

    if (error) throw error

    return { success: data || false, error: null }
  } catch (error) {
    return { success: false, error: formatRpcError(error) }
  }
}

/**
 * Rimuovi amico
 */
export async function removeFriend(friendId: string): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utente non autenticato');

    console.log('Removing friend:', user.id, friendId);

    // Elimina amicizia in entrambe le direzioni
    const { error: friendsError } = await supabase
      .from('friends')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)

    console.log('Friends delete error:', friendsError);
    if (friendsError) throw friendsError

    // Elimina TUTTE le richieste di amicizia tra i due utenti (any status)
    const { error: requestsError } = await supabase
      .from('friend_requests')
      .delete()
      .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${user.id})`)

    console.log('Requests delete error:', requestsError);
    if (requestsError) throw requestsError

    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: formatRpcError(error) }
  }
}

/**
 * Ottieni lista amici
 */
export async function getFriends(): Promise<{
  success: boolean
  friends: Array<{
    id: string
    friendId: string
    nickname: string | null
    firstName: string | null
    tier: string
    totalScore: number
    isOnline: boolean
    lastLogin: string | null
  }>
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_friends')

    if (error) throw error

    return {
      success: true,
      friends: data?.map((f: any) => ({
        id: f.id,
        friendId: f.friend_id,
        nickname: f.nickname,
        firstName: f.first_name,
        tier: f.tier,
        totalScore: f.total_score,
        isOnline: f.is_online,
        lastLogin: f.last_login
      })) || [],
      error: null
    }
  } catch (error) {
    return {
      success: false,
      friends: [],
      error: formatRpcError(error)
    }
  }
}

/**
 * Ottieni richieste di amicizia ricevute (pending)
 */
export async function getPendingFriendRequests(): Promise<{
  success: boolean
  requests: Array<{
    id: string
    fromUserId: string
    nickname: string | null
    firstName: string | null
    tier: string
    createdAt: string
  }>
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_pending_friend_requests')

    if (error) throw error

    return {
      success: true,
      requests: data?.map((r: any) => ({
        id: r.id,
        fromUserId: r.from_user_id,
        nickname: r.nickname,
        firstName: r.first_name,
        tier: r.tier,
        createdAt: r.created_at
      })) || [],
      error: null
    }
  } catch (error) {
    return {
      success: false,
      requests: [],
      error: formatRpcError(error)
    }
  }
}

/**
 * Verifica se due utenti sono amici
 */
export async function areFriends(otherUserId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('are_friends', { p_other_user_id: otherUserId })

    if (error) throw error

    return data || false
  } catch (error) {
    return false
  }
}

// =====================================================
// STATISTICHE AVANZATE
// =====================================================

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

// =====================================================
// Statistiche Avanzate con Grafici (Milestone 12)
// =====================================================

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

// =====================================================
// SFIDE TRA AMICI (Milestone 6c)
// =====================================================

export interface FriendChallenge {
  id: string
  creator_id: string
  creator_nickname: string
  creator_tier: string
  opponent_id: string
  opponent_nickname: string
  opponent_tier: string
  room_id: string
  difficulty: number
  league: string
  status: string
  created_at: string
  expires_at: string
}

export interface FriendChallengeHistory {
  id: string
  challenge_id: string
  opponent_id: string
  opponent_nickname: string
  opponent_tier: string
  difficulty: number
  league: string
  result: string
  score: number
  created_at: string
}

/**
 * Crea sfida tra amici
 */
export async function createFriendChallenge(
  opponentId: string,
  difficulty: number = 1,
  league: string = 'seria_a'
): Promise<{
  success: boolean
  challengeId: string | null
  roomId: string | null
  expiresAt: string | null
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('create_friend_challenge', {
      p_opponent_id: opponentId,
      p_difficulty: difficulty,
      p_league: league
    })

    if (error) throw error

    if (data && data.length > 0) {
      return {
        success: true,
        challengeId: data[0].challenge_id,
        roomId: data[0].room_id,
        expiresAt: data[0].expires_at,
        error: null
      }
    }

    return {
      success: false,
      challengeId: null,
      roomId: null,
      expiresAt: null,
      error: 'Errore nella creazione della sfida'
    }
  } catch (error) {
    return {
      success: false,
      challengeId: null,
      roomId: null,
      expiresAt: null,
      error: formatRpcError(error)
    }
  }
}

/**
 * Accetta sfida tra amici
 */
export async function acceptFriendChallenge(challengeId: string): Promise<{
  success: boolean
  challengeId: string | null
  roomId: string | null
  creatorId: string | null
  creatorNickname: string | null
  creatorTier: string | null
  difficulty: number | null
  league: string | null
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('accept_friend_challenge', {
      p_challenge_id: challengeId
    })

    if (error) throw error

    if (data && data.length > 0) {
      return {
        success: true,
        challengeId: data[0].challenge_id,
        roomId: data[0].room_id,
        creatorId: data[0].creator_id,
        creatorNickname: data[0].creator_nickname,
        creatorTier: data[0].creator_tier,
        difficulty: data[0].difficulty,
        league: data[0].league,
        error: null
      }
    }

    return {
      success: false,
      challengeId: null,
      roomId: null,
      creatorId: null,
      creatorNickname: null,
      creatorTier: null,
      difficulty: null,
      league: null,
      error: 'Sfida non trovata'
    }
  } catch (error) {
    return {
      success: false,
      challengeId: null,
      roomId: null,
      creatorId: null,
      creatorNickname: null,
      creatorTier: null,
      difficulty: null,
      league: null,
      error: formatRpcError(error)
    }
  }
}

/**
 * Rifiuta sfida tra amici
 */
export async function declineFriendChallenge(challengeId: string): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('decline_friend_challenge', {
      p_challenge_id: challengeId
    })

    if (error) throw error

    return { success: data || false, error: null }
  } catch (error) {
    return { success: false, error: formatRpcError(error) }
  }
}

/**
 * Ottieni sfide in attesa
 */
export async function getPendingFriendChallenges(): Promise<{
  success: boolean
  challenges: FriendChallenge[]
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_pending_friend_challenges')

    if (error) throw error

    return {
      success: true,
      challenges: data || [],
      error: null
    }
  } catch (error) {
    return {
      success: false,
      challenges: [],
      error: formatRpcError(error)
    }
  }
}

/**
 * Ottieni storico sfide
 */
export async function getFriendChallengeHistory(): Promise<{
  success: boolean
  history: FriendChallengeHistory[]
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('get_friend_challenge_history')

    if (error) throw error

    return {
      success: true,
      history: data || [],
      error: null
    }
  } catch (error) {
    return {
      success: false,
      history: [],
      error: formatRpcError(error)
    }
  }
}

/**
 * Ottieni sfida amico per room_id (per ChallengeScreen)
 */
export async function getFriendChallengeByRoomId(roomId: string): Promise<{
  success: boolean
  challenge: {
    id: string
    creator_id: string
    creator_nickname: string
    creator_tier: string
    opponent_id: string
    opponent_nickname: string
    opponent_tier: string
    difficulty: number
    league: string
    status: string
    room_id: string
    created_at: string
  } | null
  error: string | null
}> {
  try {
    // Query friend_challenges table directly
    const { data: challengeData, error } = await supabase
      .from('friend_challenges')
      .select('id, creator_id, opponent_id, difficulty, league, status, room_id, created_at')
      .eq('room_id', roomId)
      .single()

    if (error) throw error

    if (challengeData) {
      // Get creator profile
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('nickname, tier, first_name')
        .eq('id', challengeData.creator_id)
        .single()

      // Get opponent profile
      const { data: opponentProfile } = await supabase
        .from('profiles')
        .select('nickname, tier, first_name')
        .eq('id', challengeData.opponent_id)
        .single()

      return {
        success: true,
        challenge: {
          id: challengeData.id,
          creator_id: challengeData.creator_id,
          creator_nickname: creatorProfile?.nickname || creatorProfile?.first_name || 'Sfidante',
          creator_tier: creatorProfile?.tier || 'bronze',
          opponent_id: challengeData.opponent_id,
          opponent_nickname: opponentProfile?.nickname || opponentProfile?.first_name || 'Avversario',
          opponent_tier: opponentProfile?.tier || 'bronze',
          difficulty: challengeData.difficulty,
          league: challengeData.league,
          status: challengeData.status,
          room_id: challengeData.room_id,
          created_at: challengeData.created_at
        },
        error: null
      }
    }

    return { success: true, challenge: null, error: null }
  } catch (error) {
    return {
      success: false,
      challenge: null,
      error: formatRpcError(error)
    }
  }
}

/**
 * Completa sfida amici (salva risultato)
 */
export async function completeFriendChallenge(
  challengeId: string,
  winnerId: string,
  creatorScore: number,
  opponentScore: number
): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('complete_friend_challenge', {
      p_challenge_id: challengeId,
      p_winner_id: winnerId,
      p_creator_score: creatorScore,
      p_opponent_score: opponentScore
    })

    if (error) throw error

    return { success: data || false, error: null }
  } catch (error) {
    return { success: false, error: formatRpcError(error) }
  }
}

/**
 * Abbandona sfida amici
 */
export async function abandonFriendChallenge(challengeId: string): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('abandon_friend_challenge', {
      p_challenge_id: challengeId
    })

    if (error) throw error

    return { success: data || false, error: null }
  } catch (error) {
    return { success: false, error: formatRpcError(error) }
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