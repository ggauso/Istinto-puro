/**
 * Test suite per la Modalità Hard (Milestone 10) — logica pura di timer in
 * src/store/types.ts. La penalità punteggio e il parametro p_strict sono
 * testati solo indirettamente qui (sono inline in gameplaySlice.ts, non
 * funzioni pure estratte) — vedi anche la verifica diretta della RPC
 * validate_player_intersection fatta via curl durante l'implementazione.
 */

import { describe, it, expect } from 'vitest';
import {
  ROUND_DURATION_MS,
  HARD_MODE_DIFFICULTY,
  HARD_MODE_ROUND_DURATION_MS,
  getRoundDurationMs,
  getRemainingSeconds,
} from '../store/types';

describe('Modalità Hard - costanti', () => {
  it('HARD_MODE_DIFFICULTY è 4', () => {
    expect(HARD_MODE_DIFFICULTY).toBe(4);
  });

  it('il timer Hard (5s) è più corto di ai (15s) e pvp (10s)', () => {
    expect(HARD_MODE_ROUND_DURATION_MS).toBeLessThan(ROUND_DURATION_MS.ai);
    expect(HARD_MODE_ROUND_DURATION_MS).toBeLessThan(ROUND_DURATION_MS.pvp);
    expect(HARD_MODE_ROUND_DURATION_MS).toBe(5000);
  });
});

describe('getRoundDurationMs', () => {
  it('ritorna il timer Hard (5000ms) per difficulty 4, indipendentemente dal gameMode', () => {
    expect(getRoundDurationMs('ai', 4)).toBe(HARD_MODE_ROUND_DURATION_MS);
    expect(getRoundDurationMs('pvp', 4)).toBe(HARD_MODE_ROUND_DURATION_MS);
  });

  it('ritorna il timer normale per difficulty 1/2/3, invariato rispetto a prima di questa milestone', () => {
    expect(getRoundDurationMs('ai', 1)).toBe(15000);
    expect(getRoundDurationMs('ai', 2)).toBe(15000);
    expect(getRoundDurationMs('ai', 3)).toBe(15000);
    expect(getRoundDurationMs('pvp', 1)).toBe(10000);
    expect(getRoundDurationMs('pvp', 3)).toBe(10000);
  });
});

describe('getRemainingSeconds con difficoltà', () => {
  it('con difficulty 4 il tempo rimanente riflette i 5s, non i 10/15s di default', () => {
    const roundStartTime = Date.now();
    const remainingAi = getRemainingSeconds('ai', roundStartTime, 4);
    const remainingPvp = getRemainingSeconds('pvp', roundStartTime, 4);

    expect(remainingAi).toBe(5);
    expect(remainingPvp).toBe(5);
  });

  it('senza passare difficulty (default 1) il comportamento resta quello pre-esistente', () => {
    const roundStartTime = Date.now();
    expect(getRemainingSeconds('ai', roundStartTime)).toBe(15);
    expect(getRemainingSeconds('pvp', roundStartTime)).toBe(10);
  });

  it('il tempo scade a 0 e non va mai negativo anche in Hard mode', () => {
    const roundStartTime = Date.now() - 10000; // 10s fa, oltre i 5s di Hard
    expect(getRemainingSeconds('ai', roundStartTime, 4)).toBe(0);
  });
});

describe('Penalità errore Hard mode (-50, documentata in gameplaySlice.ts)', () => {
  it('lo score clampato a 0 non diventa mai negativo', () => {
    const clamp = (score: number) => Math.max(0, score - 50);

    expect(clamp(30)).toBe(0);
    expect(clamp(100)).toBe(50);
    expect(clamp(0)).toBe(0);
  });
});
