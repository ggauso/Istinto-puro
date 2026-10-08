/**
 * Sfide tra Amici API (Milestone 6c)
 *
 * Sfida diretta a un amico dalla lista amici, senza link da condividere.
 */

import { supabase } from '../supabase'
import { formatRpcError } from '../../utils'

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
      // Get creator/opponent public info (nickname only)
      const [creatorRes, opponentRes] = await Promise.all([
        supabase.rpc('get_user_info', { p_user_id: challengeData.creator_id }),
        supabase.rpc('get_user_info', { p_user_id: challengeData.opponent_id }),
      ])
      const creatorProfile = creatorRes.data?.[0]
      const opponentProfile = opponentRes.data?.[0]

      return {
        success: true,
        challenge: {
          id: challengeData.id,
          creator_id: challengeData.creator_id,
          creator_nickname: creatorProfile?.nickname || 'Sfidante',
          creator_tier: creatorProfile?.tier || 'bronze',
          opponent_id: challengeData.opponent_id,
          opponent_nickname: opponentProfile?.nickname || 'Avversario',
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
