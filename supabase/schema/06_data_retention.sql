-- =====================================================================
-- 06_data_retention.sql
--
-- Politiche di conservazione dati (GDPR). Stato consolidato di
-- alter-007-data-retention.sql + alter-022-security-fixes.sql (REVOKE
-- su run_retention_cleanup, che deve restare solo amministrativa).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.retention_policies (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL UNIQUE,
  column_name TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  cleanup_function TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.retention_policies (table_name, column_name, retention_days, cleanup_function, description)
VALUES
  ('audit_log', 'created_at', 90, 'cleanup_old_audit_logs', 'Log attività utente'),
  ('login_attempts', 'attempt_time', 30, 'cleanup_old_login_attempts', 'Tentativi login (sensibili - 30gg)'),
  ('matches_history', 'created_at', 730, 'cleanup_old_matches', 'Storico partite (2 anni per statistics)'),
  ('leaderboard_weekly', 'week_start', 56, 'cleanup_old_leaderboards', 'Classifiche settimanali (8 settimane)'),
  ('leaderboard_monthly', 'month_start', 395, 'cleanup_old_leaderboards', 'Classifiche mensili (13 mesi)'),
  ('matches', 'created_at', 7, 'cleanup_active_matches', 'Partite attive (7 giorni max)')
ON CONFLICT (table_name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.cleanup_old_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.matches_history
  WHERE created_at < NOW() - INTERVAL '730 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_active_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.matches
  WHERE created_at < NOW() - INTERVAL '7 days'
    AND status != 'completed';
END;
$$;

CREATE OR REPLACE FUNCTION public.run_retention_cleanup()
RETURNS TABLE (cleanup_name TEXT, rows_deleted BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_deleted BIGINT := 0;
  v_logins_deleted BIGINT := 0;
  v_matches_deleted BIGINT := 0;
  v_leaderboard_deleted BIGINT := 0;
  v_active_matches_deleted BIGINT := 0;
BEGIN
  DELETE FROM public.audit_log WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;

  DELETE FROM public.login_attempts WHERE attempt_time < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_logins_deleted = ROW_COUNT;

  DELETE FROM public.matches_history WHERE created_at < NOW() - INTERVAL '730 days';
  GET DIAGNOSTICS v_matches_deleted = ROW_COUNT;

  DELETE FROM public.leaderboard_weekly WHERE week_start < CURRENT_DATE - INTERVAL '8 weeks';
  GET DIAGNOSTICS v_leaderboard_deleted = ROW_COUNT;

  DELETE FROM public.leaderboard_monthly WHERE month_start < CURRENT_DATE - INTERVAL '13 months';

  DELETE FROM public.matches WHERE created_at < NOW() - INTERVAL '7 days' AND status != 'completed';
  GET DIAGNOSTICS v_active_matches_deleted = ROW_COUNT;

  RETURN QUERY VALUES
    ('audit_log', v_audit_deleted),
    ('login_attempts', v_logins_deleted),
    ('matches_history', v_matches_deleted),
    ('leaderboard_weekly', v_leaderboard_deleted),
    ('leaderboard_monthly', v_leaderboard_deleted),
    ('active_matches', v_active_matches_deleted);
END;
$$;

-- Funzione di manutenzione amministrativa: non deve essere chiamabile dal
-- browser (anon/authenticated), solo con la service role key.
REVOKE EXECUTE ON FUNCTION public.run_retention_cleanup() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_retention_stats()
RETURNS TABLE (
  table_name TEXT, current_records BIGINT, records_to_delete BIGINT,
  retention_days INTEGER, oldest_record TIMESTAMPTZ, newest_record TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 'audit_log'::TEXT, COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days')::BIGINT,
    90, MIN(created_at), MAX(created_at)
  FROM public.audit_log

  UNION ALL

  SELECT 'login_attempts'::TEXT, COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE attempt_time < NOW() - INTERVAL '30 days')::BIGINT,
    30, MIN(attempt_time), MAX(attempt_time)
  FROM public.login_attempts

  UNION ALL

  SELECT 'matches_history'::TEXT, COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '730 days')::BIGINT,
    730, MIN(created_at), MAX(created_at)
  FROM public.matches_history

  UNION ALL

  SELECT 'leaderboard_weekly'::TEXT, COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE week_start < CURRENT_DATE - INTERVAL '8 weeks')::BIGINT,
    56, MIN(week_start)::TIMESTAMPTZ, MAX(week_start)::TIMESTAMPTZ
  FROM public.leaderboard_weekly

  UNION ALL

  SELECT 'leaderboard_monthly'::TEXT, COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE month_start < CURRENT_DATE - INTERVAL '13 months')::BIGINT,
    395, MIN(month_start)::TIMESTAMPTZ, MAX(month_start)::TIMESTAMPTZ
  FROM public.leaderboard_monthly;
END;
$$;
