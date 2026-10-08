/**
 * Security utilities for Istinto Puro
 *
 * Include:
 * - Password strength validation
 * - Password reset via email
 * - Logout everywhere (revoke all sessions)
 */

import { appPath, appUrl } from './paths';
import { supabase } from './supabase';

/**
 * Password strength requirements
 */
export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-4
  errors: string[];
}

/**
 * Valida la forza della password secondo i requisiti di sicurezza
 * Requisiti:
 * - Min 8 caratteri
 * - Min 1 numero
 * - Min 1 maiuscola
 * - Min 1 simbolo
 * - Non deve essere una password recente
 */
export function validatePasswordStrength(password: string, recentPasswords: string[] = []): PasswordStrength {
  const errors: string[] = [];
  let score = 0;

  // Min 8 caratteri
  if (password.length >= 8) {
    score++;
  } else {
    errors.push('La password deve contenere almeno 8 caratteri');
  }

  // Min 1 numero
  if (/\d/.test(password)) {
    score++;
  } else {
    errors.push('La password deve contenere almeno un numero');
  }

  // Min 1 maiuscola
  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    errors.push('La password deve contenere almeno una lettera maiuscola');
  }

  // Min 1 simbolo
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score++;
  } else {
    errors.push('La password deve contenere almeno un simbolo');
  }

  // Non deve essere una password recente
  if (recentPasswords.includes(password)) {
    errors.push('Non puoi usare una password che hai gia\' usato di recente');
    score = Math.max(0, score - 1);
  }

  return {
    isValid: errors.length === 0,
    score,
    errors,
  };
}

/**
 * Ottieni un messaggio di errore per la password
 */
export function getPasswordErrorMessage(password: string): string | null {
  const { errors } = validatePasswordStrength(password);
  return errors.length > 0 ? errors[0] : null;
}

/**
 * Invia email per reset password
 * L'utente ricevera' un link per resettare la password
 */
export async function sendPasswordResetEmail(email: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl("/reset-password"),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Revoca tutte le sessioni dell'utente (logout everywhere)
 * Nota: Questo richiede Supabase Enterprise o un'implementazione personalizzata
 * Per ora, questa funzione effettua un logout locale
 */
export async function revokeAllSessions(): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    // Effettua il logout
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, error: error.message };
    }

    // Pulisci i dati locali
    localStorage.clear();
    sessionStorage.clear();

    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Effettua logout e pulizia completa
 */
export async function performFullLogout(): Promise<void> {
  try {
    // Logout da Supabase
    await supabase.auth.signOut();

    // Pulisci i dati locali
    localStorage.clear();
    sessionStorage.clear();

    // Ricarica la pagina per resettare tutto
    window.location.href = appPath('/');
  } catch (error) {
    console.error('Errore durante il logout:', error);
    // Forza comunque il redirect
    window.location.href = appPath('/');
  }
}

/**
 * Verifica se la sessione e' ancora valida
 */
export async function isSessionValid(): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return false;
    }

    // Verifica che il token non sia scaduto
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const expirationTime = expiresAt * 1000;
      return Date.now() < expirationTime;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Aggiorna la sessione manualmente
 */
export async function refreshSession(): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.session) {
      return { success: false, error: 'Nessuna sessione da aggiornare' };
    }

    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}