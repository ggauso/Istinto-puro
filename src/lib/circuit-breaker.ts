/**
 * Circuit Breaker Pattern Implementation for Istinto Puro
 *
 * Implementa il pattern circuit breaker per gestire fallimenti RPC:
 * - Stato CLOSED: funzionamento normale
 * - Stato OPEN: troppi fallimenti, usare fallback
 * - Stato HALF_OPEN: tentativo di recovery
 */

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Numero di fallimenti per aprire il circuit
  successThreshold: number; // Numero di successi per chiudere il circuit
  timeout: number; // Tempo in ms prima di tentare recovery
  fallback: () => Promise<any>; // Funzione fallback da chiamare quando open
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  nextAttempt: Date | null;
}

/**
 * Circuit Breaker class per gestire fallimenti RPC
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failures = 0;
  private successes = 0;
  private nextAttempt: Date | null = null;
  private config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold || 3,
      successThreshold: config.successThreshold || 2,
      timeout: config.timeout || 30000, // 30 secondi default
      fallback: config.fallback || (() => Promise.reject(new Error('No fallback configured'))),
    };
  }

  /**
   * Esegui una funzione con protezione circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Se il circuit e' open, verifica se puo' passare in half_open
    if (this.state === 'open') {
      if (this.nextAttempt && new Date() >= this.nextAttempt) {
        this.state = 'half_open';
        this.successes = 0;
      } else {
        // Circuit open - usa fallback
        console.warn('[CircuitBreaker] Circuit is open, using fallback');
        return await this.config.fallback();
      }
    }

    try {
      const result = await operation();

      // Successo
      this.onSuccess();
      return result;
    } catch (error) {
      // Fallimento
      this.onFailure();
      throw error;
    }
  }

  /**
   * Gestisci successo
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === 'half_open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'closed';
        this.nextAttempt = null;
        console.log('[CircuitBreaker] Circuit closed after successful recovery');
      }
    }
  }

  /**
   * Gestisci fallimento
   */
  private onFailure(): void {
    this.failures++;
    this.successes = 0;

    if (this.state === 'half_open') {
      // Fallimento durante recovery - torna open
      this.state = 'open';
      this.nextAttempt = new Date(Date.now() + this.config.timeout);
      console.warn('[CircuitBreaker] Circuit opened after failed recovery');
    } else if (this.failures >= this.config.failureThreshold) {
      // Troppi fallimenti - apri il circuit
      this.state = 'open';
      this.nextAttempt = new Date(Date.now() + this.config.timeout);
      console.warn('[CircuitBreaker] Circuit opened after', this.failures, 'consecutive failures');
    }
  }

  /**
   * Reset manuale del circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = null;
    console.log('[CircuitBreaker] Circuit manually reset');
  }

  /**
   * Ottieni statistiche del circuit breaker
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.failures > 0 ? new Date() : null,
      nextAttempt: this.nextAttempt,
    };
  }

  /**
   * Verifica se il circuit e' chiuso (funzionamento normale)
   */
  isClosed(): boolean {
    return this.state === 'closed';
  }

  /**
   * Verifica se il circuit e' aperto (usa fallback)
   */
  isOpen(): boolean {
    return this.state === 'open';
  }
}

// =====================================================
// Pre-generati match per fallback
// =====================================================

interface FallbackMatch {
  team1: { id: bigint; name: string; logoUrl: string | null };
  team2: { id: bigint; name: string; logoUrl: string | null };
  player: { name: string };
  team1Seasons: number[];
  team2Seasons: number[];
}

// Match pre-generati per fallback (usati quando il circuit e' open)
const fallbackMatches: FallbackMatch[] = [
  {
    team1: { id: 109n, name: 'Juventus', logoUrl: null },
    team2: { id: 108n, name: 'Inter', logoUrl: null },
    player: { name: 'Cristiano Ronaldo' },
    team1Seasons: [2023, 2022, 2021],
    team2Seasons: [2023, 2022, 2021],
  },
  {
    team1: { id: 108n, name: 'Inter', logoUrl: null },
    team2: { id: 109n, name: 'Juventus', logoUrl: null },
    player: { name: 'Lautaro Martinez' },
    team1Seasons: [2023, 2022, 2021],
    team2Seasons: [2023, 2022, 2021],
  },
  {
    team1: { id: 107n, name: 'AC Milan', logoUrl: null },
    team2: { id: 109n, name: 'Juventus', logoUrl: null },
    player: { name: 'Rafael Leao' },
    team1Seasons: [2023, 2022, 2021],
    team2Seasons: [2023, 2022, 2021],
  },
  {
    team1: { id: 110n, name: 'Napoli', logoUrl: null },
    team2: { id: 107n, name: 'AC Milan', logoUrl: null },
    player: { name: 'Victor Osimhen' },
    team1Seasons: [2023, 2022, 2021],
    team2Seasons: [2023, 2022, 2021],
  },
  {
    team1: { id: 113n, name: 'Roma', logoUrl: null },
    team2: { id: 108n, name: 'Inter', logoUrl: null },
    player: { name: 'Paulo Dybala' },
    team1Seasons: [2023, 2022, 2021],
    team2Seasons: [2023, 2022, 2021],
  },
];

/**
 * Ritorna un match pre-generato per fallback
 */
export function getFallbackMatch(): FallbackMatch {
  const randomIndex = Math.floor(Math.random() * fallbackMatches.length);
  return fallbackMatches[randomIndex];
}

// =====================================================
// Istanza globale del circuit breaker per RPC
// =====================================================

export const rpcCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000,
  fallback: async () => {
    // Ritorna un match pre-generato
    const match = getFallbackMatch();
    console.warn('[CircuitBreaker] Using fallback match:', match.player.name);
    return {
      success: true,
      match,
      error: null,
      isFallback: true,
    };
  },
});