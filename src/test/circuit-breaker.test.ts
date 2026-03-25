/**
 * Test suite for circuit-breaker.ts - Circuit Breaker Pattern
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, getFallbackMatch, rpcCircuitBreaker } from '../lib/circuit-breaker';

describe('circuit-breaker.ts', () => {
  describe('CircuitBreaker class', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
      breaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 100,
        fallback: async () => 'fallback result',
      });
    });

    it('should start in closed state', () => {
      expect(breaker.isClosed()).toBe(true);
      expect(breaker.isOpen()).toBe(false);
    });

    it('should execute operation successfully', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should open circuit after threshold failures', async () => {
      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {
          // Expected
        }
      }

      // Should now be open
      expect(breaker.isOpen()).toBe(true);
    });

    it('should use fallback when circuit is open', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {
          // Expected
        }
      }

      // Now should return fallback
      const result = await breaker.execute(async () => 'should not reach');
      expect(result).toBe('fallback result');
    });

    it('should reset manually', async () => {
      // Fail and open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.isOpen()).toBe(true);

      // Reset
      breaker.reset();
      expect(breaker.isClosed()).toBe(true);
    });

    it('should provide stats', async () => {
      const stats = breaker.getStats();
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failures');
      expect(stats).toHaveProperty('successes');
      expect(stats).toHaveProperty('nextAttempt');
    });
  });

  describe('getFallbackMatch', () => {
    it('should return a valid fallback match', () => {
      const match = getFallbackMatch();
      expect(match).toHaveProperty('team1');
      expect(match).toHaveProperty('team2');
      expect(match).toHaveProperty('player');
      expect(match.team1).toHaveProperty('name');
    });

    it('should return different matches on multiple calls', () => {
      const matches = new Set();
      for (let i = 0; i < 10; i++) {
        matches.add(getFallbackMatch().player.name);
      }
      // Should have at least 2 different players
      expect(matches.size).toBeGreaterThan(1);
    });
  });

  describe('rpcCircuitBreaker singleton', () => {
    it('should be a CircuitBreaker instance', () => {
      expect(rpcCircuitBreaker).toBeInstanceOf(CircuitBreaker);
    });

    it('should have default configuration', () => {
      const stats = rpcCircuitBreaker.getStats();
      expect(stats.state).toBe('closed');
    });
  });
});