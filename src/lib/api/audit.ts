/**
 * Audit Logging API
 *
 * Registrazione eventi (auth, game, profile) sulla tabella `audit_log`
 */

import { supabase } from '../supabase'

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
