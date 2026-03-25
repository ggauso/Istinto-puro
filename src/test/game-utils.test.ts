/**
 * Test suite for game-utils.ts - Game Utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateGuestName,
  isGuestName,
  formatDisplayName,
  calculateWinRate,
  sortLeaderboard,
  filterLeaderboardByTier,
  calculateRank,
  formatRelativeTime,
  formatNumber,
  isValidDisplayName,
  generateDisplayName,
  calculateTier,
  getTierInfo,
  getTierProgress,
} from '../lib/game-utils';
import { TIER_CONFIG } from '../types/game';

describe('game-utils.ts - Guest Names', () => {
  describe('generateGuestName', () => {
    it('should generate guest name in correct format', () => {
      const name = generateGuestName();
      expect(name).toMatch(/^guest-\d{4}$/);
    });

    it('should generate different names on multiple calls', () => {
      const names = new Set();
      for (let i = 0; i < 100; i++) {
        names.add(generateGuestName());
      }
      // Should have many unique names
      expect(names.size).toBeGreaterThan(50);
    });
  });

  describe('isGuestName', () => {
    it('should return true for valid guest names', () => {
      expect(isGuestName('guest-1234')).toBe(true);
      expect(isGuestName('guest-0000')).toBe(true);
      expect(isGuestName('guest-9999')).toBe(true);
    });

    it('should return false for non-guest names', () => {
      expect(isGuestName('guest-123')).toBe(false);
      expect(isGuestName('guest-')).toBe(false);
      expect(isGuestName('player1')).toBe(false);
      expect(isGuestName('guest-')).toBe(false);
    });
  });

  describe('formatDisplayName', () => {
    it('should add icon for guest names', () => {
      const result = formatDisplayName('guest-1234', true);
      expect(result).toBe('👤 guest-1234');
    });

    it('should not add icon for regular names', () => {
      const result = formatDisplayName('Mario Rossi', false);
      expect(result).toBe('Mario Rossi');
    });
  });
});

describe('game-utils.ts - Win Rate', () => {
  describe('calculateWinRate', () => {
    it('should return 0 for no games played', () => {
      expect(calculateWinRate(0, 0)).toBe(0);
    });

    it('should calculate correct percentage', () => {
      expect(calculateWinRate(5, 10)).toBe(50);
      expect(calculateWinRate(7, 10)).toBe(70);
      expect(calculateWinRate(1, 3)).toBe(33);
    });

    it('should round to nearest integer', () => {
      expect(calculateWinRate(1, 6)).toBe(17); // 16.66... -> 17
    });
  });
});

describe('game-utils.ts - Leaderboard', () => {
  const mockLeaderboard = [
    { userId: '1', totalScore: 1000, tier: 'gold' as any },
    { userId: '2', totalScore: 3000, tier: 'platinum' as any },
    { userId: '3', totalScore: 500, tier: 'silver' as any },
  ];

  describe('sortLeaderboard', () => {
    it('should sort by totalScore descending', () => {
      const sorted = sortLeaderboard(mockLeaderboard as any);
      expect(sorted[0].totalScore).toBe(3000);
      expect(sorted[1].totalScore).toBe(1000);
      expect(sorted[2].totalScore).toBe(500);
    });

    it('should not mutate original array', () => {
      const sorted = sortLeaderboard(mockLeaderboard as any);
      expect(mockLeaderboard[0].totalScore).toBe(1000);
    });
  });

  describe('filterLeaderboardByTier', () => {
    it('should return all when tier is all', () => {
      const filtered = filterLeaderboardByTier(mockLeaderboard as any, 'all');
      expect(filtered.length).toBe(3);
    });

    it('should filter by tier', () => {
      const filtered = filterLeaderboardByTier(mockLeaderboard as any, 'gold');
      expect(filtered.length).toBe(1);
      expect(filtered[0].userId).toBe('1');
    });
  });

  describe('calculateRank', () => {
    it('should return correct rank', () => {
      const leaderboard = sortLeaderboard(mockLeaderboard as any);
      expect(calculateRank('2', leaderboard)).toBe(1);
      expect(calculateRank('1', leaderboard)).toBe(2);
      expect(calculateRank('3', leaderboard)).toBe(3);
    });

    it('should return -1 for non-existent user', () => {
      expect(calculateRank('999', mockLeaderboard as any)).toBe(-1);
    });
  });
});

describe('game-utils.ts - Formatting', () => {
  describe('formatRelativeTime', () => {
    it('should return "ora" for recent times', () => {
      const now = new Date().toISOString();
      expect(formatRelativeTime(now)).toBe('ora');
    });

    it('should return minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString();
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minuti fa');
    });

    it('should return hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      expect(formatRelativeTime(twoHoursAgo)).toBe('2 ore fa');
    });

    it('should return days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      expect(formatRelativeTime(threeDaysAgo)).toBe('3 giorni fa');
    });
  });

  describe('formatNumber', () => {
    it('should return string representation', () => {
      // Test basic functionality - returns a non-empty string
      const result = formatNumber(1000);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toBe('1000');
    });
  });
});

describe('game-utils.ts - Display Name', () => {
  describe('isValidDisplayName', () => {
    it('should reject short names', () => {
      expect(isValidDisplayName('a')).toBe(false);
      expect(isValidDisplayName('')).toBe(false);
    });

    it('should reject long names', () => {
      expect(isValidDisplayName('a'.repeat(31))).toBe(false);
    });

    it('should accept valid names', () => {
      expect(isValidDisplayName('Mario Rossi')).toBe(true);
      expect(isValidDisplayName('Player_123')).toBe(true);
      expect(isValidDisplayName('Test-Name')).toBe(true);
    });
  });

  describe('generateDisplayName', () => {
    it('should return first name + last initial', () => {
      expect(generateDisplayName('Mario', 'Rossi')).toBe('Mario R.');
    });

    it('should return only first name if no last name', () => {
      expect(generateDisplayName('Mario', null)).toBe('Mario');
    });

    it('should return Anonimo if no names', () => {
      expect(generateDisplayName(null, null)).toBe('Anonimo');
    });
  });
});

describe('game-utils.ts - Tier System', () => {
  describe('calculateTier', () => {
    it('should return bronze for scores 0-500', () => {
      expect(calculateTier(0)).toBe('bronze');
      expect(calculateTier(250)).toBe('bronze');
      expect(calculateTier(500)).toBe('bronze');
    });

    it('should return silver for scores 501-1500', () => {
      expect(calculateTier(501)).toBe('silver');
      expect(calculateTier(1000)).toBe('silver');
      expect(calculateTier(1500)).toBe('silver');
    });

    it('should return gold for scores 1501-3000', () => {
      expect(calculateTier(1501)).toBe('gold');
      expect(calculateTier(2000)).toBe('gold');
      expect(calculateTier(3000)).toBe('gold');
    });

    it('should return platinum for scores 3001-5000', () => {
      expect(calculateTier(3001)).toBe('platinum');
      expect(calculateTier(4000)).toBe('platinum');
      expect(calculateTier(5000)).toBe('platinum');
    });

    it('should return diamond for scores 5001+', () => {
      expect(calculateTier(5001)).toBe('diamond');
      expect(calculateTier(10000)).toBe('diamond');
    });
  });

  describe('getTierInfo', () => {
    it('should return correct tier info', () => {
      const info = getTierInfo(1500);
      expect(info.name).toBe('silver');
      expect(info.label).toBe('Silver');
      expect(info.color).toBe('#C0C0C0');
    });
  });

  describe('getTierProgress', () => {
    it('should return 0 at tier minimum', () => {
      expect(getTierProgress(501)).toBe(0);
    });

    it('should return 100 at tier maximum', () => {
      expect(getTierProgress(1500)).toBe(100);
    });

    it('should return 50 at tier middle', () => {
      expect(getTierProgress(1000)).toBe(50);
    });

    it('should return 100 for diamond (no max)', () => {
      expect(getTierProgress(10000)).toBe(100);
    });
  });
});