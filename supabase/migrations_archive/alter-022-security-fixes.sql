-- =====================================================================
-- alter-022-security-fixes.sql
--
-- Corregge vulnerabilità di controllo accessi (broken access control /
-- IDOR) trovate in un audit di sicurezza: diverse funzioni RPC
-- SECURITY DEFINER scrivevano dati per un p_user_id/challenge arbitrario
-- senza verificare che il chiamante (auth.uid()) fosse autorizzato.
--
-- Ogni funzione qui sotto è una CREATE OR REPLACE della versione già
-- esistente (stessa firma, stesso comportamento per le chiamate
-- legittime), con l'aggiunta del controllo di autorizzazione mancante.
-- Da eseguire DOPO tutte le migrazioni precedenti.
-- =====================================================================

-- =====================================================================
-- 1. save_match_result — CRITICO
-- Prima: chiunque poteva scrivere un risultato partita per QUALSIASI
-- p_user_id, alterando punteggio/tier/leaderboard di un altro utente.
-- (versione precedente: supabase/alter-003-nickname.sql)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.save_match_result(
  p_user_id UUID,
  p_player_name TEXT,
  p_opponent_name TEXT,
  p_player_tier TEXT,
  p_opponent_tier TEXT,
  p_player_score INTEGER,
  p_opponent_score INTEGER,
  p_is_win BOOLEAN,
  p_difficulty INTEGER DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_id UUID;
  v_won_delta INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a salvare il risultato per un altro utente';
  END IF;

  v_won_delta := CASE WHEN p_is_win THEN 1 ELSE 0 END;

  -- Inserisci nello storico
  INSERT INTO public.matches_history (
    user_id,
    player_name,
    opponent_name,
    player_tier,
    opponent_tier,
    player_score,
    opponent_score,
    is_win,
    difficulty,
    played_at
  ) VALUES (
    p_user_id,
    p_player_name,
    p_opponent_name,
    p_player_tier,
    p_opponent_tier,
    p_player_score,
    p_opponent_score,
    p_is_win,
    p_difficulty,
    NOW()
  )
  RETURNING id INTO v_match_id;

  -- Aggiorna i punteggi dell'utente
  UPDATE public.profiles
  SET
    total_score = total_score + p_player_score,
    matches_played = matches_played + 1,
    matches_won = matches_won + v_won_delta,
    tier = CASE
      WHEN total_score + p_player_score >= 5001 THEN 'diamond'
      WHEN total_score + p_player_score >= 3001 THEN 'platinum'
      WHEN total_score + p_player_score >= 1501 THEN 'gold'
      WHEN total_score + p_player_score >= 501 THEN 'silver'
      ELSE 'bronze'
    END,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Aggiorna classifica settimanale
  PERFORM public.update_weekly_leaderboard(p_user_id, p_player_score, 1, v_won_delta);

  -- Aggiorna classifica mensile
  PERFORM public.update_monthly_leaderboard(p_user_id, p_player_score, 1, v_won_delta);

  RETURN v_match_id;
END;
$$;

-- =====================================================================
-- 2. update_profile_stats — CRITICO
-- Stesso problema di save_match_result.
-- (versione precedente: supabase/alter-010-statistics.sql)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_profile_stats(
  p_user_id UUID,
  p_is_win BOOLEAN,
  p_score INTEGER DEFAULT 0,
  p_is_abandoned BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INTEGER;
  v_current_streak_type TEXT;
  v_longest_win_streak INTEGER;
  v_longest_loss_streak INTEGER;
  v_new_streak INTEGER;
  v_new_streak_type TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato ad aggiornare le statistiche di un altro utente';
  END IF;

  -- Ottieni statistiche attuali
  SELECT COALESCE(current_streak, 0), COALESCE(streak_type, 'none'),
         COALESCE(longest_win_streak, 0), COALESCE(longest_loss_streak, 0)
  INTO v_current_streak, v_current_streak_type, v_longest_win_streak, v_longest_loss_streak
  FROM public.profiles
  WHERE id = p_user_id;

  -- Calcola nuova streak
  IF p_is_abandoned THEN
    v_new_streak := 0;
    v_new_streak_type := 'none';
  ELSIF p_is_win THEN
    IF v_current_streak_type = 'win' THEN
      v_new_streak := v_current_streak + 1;
      v_new_streak_type := 'win';
    ELSE
      v_new_streak := 1;
      v_new_streak_type := 'win';
    END IF;
  ELSE
    IF v_current_streak_type = 'loss' THEN
      v_new_streak := v_current_streak + 1;
      v_new_streak_type := 'loss';
    ELSE
      v_new_streak := 1;
      v_new_streak_type := 'loss';
    END IF;
  END IF;

  -- Aggiorna record
  UPDATE public.profiles
  SET
    matches_played = COALESCE(matches_played, 0) + 1,
    matches_won = COALESCE(matches_won, 0) + CASE WHEN p_is_win THEN 1 ELSE 0 END,
    matches_lost = COALESCE(matches_lost, 0) + CASE WHEN NOT p_is_win AND NOT p_is_abandoned THEN 1 ELSE 0 END,
    matches_abandoned = COALESCE(matches_abandoned, 0) + CASE WHEN p_is_abandoned THEN 1 ELSE 0 END,
    total_score = COALESCE(total_score, 0) + GREATEST(p_score, 0),
    best_score = GREATEST(COALESCE(best_score, 0), p_score),
    current_streak = v_new_streak,
    streak_type = v_new_streak_type,
    longest_win_streak = GREATEST(COALESCE(longest_win_streak, 0),
      CASE WHEN v_new_streak_type = 'win' THEN v_new_streak ELSE 0 END),
    longest_loss_streak = GREATEST(COALESCE(longest_loss_streak, 0),
      CASE WHEN v_new_streak_type = 'loss' THEN v_new_streak ELSE 0 END),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- =====================================================================
-- 3. complete_friend_challenge — CRITICO
-- Prima: chiunque poteva chiudere una sfida-amico dichiarando un
-- p_winner_id/punteggi arbitrari, senza essere uno dei due giocatori.
-- (versione precedente: supabase/alter-021-friend-challenges.sql)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.complete_friend_challenge(
  p_challenge_id UUID,
  p_winner_id UUID,
  p_creator_score INTEGER,
  p_opponent_score INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge RECORD;
  v_result TEXT;
BEGIN
  SELECT * INTO v_challenge
  FROM public.friend_challenges
  WHERE friend_challenges.id = p_challenge_id AND friend_challenges.status = 'accepted';

  IF v_challenge IS NULL THEN
    RETURN FALSE;
  END IF;

  IF auth.uid() IS NULL OR (auth.uid() <> v_challenge.creator_id AND auth.uid() <> v_challenge.opponent_id) THEN
    RETURN FALSE;
  END IF;

  IF p_winner_id <> v_challenge.creator_id AND p_winner_id <> v_challenge.opponent_id THEN
    RETURN FALSE;
  END IF;

  IF p_winner_id = v_challenge.creator_id THEN
    v_result := 'creator_won';
  ELSE
    v_result := 'opponent_won';
  END IF;

  UPDATE public.friend_challenges
  SET status = 'completed', updated_at = NOW()
  WHERE friend_challenges.id = p_challenge_id;

  INSERT INTO public.friend_challenge_history (
    challenge_id, creator_id, opponent_id, difficulty, league,
    winner_id, creator_score, opponent_score, result
  ) VALUES (
    p_challenge_id, v_challenge.creator_id, v_challenge.opponent_id,
    v_challenge.difficulty, v_challenge.league,
    p_winner_id, p_creator_score, p_opponent_score, v_result
  );

  RETURN TRUE;
END;
$$;

-- =====================================================================
-- 4. abandon_friend_challenge — ALTO
-- Prima: auth.uid() veniva letto ma mai usato per limitare chi può
-- abbandonare la sfida di altri due utenti.
-- (versione precedente: supabase/alter-021-friend-challenges.sql)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.abandon_friend_challenge(p_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
  v_challenge RECORD;
  v_result TEXT;
BEGIN
  v_current_user := auth.uid();

  SELECT * INTO v_challenge
  FROM public.friend_challenges
  WHERE friend_challenges.id = p_challenge_id AND friend_challenges.status = 'accepted';

  IF v_challenge IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_current_user IS NULL OR (v_current_user <> v_challenge.creator_id AND v_current_user <> v_challenge.opponent_id) THEN
    RETURN FALSE;
  END IF;

  v_result := 'abandoned';

  UPDATE public.friend_challenges
  SET status = 'abandoned', updated_at = NOW()
  WHERE friend_challenges.id = p_challenge_id;

  INSERT INTO public.friend_challenge_history (
    challenge_id, creator_id, opponent_id, difficulty, league,
    winner_id, creator_score, opponent_score, result
  ) VALUES (
    p_challenge_id, v_challenge.creator_id, v_challenge.opponent_id,
    v_challenge.difficulty, v_challenge.league,
    CASE WHEN v_challenge.creator_id = v_current_user THEN v_challenge.opponent_id ELSE v_challenge.creator_id END,
    0,
    0,
    v_result
  );

  RETURN TRUE;
END;
$$;

-- =====================================================================
-- 5. complete_challenge / expire_challenge (sfide via link) — MEDIO
-- Prima: chiunque conoscesse l'id della sfida (es. dal link pubblico
-- via get_challenge_by_token) poteva terminarla/scaderla per i due
-- giocatori reali.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.complete_challenge(p_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge RECORD;
BEGIN
  SELECT * INTO v_challenge
  FROM public.challenges
  WHERE id = p_challenge_id AND status = 'accepted';

  IF v_challenge IS NULL THEN
    RETURN FALSE;
  END IF;

  IF auth.uid() IS NULL OR (auth.uid() <> v_challenge.creator_id AND auth.uid() <> v_challenge.opponent_id) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.challenges
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_challenge_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_challenge(p_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge RECORD;
BEGIN
  SELECT * INTO v_challenge
  FROM public.challenges
  WHERE id = p_challenge_id AND status = 'accepted';

  IF v_challenge IS NULL THEN
    RETURN FALSE;
  END IF;

  IF auth.uid() IS NULL OR (auth.uid() <> v_challenge.creator_id AND auth.uid() <> v_challenge.opponent_id) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.challenges
  SET status = 'expired', updated_at = NOW()
  WHERE id = p_challenge_id;

  RETURN TRUE;
END;
$$;

-- =====================================================================
-- 6. run_retention_cleanup — ALTO
-- Funzione di manutenzione admin: non deve essere chiamabile dal
-- browser (anon/authenticated), solo con la service role key.
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.run_retention_cleanup() FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- 7. record_audit_event / record_auth_event / record_game_event — BASSO
-- Prima: p_user_id era un parametro libero, permettendo di iniettare
-- eventi di audit falsi a nome di un altro utente reale. Consentiamo
-- comunque p_user_id NULL (eventi anonimi legittimi, es. login_failed
-- prima di sapere se l'utente esiste).
-- =====================================================================
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
  IF p_user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_log (user_id, event_type, event_category, description, metadata, ip_address, user_agent)
  VALUES (p_user_id, p_event_type, p_event_category, p_description, p_metadata, p_ip_address, p_user_agent);
END;
$$;
