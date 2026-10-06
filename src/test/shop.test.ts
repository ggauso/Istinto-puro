/**
 * Test suite per il modulo shop (Milestone 9) — wrapper RPC in
 * src/lib/api/shop.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';

const mockRpc = supabase.rpc as any;

describe('getShopCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mappa il catalogo RPC (snake_case) nella forma camelCase del client', async () => {
    const { getShopCatalog } = await import('../lib/api/shop');

    mockRpc.mockResolvedValue({
      data: [
        { code: 'badge_star', label: 'Stella', description: 'Badge stella', icon: '⭐', cost: 50, category: 'badge', color_hex: null, owned: true, purchased_at: '2026-10-06T12:00:00Z' },
        { code: 'theme_gold', label: 'Tema Oro', description: 'Accento oro', icon: '🎨', cost: 200, category: 'theme', color_hex: '#FFD700', owned: false, purchased_at: null },
      ],
      error: null
    });

    const result = await getShopCatalog('user-1');

    expect(mockRpc).toHaveBeenCalledWith('get_shop_catalog', { p_user_id: 'user-1' });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      code: 'badge_star',
      label: 'Stella',
      description: 'Badge stella',
      icon: '⭐',
      cost: 50,
      category: 'badge',
      colorHex: null,
      owned: true,
      purchasedAt: '2026-10-06T12:00:00Z'
    });
    expect(result[1].colorHex).toBe('#FFD700');
    expect(result[1].owned).toBe(false);
  });

  it('ritorna array vuoto quando la RPC fallisce', async () => {
    const { getShopCatalog } = await import('../lib/api/shop');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const result = await getShopCatalog('user-1');

    expect(result).toEqual([]);
  });
});

describe('purchaseShopItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ritorna successo e nuovo saldo quando la RPC conferma l\'acquisto', async () => {
    const { purchaseShopItem } = await import('../lib/api/shop');

    mockRpc.mockResolvedValue({
      data: [{ success: true, message: 'Acquisto completato', new_balance: 10 }],
      error: null
    });

    const result = await purchaseShopItem('user-1', 'badge_star');

    expect(mockRpc).toHaveBeenCalledWith('purchase_shop_item', { p_user_id: 'user-1', p_item_code: 'badge_star' });
    expect(result).toEqual({ success: true, message: 'Acquisto completato', newBalance: 10, error: null });
  });

  it('ritorna fallimento con messaggio quando il saldo è insufficiente', async () => {
    const { purchaseShopItem } = await import('../lib/api/shop');

    mockRpc.mockResolvedValue({
      data: [{ success: false, message: 'Coins insufficienti', new_balance: 10 }],
      error: null
    });

    const result = await purchaseShopItem('user-1', 'theme_gold');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Coins insufficienti');
    expect(result.newBalance).toBe(10);
  });

  it('ritorna errore formattato quando la RPC lancia un\'eccezione (es. guard auth.uid())', async () => {
    const { purchaseShopItem } = await import('../lib/api/shop');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'Non autorizzato' } });

    const result = await purchaseShopItem('user-1', 'badge_star');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('setActiveTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ritorna true quando il tema viene attivato con successo', async () => {
    const { setActiveTheme } = await import('../lib/api/shop');

    mockRpc.mockResolvedValue({ data: true, error: null });

    const result = await setActiveTheme('user-1', 'theme_gold');

    expect(mockRpc).toHaveBeenCalledWith('set_active_theme', { p_user_id: 'user-1', p_item_code: 'theme_gold' });
    expect(result).toBe(true);
  });

  it('ritorna false quando il tema non è posseduto', async () => {
    const { setActiveTheme } = await import('../lib/api/shop');

    mockRpc.mockResolvedValue({ data: false, error: null });

    const result = await setActiveTheme('user-1', 'theme_gold');

    expect(result).toBe(false);
  });

  it('ritorna false quando la RPC lancia un errore', async () => {
    const { setActiveTheme } = await import('../lib/api/shop');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const result = await setActiveTheme('user-1', 'theme_gold');

    expect(result).toBe(false);
  });
});
