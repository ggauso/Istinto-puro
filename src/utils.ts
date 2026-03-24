/**
 * Utility functions for validation and error handling
 *
 * Validazione input client-side per prevenire errori e attacchi
 */

// Maximi caratteri consentiti
export const MAX_INPUT_LENGTH = 100;
export const MAX_TEAM_ID_LENGTH = 20;
export const MAX_LEAGUE_ID_LENGTH = 20;

/**
 * Sanitizza l'input di ricerca per i giocatori
 * Previene SQL injection e altri attacchi
 */
export function sanitizePlayerSearch(input: string): string {
  // Rimuovi caratteri pericolosi
  let sanitized = input
    .replace(/["'\\;]/g, '') // Rimuovi quote e semi-coloni
    .replace(/--/g, '') // Rimuovi commenti SQL
    .replace(/\/\*/g, '') // Rimuovi comment multi-line
    .replace(/\*/g, ''); // Rimuovi jolly

  // Tronca se troppo lungo
  if (sanitized.length > MAX_INPUT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_INPUT_LENGTH);
  }

  // Mantieni solo lettere, numeri e spazi
  sanitized = sanitized.replace(/[^a-zA-Z0-9\u00C0-\u017F]/g, '');

  return sanitized.trim();
}

/**
 * Validazione team_id
 */
export function isValidTeamId(teamId: string | null): boolean {
  if (!teamId || teamId.length > MAX_TEAM_ID_LENGTH) {
    return false;
  }

  // Controlla per tentativi di SQL injection
  const dangerousPatterns = [
    /--/,      // Comment SQL
    /\*/ ,      // Jolly (potenzialmente pericoloso)
    /'\s*=/,    // SQL injection
    /\x27/,     // Quote
    /\.\./,     // Doppio punto (path traversal)
  ];

  return !dangerousPatterns.some(pattern => pattern.test(teamId));
}

/**
 * Validazione league_id
 */
export function isValidLeagueId(leagueId: string | null): boolean {
  if (!leagueId || leagueId.length > MAX_LEAGUE_ID_LENGTH) {
    return false;
  }

  const dangerousPatterns = [
    /--/,
    /\*/ ,
    /'\s*=/,
    /\x27/,
  ];

  return !dangerousPatterns.some(pattern => pattern.test(leagueId));
}

/**
 * Controlla se un team_id è presente in una lista di team esclusi
 */
export function isTeamExcluded(
  teamId: string | null,
  excludedTeams: bigint[]
): boolean {
  if (!teamId || excludedTeams.length === 0) {
    return false;
  }

  const teamIdNum = BigInt(teamId);
  return excludedTeams.includes(teamIdNum);
}

/**
 * Genera timestamp in ms per timeout
 */
export const RPC_TIMEOUT_MS = 10000; // 10 secondi di timeout per le chiamate RPC
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;

/**
 * Aggiunge timeout a una Promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = RPC_TIMEOUT_MS
): Promise<T> {
  const timeoutId = Symbol('timeout');

  const timeout = new Promise<T>((_, reject) => {
    setTimeout(() => {
      // @ts-ignore
      reject(new Error('RPC call timed out after ' + timeoutMs + 'ms'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).catch((error: any) => {
    // @ts-ignore
    if (error === timeoutId) {
      throw new Error('RPC call timed out');
    }
    throw error;
  });
}

/**
 * Gestisce gli errori RPC con retry
 */
export async function callRpcWithRetry<T>(
  call: Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // @ts-ignore
      return await withTimeout(call, RPC_TIMEOUT_MS);
    } catch (error) {
      lastError = error as Error;

      // Non retryare se è timeout o errore di rete permanente
      if (error instanceof Error) {
        if (error.message.includes('timed out') || error.message.includes('timeout')) {
          continue; // Retry per timeout
        }
        if (error.message.includes('connection refused') ||
            error.message.includes('ECONNREFUSED')) {
          throw error; // Non retryare per connessione rifiutata
        }
        if (error.message.includes('ETIMEDOUT') ||
            error.message.includes('ETIMEDOUT')) {
          continue; // Retry per timeout di connessione
        }
      }

      // Ultimo tentativo fallito
      throw lastError;
    }
  }

  // Questo dovrebbe essere raggiungibile solo in casi rari
  throw lastError || new Error('Unknown RPC error');
}

/**
 * Formatta l'errore RPC per il frontend
 */
export function formatRpcError(error: any): string {
  if (error instanceof Error) {
    if (error.message.includes('timed out')) {
      return 'La chiamata al servizio è scaduta. Riprova più tardi.';
    }
    if (error.message.includes('connection')) {
      return 'Connessione al servizio non disponibile. Controlla la tua connessione.';
    }
    if (error.message.includes('429')) {
      return 'Troppo richieste. Attendere qualche secondo e riprovare.';
    }
    if (error.message.includes('403')) {
      return 'Accesso negato. Contatta l\'amministratore.';
    }
    if (error.message.includes('500') || error.message.includes('503')) {
      return 'Il servizio è temporaneamente indisponibile. Riprova più tardi.';
    }
  }

  return error?.message || 'Si è verificato un errore imprevisto.';
}
