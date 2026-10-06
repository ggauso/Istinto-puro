/**
 * Sfide Express API (Challenge Links)
 *
 * Sfide create tramite link pubblico condivisibile (`/sfida/TOKEN`)
 */

import { supabase } from '../supabase'
import { formatRpcError } from '../../utils'

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
