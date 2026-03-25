/**
 * Error Logger for Istinto Puro
 *
 * Gestisce il logging degli errori RPC verso Supabase
 */

interface LogEntry {
  timestamp: string;
  function_name: string;
  error_message: string;
  error_code?: string;
  user_id?: string;
  context?: Record<string, any>;
}

/**
 * Logga un errore RPC al database
 * Se il database non e' disponibile, logga in console
 */
export async function logRpcError(
  functionName: string,
  error: any,
  context?: Record<string, any>
): Promise<void> {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    function_name: functionName,
    error_message: error?.message || String(error),
    error_code: error?.code || undefined,
    context,
  };

  // Prova a loggare nel database
  try {
    const { error: dbError } = await supabase
      .from('audit_log')
      .insert({
        action: 'RPC_ERROR',
        table_name: functionName,
        user_id: supabase.auth.user()?.id || null,
        details: logEntry,
        created_at: logEntry.timestamp,
      } as any);

    if (dbError) {
      // Se il database non e' disponibile, logga in console
      console.error('[ErrorLogger] Database unavailable, logging to console:', logEntry);
    }
  } catch (err) {
    // Fallback: logga in console
    console.error('[ErrorLogger] Failed to log to database:', err);
    console.log('[ErrorLogger] Error entry:', logEntry);
  }
}

/**
 * Logga un evento di accesso non autorizzato
 */
export async function logUnauthorizedAccess(
  functionName: string,
  attemptedParams?: Record<string, any>
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    function_name: functionName,
    error_message: 'Unauthorized access attempt',
    context: { attempted_params: attemptedParams },
  };

  console.warn('[Security] Unauthorized access:', logEntry);

  try {
    await supabase
      .from('audit_log')
      .insert({
        action: 'UNAUTHORIZED_ACCESS',
        table_name: functionName,
        details: logEntry,
        created_at: logEntry.timestamp,
      } as any);
  } catch {
    // Ignore database errors for security logging
  }
}

/**
 * Logga un tentativo di accesso (accesso riuscito)
 */
export async function logSuccessfulAccess(
  functionName: string,
  context?: Record<string, any>
): Promise<void> {
  // Solo log in console per accessi riusciti (ridurre noise nel DB)
  console.log('[Access]', functionName, 'at', new Date().toISOString(), context);
}