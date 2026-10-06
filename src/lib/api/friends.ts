/**
 * Sistema Amicizie API
 *
 * Ricerca utenti, richieste di amicizia, lista amici
 */

import { supabase } from '../supabase'
import { formatRpcError } from '../../utils'

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
    // Usa l'RPC dedicata (SECURITY DEFINER): elimina la riga di amicizia
    // in entrambe le direzioni lato server. La cancellazione diretta dal
    // client (.from('friends').delete()) è soggetta a RLS e cancella solo
    // la riga di proprietà dell'utente corrente, lasciando l'amicizia
    // asimmetrica (l'altro utente continua a vederti come amico).
    const { error } = await supabase.rpc('remove_friend', { p_friend_id: friendId })

    if (error) throw error

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
