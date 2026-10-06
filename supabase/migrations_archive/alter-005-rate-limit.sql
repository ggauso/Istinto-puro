-- =====================================================
-- Rate Limiting Login - Task 2.1.3
-- =====================================================
-- Limita tentativi di login a 5/minuto per IP/email
-- Lockout 15min dopo 5 fallimenti
-- =====================================================

-- Tabella per tracciare tentativi di login
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  success BOOLEAN DEFAULT FALSE,
  attempt_time TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per le query di rate limiting
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts (email, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON public.login_attempts (ip_address, attempt_time);

-- Funzione per verificare se email è bloccata
CREATE OR REPLACE FUNCTION public.is_email_locked(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_failed_attempts INTEGER;
  v_lockout_until TIMESTAMPTZ;
BEGIN
  -- Conta tentativi falliti negli ultimi 15 minuti
  SELECT COUNT(*), MAX(attempt_time)
  INTO v_failed_attempts, v_lockout_until
  FROM public.login_attempts
  WHERE email = LOWER(p_email)
    AND success = FALSE
    AND attempt_time > NOW() - INTERVAL '15 minutes';

  -- Se 5+ tentativi falliti, l'account è bloccato
  IF v_failed_attempts >= 5 THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Funzione per verificare se IP è bloccato
CREATE OR REPLACE FUNCTION public.is_ip_locked(p_ip TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_failed_attempts INTEGER;
BEGIN
  -- Conta tentativi falliti da questo IP negli ultimi 15 minuti
  SELECT COUNT(*)
  INTO v_failed_attempts
  FROM public.login_attempts
  WHERE ip_address = p_ip
    AND success = FALSE
    AND attempt_time > NOW() - INTERVAL '15 minutes';

  -- Se 5+ tentativi falliti, l'IP è bloccato
  IF v_failed_attempts >= 5 THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Funzione per registrare tentativo di login
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email TEXT,
  p_ip TEXT,
  p_success BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, ip_address, success)
  VALUES (LOWER(p_email), p_ip, p_success);
END;
$$;

-- Funzione per ottenere secondi rimanenti prima del unlock
CREATE OR REPLACE FUNCTION public.get_login_lockout_remaining(p_email TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lockout_until TIMESTAMPTZ;
  v_remaining INTEGER;
BEGIN
  SELECT MAX(attempt_time) + INTERVAL '15 minutes'
  INTO v_lockout_until
  FROM public.login_attempts
  WHERE email = LOWER(p_email)
    AND success = FALSE
    AND attempt_time > NOW() - INTERVAL '15 minutes'
  HAVING COUNT(*) >= 5;

  IF v_lockout_until IS NOT NULL AND v_lockout_until > NOW() THEN
    v_remaining := EXTRACT(EPOCH FROM (v_lockout_until - NOW()))::INTEGER;
    RETURN v_remaining;
  END IF;

  RETURN 0;
END;
$$;

-- Policy RLS per login_attempts
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Tutti possono inserire tentativi (registrazione login)
CREATE POLICY "Allow insert login attempts"
ON public.login_attempts FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Solo il sistema può leggere (per rate limiting)
CREATE POLICY "System read login attempts"
ON public.login_attempts FOR SELECT
TO service_role
USING (true);

-- Cleanup automatico: elimina record più vecchi di 24 ore
-- Questo può essere eseguito come cron job
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE attempt_time < NOW() - INTERVAL '24 hours';
END;
$$;

-- =====================================================
-- VERIFICA
-- =====================================================

-- Test: Verifica se il rate limiting funziona
-- SELECT public.is_email_locked('test@example.com');
-- SELECT public.is_ip_locked('192.168.1.1');
-- SELECT public.get_login_lockout_remaining('test@example.com');

-- Per pulire i vecchi record (eseguire periodicamente con cron):
-- SELECT public.cleanup_old_login_attempts();

-- Per vedere i tentativi recenti:
-- SELECT * FROM public.login_attempts ORDER BY attempt_time DESC LIMIT 20;