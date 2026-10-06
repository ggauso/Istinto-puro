/**
 * Test suite per getFriendsLeaderboard (Milestone 11 - Classifiche Amici)
 * in src/lib/api/leaderboard.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';

const mockRpc = supabase.rpc as any;

// setup.ts non mocka supabase.auth.getUser (nessun test esistente lo
// esercita) — lo aggiungiamo qui, seguendo il pattern di getUserRank/
// saveMatchResult che leggono l'utente corrente prima di chiamare la RPC.
const mockGetUser = vi.fn();
(supabase.auth as any).getUser = mockGetUser;

describe('getFriendsLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chiama la RPC con l\'id dell\'utente autenticato e mappa le entry in camelCase', async () => {
    const { getFriendsLeaderboard } = await import('../lib/api/leaderboard');

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockRpc.mockResolvedValue({
      data: [
        { rank: 1, user_id: 'user-2', display_name: 'Alice', total_score: 500, tier: 'silver', matches_played: 10, matches_won: 6, win_rate: 60 },
        { rank: 2, user_id: 'user-1', display_name: 'Bob', total_score: 100, tier: 'bronze', matches_played: 3, matches_won: 1, win_rate: 33 },
      ],
      error: null
    });

    const result = await getFriendsLeaderboard(50);

    expect(mockRpc).toHaveBeenCalledWith('get_friends_leaderboard', { p_user_id: 'user-1', p_limit: 50 });
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({
      rank: 1,
      userId: 'user-2',
      displayName: 'Alice',
      totalScore: 500,
      tier: 'silver',
      matchesPlayed: 10,
      matchesWon: 6,
      winRate: 60
    });
  });

  it('usa 100 come limite di default quando non specificato', async () => {
    const { getFriendsLeaderboard } = await import('../lib/api/leaderboard');

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockRpc.mockResolvedValue({ data: [], error: null });

    await getFriendsLeaderboard();

    expect(mockRpc).toHaveBeenCalledWith('get_friends_leaderboard', { p_user_id: 'user-1', p_limit: 100 });
  });

  it('ritorna fallimento senza chiamare la RPC quando non c\'è un utente autenticato', async () => {
    const { getFriendsLeaderboard } = await import('../lib/api/leaderboard');

    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await getFriendsLeaderboard();

    expect(result.success).toBe(false);
    expect(result.entries).toEqual([]);
    expect(result.error).toBe('Utente non autenticato');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('ritorna fallimento con array vuoto quando la RPC lancia un errore', async () => {
    const { getFriendsLeaderboard } = await import('../lib/api/leaderboard');

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const result = await getFriendsLeaderboard();

    expect(result.success).toBe(false);
    expect(result.entries).toEqual([]);
  });

  it('ritorna array vuoto quando non ci sono amici in classifica', async () => {
    const { getFriendsLeaderboard } = await import('../lib/api/leaderboard');

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await getFriendsLeaderboard();

    expect(result.success).toBe(true);
    expect(result.entries).toEqual([]);
  });
});

describe('getHardModeLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chiama la RPC senza bisogno di un utente autenticato e mappa le entry in camelCase', async () => {
    const { getHardModeLeaderboard } = await import('../lib/api/leaderboard');

    mockRpc.mockResolvedValue({
      data: [
        { rank: 1, user_id: 'user-2', display_name: 'Alice', total_score: 900, tier: 'gold', matches_played: 8, matches_won: 7, win_rate: 88 },
      ],
      error: null
    });

    const result = await getHardModeLeaderboard(50);

    expect(mockRpc).toHaveBeenCalledWith('get_hard_mode_leaderboard', { p_limit: 50 });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.entries[0]).toEqual({
      rank: 1,
      userId: 'user-2',
      displayName: 'Alice',
      totalScore: 900,
      tier: 'gold',
      matchesPlayed: 8,
      matchesWon: 7,
      winRate: 88
    });
  });

  it('usa 100 come limite di default quando non specificato', async () => {
    const { getHardModeLeaderboard } = await import('../lib/api/leaderboard');

    mockRpc.mockResolvedValue({ data: [], error: null });

    await getHardModeLeaderboard();

    expect(mockRpc).toHaveBeenCalledWith('get_hard_mode_leaderboard', { p_limit: 100 });
  });

  it('ritorna fallimento con array vuoto quando la RPC lancia un errore', async () => {
    const { getHardModeLeaderboard } = await import('../lib/api/leaderboard');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const result = await getHardModeLeaderboard();

    expect(result.success).toBe(false);
    expect(result.entries).toEqual([]);
  });

  it('ritorna array vuoto quando nessuno ha ancora giocato in modalità hard', async () => {
    const { getHardModeLeaderboard } = await import('../lib/api/leaderboard');

    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await getHardModeLeaderboard();

    expect(result.success).toBe(true);
    expect(result.entries).toEqual([]);
  });
});
