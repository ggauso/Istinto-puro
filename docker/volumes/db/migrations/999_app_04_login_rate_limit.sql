-- =====================================================================
-- 04_login_rate_limit.sql
--
-- Rate limiting sui tentativi di login. Stato consolidato di
-- alter-005-rate-limit.sql (mai ridefinita altrove).
-- Nota di sicurezza (vedi ROADMAP_SECURITY.md): record_login_attempt deve
-- restare chiamabile senza sessione (serve durante il login stesso),
-- quindi non può avere un controllo auth.uid() — resta un vettore di
-- abuso noto e non risolto in questo consolidamento.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  success BOOLEAN DEFAULT FALSE,
  attempt_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts (email, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON public.login_attempts (ip_address, attempt_time);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert login attempts" ON public.login_attempts;
CREATE POLICY "Allow insert login attempts"
ON public.login_attempts FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "System read login attempts" ON public.login_attempts;
CREATE POLICY "System read login attempts"
ON public.login_attempts FOR SELECT
TO service_role
USING (true);

CREATE OR REPLACE FUNCTION public.is_email_locked(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_failed_attempts INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_failed_attempts
  FROM public.login_attempts
  WHERE email = LOWER(p_email)
    AND success = FALSE
    AND attempt_time > NOW() - INTERVAL '15 minutes';

  RETURN v_failed_attempts >= 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_ip_locked(p_ip TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_failed_attempts INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_failed_attempts
  FROM public.login_attempts
  WHERE ip_address = p_ip
    AND success = FALSE
    AND attempt_time > NOW() - INTERVAL '15 minutes';

  RETURN v_failed_attempts >= 5;
END;
$$;

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

-- Manutenzione (non chiamata dal client, uso amministrativo/cron)
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
