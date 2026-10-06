/**
 * Test suite per il modulo round-stats (Milestone 7, Task 7.2) — wrapper
 * RPC in src/lib/api/round-stats.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';

const mockRpc = supabase.rpc as any;

describe('recordRoundAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chiama la RPC con i parametri corretti, incluso il tempo di risposta', async () => {
    const { recordRoundAnswer } = await import('../lib/api/round-stats');

    mockRpc.mockResolvedValue({ data: null, error: null });

    await recordRoundAnswer('user-1', 10, 20, 'Mario Rossi', true, 2, 2500);

    expect(mockRpc).toHaveBeenCalledWith('record_round_answer', {
      p_user_id: 'user-1',
      p_team1_id: 10,
      p_team2_id: 20,
      p_player_name: 'Mario Rossi',
      p_is_correct: true,
      p_difficulty: 2,
      p_response_time_ms: 2500
    });
  });

  it('usa null per il tempo di risposta quando non fornito', async () => {
    const { recordRoundAnswer } = await import('../lib/api/round-stats');

    mockRpc.mockResolvedValue({ data: null, error: null });

    await recordRoundAnswer('user-1', 10, 20, 'Mario Rossi', false);

    expect(mockRpc).toHaveBeenCalledWith('record_round_answer', expect.objectContaining({
      p_response_time_ms: null,
      p_difficulty: 1
    }));
  });

  it('non lancia mai (fire-and-forget) anche se la RPC fallisce', async () => {
    const { recordRoundAnswer } = await import('../lib/api/round-stats');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(recordRoundAnswer('user-1', 10, 20, 'Mario Rossi', true)).resolves.toBeUndefined();
  });
});

describe('getCommonTeamCombos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ritorna le combinazioni dalla RPC', async () => {
    const { getCommonTeamCombos } = await import('../lib/api/round-stats');

    mockRpc.mockResolvedValue({
      data: [{ team_a_id: 1, team_a_name: 'Team A', team_b_id: 2, team_b_name: 'Team B', times_played: 5 }],
      error: null
    });

    const result = await getCommonTeamCombos('user-1', 5);

    expect(mockRpc).toHaveBeenCalledWith('get_common_team_combos', { p_user_id: 'user-1', p_limit: 5 });
    expect(result).toHaveLength(1);
    expect(result[0].times_played).toBe(5);
  });

  it('ritorna array vuoto in caso di errore', async () => {
    const { getCommonTeamCombos } = await import('../lib/api/round-stats');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    expect(await getCommonTeamCombos('user-1')).toEqual([]);
  });
});

describe('getAccuracyByDifficulty', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ritorna le righe dalla RPC', async () => {
    const { getAccuracyByDifficulty } = await import('../lib/api/round-stats');

    mockRpc.mockResolvedValue({
      data: [{ difficulty: 1, correct_count: 8, incorrect_count: 2, accuracy_pct: 80 }],
      error: null
    });

    const result = await getAccuracyByDifficulty('user-1');

    expect(mockRpc).toHaveBeenCalledWith('get_accuracy_by_difficulty', { p_user_id: 'user-1' });
    expect(result[0].accuracy_pct).toBe(80);
  });

  it('ritorna array vuoto in caso di errore', async () => {
    const { getAccuracyByDifficulty } = await import('../lib/api/round-stats');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    expect(await getAccuracyByDifficulty('user-1')).toEqual([]);
  });
});

describe('getAvgResponseTime', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gestisce la riga ROLLUP con difficulty null (totale complessivo)', async () => {
    const { getAvgResponseTime } = await import('../lib/api/round-stats');

    mockRpc.mockResolvedValue({
      data: [
        { difficulty: null, avg_response_time_ms: 2575, sample_count: 4 },
        { difficulty: 1, avg_response_time_ms: 2000, sample_count: 2 }
      ],
      error: null
    });

    const result = await getAvgResponseTime('user-1');

    expect(mockRpc).toHaveBeenCalledWith('get_avg_response_time', { p_user_id: 'user-1' });
    expect(result.find((r) => r.difficulty === null)?.avg_response_time_ms).toBe(2575);
  });

  it('ritorna array vuoto in caso di errore', async () => {
    const { getAvgResponseTime } = await import('../lib/api/round-stats');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    expect(await getAvgResponseTime('user-1')).toEqual([]);
  });
});

describe('getMostGuessedPlayers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ritorna i giocatori dalla RPC ordinati per correct_count', async () => {
    const { getMostGuessedPlayers } = await import('../lib/api/round-stats');

    mockRpc.mockResolvedValue({
      data: [
        { player_name: 'Mario Rossi', correct_count: 5 },
        { player_name: 'Luigi Bianchi', correct_count: 3 }
      ],
      error: null
    });

    const result = await getMostGuessedPlayers('user-1', 10);

    expect(mockRpc).toHaveBeenCalledWith('get_most_guessed_players', { p_user_id: 'user-1', p_limit: 10 });
    expect(result[0].player_name).toBe('Mario Rossi');
  });

  it('ritorna array vuoto in caso di errore', async () => {
    const { getMostGuessedPlayers } = await import('../lib/api/round-stats');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    expect(await getMostGuessedPlayers('user-1')).toEqual([]);
  });
});
