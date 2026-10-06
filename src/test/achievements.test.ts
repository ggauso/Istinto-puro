/**
 * Test suite per il modulo achievements (Milestone 8) — wrapper RPC in
 * src/lib/api/achievements.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';

const mockRpc = supabase.rpc as any;

describe('getUserAchievements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mappa il catalogo RPC (snake_case) nella forma camelCase del client, incluso tier', async () => {
    const { getUserAchievements } = await import('../lib/api/achievements');

    mockRpc.mockResolvedValue({
      data: [
        { code: 'first_win', label: 'Prima vittoria', description: 'Vinci la tua prima partita', icon: 'Trophy', category: 'wins', tier: 'bronze', unlocked: true, unlocked_at: '2026-10-06T12:00:00Z' },
        { code: 'speed', label: 'Fulmine', description: 'Rispondi correttamente in meno di 3 secondi', icon: 'Zap', category: 'skill', tier: 'bronze', unlocked: false, unlocked_at: null },
      ],
      error: null
    });

    const result = await getUserAchievements('user-1');

    expect(mockRpc).toHaveBeenCalledWith('get_user_achievements', { p_user_id: 'user-1' });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      code: 'first_win',
      label: 'Prima vittoria',
      description: 'Vinci la tua prima partita',
      icon: 'Trophy',
      category: 'wins',
      tier: 'bronze',
      unlocked: true,
      unlockedAt: '2026-10-06T12:00:00Z'
    });
    expect(result[1].unlocked).toBe(false);
    expect(result[1].unlockedAt).toBeNull();
  });

  it('ritorna array vuoto quando la RPC fallisce', async () => {
    const { getUserAchievements } = await import('../lib/api/achievements');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const result = await getUserAchievements('user-1');

    expect(result).toEqual([]);
  });

  it('ritorna array vuoto quando data è null senza errore', async () => {
    const { getUserAchievements } = await import('../lib/api/achievements');

    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await getUserAchievements('user-1');

    expect(result).toEqual([]);
  });
});

describe('checkAndUnlockAchievements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ritorna i codici appena sbloccati restituiti dalla RPC', async () => {
    const { checkAndUnlockAchievements } = await import('../lib/api/achievements');

    mockRpc.mockResolvedValue({ data: ['first_win', 'social10'], error: null });

    const result = await checkAndUnlockAchievements('user-1');

    expect(mockRpc).toHaveBeenCalledWith('check_and_unlock_achievements', { p_user_id: 'user-1' });
    expect(result).toEqual(['first_win', 'social10']);
  });

  it('ritorna array vuoto quando nessun achievement si sblocca', async () => {
    const { checkAndUnlockAchievements } = await import('../lib/api/achievements');

    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await checkAndUnlockAchievements('user-1');

    expect(result).toEqual([]);
  });

  it('ritorna array vuoto quando la RPC lancia un errore', async () => {
    const { checkAndUnlockAchievements } = await import('../lib/api/achievements');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'unauthorized' } });

    const result = await checkAndUnlockAchievements('user-1');

    expect(result).toEqual([]);
  });
});

describe('unlockAchievement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('ritorna true quando la RPC conferma un nuovo sblocco', async () => {
    const { unlockAchievement } = await import('../lib/api/achievements');

    mockRpc.mockResolvedValue({ data: true, error: null });

    const result = await unlockAchievement('user-1', 'speed');

    expect(mockRpc).toHaveBeenCalledWith('unlock_achievement', { p_user_id: 'user-1', p_code: 'speed' });
    expect(result).toBe(true);
  });

  it('ritorna false quando l\'achievement era già sbloccato (ON CONFLICT)', async () => {
    const { unlockAchievement } = await import('../lib/api/achievements');

    mockRpc.mockResolvedValue({ data: false, error: null });

    const result = await unlockAchievement('user-1', 'perfect');

    expect(result).toBe(false);
  });

  it('ritorna false quando la RPC lancia un errore (es. codice non in whitelist)', async () => {
    const { unlockAchievement } = await import('../lib/api/achievements');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'not allowed' } });

    const result = await unlockAchievement('user-1', 'speed');

    expect(result).toBe(false);
  });

  it('non richiama la RPC una seconda volta per lo stesso utente+codice nella sessione (dedup via sessionStorage)', async () => {
    const { unlockAchievement } = await import('../lib/api/achievements');

    mockRpc.mockResolvedValue({ data: true, error: null });

    const first = await unlockAchievement('user-1', 'speed_flash');
    expect(first).toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);

    const second = await unlockAchievement('user-1', 'speed_flash');
    expect(second).toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(1); // nessuna seconda chiamata di rete
  });

  it('non deduplica tra utenti diversi', async () => {
    const { unlockAchievement } = await import('../lib/api/achievements');

    mockRpc.mockResolvedValue({ data: true, error: null });

    await unlockAchievement('user-1', 'perfect25');
    await unlockAchievement('user-2', 'perfect25');

    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
