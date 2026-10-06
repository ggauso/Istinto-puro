/**
 * Achievement API (Milestone 8)
 *
 * Catalogo achievement con stato sblocco/locked, verifica server-truth dopo
 * una partita, sblocco diretto per i quattro eventi osservabili solo a
 * runtime durante il round (risposta veloce/fulminea, streak di risposte
 * corrette).
 */

import { supabase } from '../supabase'
import { Achievement, AchievementCode } from '../../types/game'

type ClientUnlockCode = 'speed' | 'speed_flash' | 'perfect' | 'perfect25'

/**
 * Catalogo completo achievement per un utente, con stato sblocco/locked.
 */
export async function getUserAchievements(userId: string): Promise<Achievement[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_achievements', { p_user_id: userId })

    if (error) throw error
    if (!data) return []

    return (data as any[]).map((row) => ({
      code: row.code,
      label: row.label,
      description: row.description,
      icon: row.icon,
      category: row.category,
      tier: row.tier,
      unlocked: row.unlocked,
      unlockedAt: row.unlocked_at || null
    }))
  } catch (error) {
    console.error('Error getting user achievements:', error)
    return []
  }
}

/**
 * Verifica gli achievement calcolabili da profiles/matches_history/tornei
 * (vittorie, streak, tier, partite PvP/totali, tornei) e sblocca i nuovi.
 * Da chiamare dopo il salvataggio di una partita. Ritorna solo i codici
 * sbloccati in QUESTA chiamata (array vuoto se nessuno).
 */
export async function checkAndUnlockAchievements(userId: string): Promise<AchievementCode[]> {
  try {
    const { data, error } = await supabase.rpc('check_and_unlock_achievements', { p_user_id: userId })

    if (error) throw error
    return (data as AchievementCode[]) || []
  } catch (error) {
    console.error('Error checking achievements:', error)
    return []
  }
}

function attemptedStorageKey(userId: string): string {
  return `achv_attempted:${userId}`
}

function getAttempted(userId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(attemptedStorageKey(userId))
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveAttempted(userId: string, attempted: Set<string>): void {
  try {
    sessionStorage.setItem(attemptedStorageKey(userId), JSON.stringify([...attempted]))
  } catch {
    // sessionStorage non disponibile (privacy mode, ecc.): nessun dedup tra
    // partite in questa sessione, ma la RPC resta comunque idempotente
    // (ON CONFLICT DO NOTHING) — solo qualche chiamata di rete in più.
  }
}

/**
 * Sblocca un achievement osservabile solo lato client durante il round
 * ('speed'/'speed_flash'/'perfect'/'perfect25' — qualsiasi altro codice
 * viene rifiutato dalla RPC). Una volta tentato per un utente in questa
 * sessione browser (sessionStorage, sopravvive al reload pieno di fine
 * partita), non viene più ritentato: evita di richiamare la RPC ad ogni
 * singola risposta corretta dopo il primo sblocco.
 */
export async function unlockAchievement(userId: string, code: ClientUnlockCode): Promise<boolean> {
  const attempted = getAttempted(userId)
  if (attempted.has(code)) return false

  attempted.add(code)
  saveAttempted(userId, attempted)

  try {
    const { data, error } = await supabase.rpc('unlock_achievement', { p_user_id: userId, p_code: code })

    if (error) throw error
    return data === true
  } catch (error) {
    console.error('Error unlocking achievement:', error)
    return false
  }
}
