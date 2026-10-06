/**
 * Shop API (Milestone 9)
 *
 * Catalogo oggetti acquistabili con coins (badge cosmetici + temi colore
 * profilo), acquisto atomico, attivazione tema già posseduto.
 */

import { supabase } from '../supabase'
import { formatRpcError } from '../../utils'

export type ShopItemCategory = 'badge' | 'theme'

export interface ShopItem {
  code: string
  label: string
  description: string
  icon: string
  cost: number
  category: ShopItemCategory
  colorHex: string | null
  owned: boolean
  purchasedAt: string | null
}

/**
 * Catalogo completo shop per un utente, con stato posseduto/non posseduto.
 */
export async function getShopCatalog(userId: string): Promise<ShopItem[]> {
  try {
    const { data, error } = await supabase.rpc('get_shop_catalog', { p_user_id: userId })

    if (error) throw error
    if (!data) return []

    return (data as any[]).map((row) => ({
      code: row.code,
      label: row.label,
      description: row.description,
      icon: row.icon,
      cost: row.cost,
      category: row.category,
      colorHex: row.color_hex || null,
      owned: row.owned,
      purchasedAt: row.purchased_at || null
    }))
  } catch (error) {
    console.error('Error getting shop catalog:', error)
    return []
  }
}

/**
 * Acquista un oggetto dello shop. Atomico lato server (nessun saldo
 * negativo, nessun doppio acquisto) — il client riceve solo l'esito.
 */
export async function purchaseShopItem(userId: string, itemCode: string): Promise<{
  success: boolean
  message: string
  newBalance: number | null
  error: string | null
}> {
  try {
    const { data, error } = await supabase.rpc('purchase_shop_item', {
      p_user_id: userId,
      p_item_code: itemCode
    })

    if (error) throw error

    if (data && data.length > 0) {
      return {
        success: data[0].success,
        message: data[0].message,
        newBalance: data[0].new_balance,
        error: null
      }
    }

    return { success: false, message: 'Errore acquisto', newBalance: null, error: null }
  } catch (error) {
    return { success: false, message: '', newBalance: null, error: formatRpcError(error) }
  }
}

/**
 * Attiva un tema colore già posseduto (non lo acquista). Ritorna false se
 * non posseduto, inesistente, o non è un tema.
 */
export async function setActiveTheme(userId: string, itemCode: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('set_active_theme', {
      p_user_id: userId,
      p_item_code: itemCode
    })

    if (error) throw error
    return data === true
  } catch (error) {
    console.error('Error setting active theme:', error)
    return false
  }
}
