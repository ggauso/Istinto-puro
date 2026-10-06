/**
 * Auth Security API
 *
 * Rate limiting sui tentativi di login (tabella `login_attempts`)
 */

import { supabase } from '../supabase'

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
