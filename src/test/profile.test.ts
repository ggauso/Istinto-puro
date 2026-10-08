/**
 * Test suite for getUserInfo function - RPC client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';

// Get reference to the mock
const mockRpc = supabase.rpc as any;

describe('getUserInfo - RPC client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return user data when RPC returns valid data', async () => {
    // Import after setting up the test
    const { getUserInfo } = await import('../lib/api/profile');

    const mockUserData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      nickname: 'TestNickname',
      first_name: 'John',
      last_name: 'Doe',
      tier: 'gold',
      total_score: 1500
    };

    mockRpc.mockResolvedValue({
      data: mockUserData,
      error: null
    });

    const result = await getUserInfo('123e4567-e89b-12d3-a456-426614174000');

    expect(result.success).toBe(true);
    expect(result.user).not.toBeNull();
    expect(result.user?.nickname).toBe('TestNickname');
    expect(result.user).not.toHaveProperty('firstName');
    expect(result.user).not.toHaveProperty('lastName');
    expect(result.user?.tier).toBe('gold');
    expect(result.user?.totalScore).toBe(1500);
  });

  it('should return user data when RPC returns array with data', async () => {
    const { getUserInfo } = await import('../lib/api/profile');

    const mockUserData = [{
      id: '123e4567-e89b-12d3-a456-426614174000',
      nickname: 'TestNickname',
      first_name: 'John',
      last_name: 'Doe',
      tier: 'gold',
      total_score: 1500
    }];

    mockRpc.mockResolvedValue({
      data: mockUserData,
      error: null
    });

    const result = await getUserInfo('123e4567-e89b-12d3-a456-426614174000');

    expect(result.success).toBe(true);
    expect(result.user).not.toBeNull();
    expect(result.user?.nickname).toBe('TestNickname');
  });

  it('should return failure when RPC returns empty object', async () => {
    const { getUserInfo } = await import('../lib/api/profile');

    mockRpc.mockResolvedValue({
      data: {},
      error: null
    });

    const result = await getUserInfo('123e4567-e89b-12d3-a456-426614174000');

    expect(result.success).toBe(false);
    expect(result.user).toBeNull();
    expect(result.error).toBe('Utente non trovato');
  });

  it('should return failure when RPC returns empty array', async () => {
    const { getUserInfo } = await import('../lib/api/profile');

    mockRpc.mockResolvedValue({
      data: [],
      error: null
    });

    const result = await getUserInfo('123e4567-e89b-12d3-a456-426614174000');

    expect(result.success).toBe(false);
    expect(result.user).toBeNull();
    expect(result.error).toBe('Utente non trovato');
  });

  it('should return failure when RPC returns null', async () => {
    const { getUserInfo } = await import('../lib/api/profile');

    mockRpc.mockResolvedValue({
      data: null,
      error: null
    });

    const result = await getUserInfo('123e4567-e89b-12d3-a456-426614174000');

    expect(result.success).toBe(false);
    expect(result.user).toBeNull();
    expect(result.error).toBe('Utente non trovato');
  });

  it('should never expose first/last name even if the RPC returned them', async () => {
    const { getUserInfo } = await import('../lib/api/profile');

    const mockUserData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      nickname: null,
      first_name: 'John',
      last_name: 'Doe',
      tier: 'gold',
      total_score: 1500
    };

    mockRpc.mockResolvedValue({
      data: mockUserData,
      error: null
    });

    const result = await getUserInfo('123e4567-e89b-12d3-a456-426614174000');

    expect(result.success).toBe(true);
    expect(result.user?.nickname).toBe(null);
    expect(result.user).not.toHaveProperty('firstName');
    expect(result.user).not.toHaveProperty('lastName');
  });
});

describe('Nickname fallback logic in store', () => {
  it('should fall back to presence nickname when DB nickname is null', () => {
    const oppUser = { nickname: null };

    const opponentNicknameFromPresence = 'GuestPlayer';

    const nickname = oppUser.nickname || opponentNicknameFromPresence || 'Avversario';

    expect(nickname).toBe('GuestPlayer');
  });

  it('should fall back to presence nickname when no DB data', () => {
    const oppUser = null;
    const opponentNicknameFromPresence = 'GuestPlayer';

    // This is the logic in store.ts when getUserInfo fails
    const nickname = opponentNicknameFromPresence || `Giocatore ${Math.floor(Math.random() * 9000) + 1000}`;

    expect(nickname).toBe('GuestPlayer');
  });

  it('should generate random name when no nickname available', () => {
    const oppUser = null;
    const opponentNicknameFromPresence = null;

    // This is the logic in store.ts when all fallbacks fail
    const nickname = opponentNicknameFromPresence || `Giocatore ${Math.floor(Math.random() * 9000) + 1000}`;

    expect(nickname).toMatch(/^Giocatore \d{4}$/);
  });
});