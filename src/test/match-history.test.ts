/**
 * Test suite per il modulo match-history (Milestone 7, Task 7.3) — wrapper
 * RPC in src/lib/api/match-history.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';

const mockRpc = supabase.rpc as any;

describe('getMatchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mappa le righe RPC e il total_count in una MatchHistoryPage', async () => {
    const { getMatchHistory } = await import('../lib/api/match-history');

    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'm1', opponent_name: 'Rossi', player_tier: 'gold', opponent_tier: 'silver',
          player_score: 1000, opponent_score: 800, is_win: true, is_pvp: true,
          difficulty: 2, played_at: '2026-10-06T12:00:00Z', total_count: 2
        },
        {
          id: 'm2', opponent_name: 'AI', player_tier: 'gold', opponent_tier: 'bronze',
          player_score: 400, opponent_score: 900, is_win: false, is_pvp: false,
          difficulty: 1, played_at: '2026-10-05T10:00:00Z', total_count: 2
        }
      ],
      error: null
    });

    const result = await getMatchHistory('user-1');

    expect(mockRpc).toHaveBeenCalledWith('get_match_history', {
      p_user_id: 'user-1', p_limit: 20, p_offset: 0, p_mode: null, p_result: null
    });
    expect(result.totalCount).toBe(2);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({
      id: 'm1', opponent_name: 'Rossi', player_tier: 'gold', opponent_tier: 'silver',
      player_score: 1000, opponent_score: 800, is_win: true, is_pvp: true,
      difficulty: 2, played_at: '2026-10-06T12:00:00Z'
    });
    // total_count non deve restare nell'oggetto entry (è solo un dettaglio
    // di trasporto della window function, non un campo della partita)
    expect((result.entries[0] as any).total_count).toBeUndefined();
  });

  it('passa limit/offset/mode/result personalizzati alla RPC', async () => {
    const { getMatchHistory } = await import('../lib/api/match-history');

    mockRpc.mockResolvedValue({ data: [], error: null });

    await getMatchHistory('user-1', { limit: 10, offset: 20, mode: 'pvp', result: 'win' });

    expect(mockRpc).toHaveBeenCalledWith('get_match_history', {
      p_user_id: 'user-1', p_limit: 10, p_offset: 20, p_mode: 'pvp', p_result: 'win'
    });
  });

  it('ritorna pagina vuota quando non ci sono partite', async () => {
    const { getMatchHistory } = await import('../lib/api/match-history');

    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await getMatchHistory('user-1');

    expect(result).toEqual({ entries: [], totalCount: 0 });
  });

  it('ritorna pagina vuota quando data è null', async () => {
    const { getMatchHistory } = await import('../lib/api/match-history');

    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await getMatchHistory('user-1');

    expect(result).toEqual({ entries: [], totalCount: 0 });
  });

  it('ritorna pagina vuota quando la RPC fallisce (es. guard auth.uid())', async () => {
    const { getMatchHistory } = await import('../lib/api/match-history');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'Non autorizzato' } });

    const result = await getMatchHistory('user-1');

    expect(result).toEqual({ entries: [], totalCount: 0 });
  });
});
