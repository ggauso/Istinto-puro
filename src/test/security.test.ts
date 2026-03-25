/**
 * Test suite for security.ts - Security Utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validatePasswordStrength,
  getPasswordErrorMessage,
  sendPasswordResetEmail,
  isSessionValid,
  refreshSession,
} from '../lib/security';

// Mock supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));

import { supabase } from '../lib/supabase';

describe('security.ts - Password Validation', () => {
  describe('validatePasswordStrength', () => {
    it('should reject password shorter than 8 chars', () => {
      const result = validatePasswordStrength('Aa1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La password deve contenere almeno 8 caratteri');
    });

    it('should reject password without numbers', () => {
      const result = validatePasswordStrength('Password!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La password deve contenere almeno un numero');
    });

    it('should reject password without uppercase', () => {
      const result = validatePasswordStrength('password1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La password deve contenere almeno una lettera maiuscola');
    });

    it('should reject password without symbols', () => {
      const result = validatePasswordStrength('Password1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La password deve contenere almeno un simbolo');
    });

    it('should accept valid password', () => {
      const result = validatePasswordStrength('Password1!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBe(4);
    });

    it('should reject recent passwords', () => {
      const result = validatePasswordStrength('Password1!', ['Password1!']);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Non puoi usare una password che hai gia' usato di recente");
    });

    it('should give score 0 for very weak password', () => {
      const result = validatePasswordStrength('abc');
      expect(result.score).toBe(0);
    });

    it('should give score 4 for strong password', () => {
      const result = validatePasswordStrength('SecurePass123!');
      expect(result.score).toBe(4);
    });
  });

  describe('getPasswordErrorMessage', () => {
    it('should return first error message', () => {
      const message = getPasswordErrorMessage('abc');
      expect(message).toBe('La password deve contenere almeno 8 caratteri');
    });

    it('should return null for valid password', () => {
      const message = getPasswordErrorMessage('Password1!');
      expect(message).toBe(null);
    });
  });
});

describe('security.ts - Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isSessionValid', () => {
    it('should return false when no session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await isSessionValid();
      expect(result).toBe(false);
    });

    it('should return true when session is valid', async () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            expires_at: expiresAt,
            user: { id: 'test' },
          } as any,
        },
        error: null,
      });

      const result = await isSessionValid();
      expect(result).toBe(true);
    });

    it('should return false when session is expired', async () => {
      const expiresAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            expires_at: expiresAt,
            user: { id: 'test' },
          } as any,
        },
        error: null,
      });

      const result = await isSessionValid();
      expect(result).toBe(false);
    });
  });

  describe('refreshSession', () => {
    it('should return success when refresh works', async () => {
      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: { user: {} } as any },
        error: null,
      });

      const result = await refreshSession();
      expect(result.success).toBe(true);
    });

    it('should return error when refresh fails', async () => {
      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Token expired' },
      });

      const result = await refreshSession();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Token expired');
    });
  });
});