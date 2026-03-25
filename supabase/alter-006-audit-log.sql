-- =====================================================
-- Audit Logging - Task 3.2
-- =====================================================
-- Traccia: tutti gli UPDATE, LOGOUT events, Failed auth attempts
-- =====================================================

-- Tabella per audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID, -- NULL per tentativi falliti anonimi
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL, -- 'auth', 'game', 'profile', 'admin'
  description TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per query efficienti
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON public.audit_log (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_category ON public.audit_log (event_category);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);

-- Funzione per registrare eventi di audit
CREATE OR REPLACE FUNCTION public.record_audit_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_category TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, event_type, event_category, description, metadata, ip_address, user_agent)
  VALUES (p_user_id, p_event_type, p_event_category, p_description, p_metadata, p_ip_address, p_user_agent);
END;
$$;

-- Trigger automatico per tracciare modifiche ai profili
CREATE OR REPLACE FUNCTION public.trigger_profile_audit()
RETURNS TRIGGER AS $$
BEGIN
  -- Registra modifica profilo
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.record_audit_event(
      NEW.id,
      'profile_update',
      'profile',
      'Profilo aggiornato',
      to_jsonb(ROW(
        OLD.first_name IS DISTINCT FROM NEW.first_name,
        OLD.last_name IS DISTINCT FROM NEW.last_name,
        OLD.nickname IS DISTINCT FROM NEW.nickname,
        OLD.tier IS DISTINCT FROM NEW.tier,
        OLD.total_score IS DISTINCT FROM NEW.total_score
      )),
      NULL,
      NULL
    );
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.record_audit_event(
      NEW.id,
      'profile_created',
      'profile',
      'Profilo creato',
      '{}',
      NULL,
      NULL
    );
  END IF;
  RETURN NULL;
END;
$$
LANGUAGE plpgsql;

-- Trigger sulla tabella profiles
DROP TRIGGER IF EXISTS audit_profile_trigger ON public.profiles;
CREATE TRIGGER audit_profile_trigger
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_profile_audit();

-- Funzione helper per eventi auth
CREATE OR REPLACE FUNCTION public.record_auth_event(
  p_user_id UUID,
  p_event_type TEXT, -- 'login', 'logout', 'login_failed', 'password_change'
  p_email TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.record_audit_event(
    p_user_id,
    p_event_type,
    'auth',
    CASE
      WHEN p_event_type = 'login' THEN 'Login effettuato'
      WHEN p_event_type = 'logout' THEN 'Logout effettuato'
      WHEN p_event_type = 'login_failed' THEN 'Tentativo login fallito'
      WHEN p_event_type = 'password_change' THEN 'Password modificata'
      ELSE p_event_type
    END,
    jsonb_build_object('email', p_email, 'success', p_success),
    p_ip_address,
    NULL
  );
END;
$$;

-- Funzione per eventi di gioco
CREATE OR REPLACE FUNCTION public.record_game_event(
  p_user_id UUID,
  p_event_type TEXT, -- 'match_started', 'match_won', 'match_lost', 'match_abandoned'
  p_match_id UUID DEFAULT NULL,
  p_score INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.record_audit_event(
    p_user_id,
    p_event_type,
    'game',
    CASE
      WHEN p_event_type = 'match_started' THEN 'Partita iniziata'
      WHEN p_event_type = 'match_won' THEN 'Partita vinta'
      WHEN p_event_type = 'match_lost' THEN 'Partita persa'
      WHEN p_event_type = 'match_abandoned' THEN 'Partita abbandonata'
      ELSE p_event_type
    END,
    p_metadata || jsonb_build_object('match_id', p_match_id, 'score', p_score),
    NULL,
    NULL
  );
END;
$$;

-- Query utili per audit

-- Ultimi 20 eventi di un utente
-- SELECT * FROM public.audit_log WHERE user_id = 'uuid-utente' ORDER BY created_at DESC LIMIT 20;

-- Tentativi login falliti oggi
-- SELECT * FROM public.audit_log
-- WHERE event_type = 'login_failed'
--   AND created_at >= CURRENT_DATE
-- ORDER BY created_at DESC;

-- Tutti gli eventi di oggi per categoria
-- SELECT event_category, COUNT(*), MIN(created_at), MAX(created_at)
-- FROM public.audit_log
-- WHERE created_at >= CURRENT_DATE
-- GROUP BY event_category;

-- Utenti più attivi oggi
-- SELECT user_id, COUNT(*) as event_count
-- FROM public.audit_log
-- WHERE created_at >= CURRENT_DATE
-- GROUP BY user_id
-- ORDER BY event_count DESC
-- LIMIT 10;

-- Cleanup: elimina log più vecchi di 90 giorni (GDPR compliance)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- SELECT public.cleanup_old_audit_logs(); -- Eseguire periodicamente