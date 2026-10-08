/**
 * Profile API
 *
 * Lettura/scrittura del profilo utente (tabella `profiles` + RPC `get_user_info`)
 */

import { supabase } from '../supabase'
import { formatRpcError } from '../../utils'

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

/**
 * Ottieni informazioni utente per ID (per visualizzare nickname avversario)
 */
export async function getUserInfo(userId: string): Promise<{
  success: boolean
  user: null | {
    id: string
    nickname: string | null
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
