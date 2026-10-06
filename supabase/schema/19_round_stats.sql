-- =====================================================================
-- 19_round_stats.sql
--
-- Milestone 7, Task 7.2 (ROADMAP_FEATURES.md): statistiche che richiedono
-- dati per-round (ogni singola risposta data durante una partita), non
-- solo l'esito finale già tracciato in `matches_history`. Nuova tabella
-- `round_answers`, scritta fire-and-forget da `validatePlayer`
-- (gameplaySlice.ts) ad ogni risposta, corretta o sbagliata.
--
-- Scelta di design: lettura privata (solo il proprietario, come
-- `matches_history`) — sono statistiche personali di dettaglio (ogni
-- singolo giocatore indovinato/sbagliato), non un leaderboard pubblico.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.round_answers (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team1_id BIGINT REFERENCES public.teams(id) ON DELETE SET NULL,
  team2_id BIGINT REFERENCES public.teams(id) ON DELETE SET NULL,
  -- Nome del giocatore CORRETTO per quel round (risposta attesa), non
  -- l'input digitato dall'utente — serve per "giocatori più indovinati"
  -- anche sulle risposte sbagliate (sapere quale giocatore non è stato
  -- indovinato è utile quanto sapere quale è stato indovinato).
  player_name TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1,
  response_time_ms INTEGER,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_round_answers_user_id ON public.round_answers (user_id);
CREATE INDEX IF NOT EXISTS idx_round_answers_user_difficulty ON public.round_answers (user_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_round_answers_player_name ON public.round_answers (player_name);

ALTER TABLE public.round_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own round answers" ON public.round_answers;
CREATE POLICY "Users can view own round answers" ON public.round_answers
  FOR SELECT USING (auth.uid() = user_id);

-- Nessuna policy INSERT/UPDATE/DELETE diretta: l'unica scrittura passa da
-- record_round_answer() sotto (SECURITY DEFINER), stesso principio già
-- applicato a tournaments/achievements (vedi commento in 11_tournaments.sql).

-- =====================================================================
-- record_round_answer — scrittura, chiamata da validatePlayer per OGNI
-- round (corretto o sbagliato), fire-and-forget lato client.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.record_round_answer(
  p_user_id UUID,
  p_team1_id BIGINT,
  p_team2_id BIGINT,
  p_player_name TEXT,
  p_is_correct BOOLEAN,
  p_difficulty INTEGER DEFAULT 1,
  p_response_time_ms INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a registrare una risposta per un altro utente';
  END IF;

  INSERT INTO public.round_answers (
    user_id, team1_id, team2_id, player_name, is_correct, difficulty, response_time_ms
  ) VALUES (
    p_user_id, p_team1_id, p_team2_id, LEFT(COALESCE(p_player_name, ''), 100),
    p_is_correct, p_difficulty, p_response_time_ms
  );
END;
$$;

-- =====================================================================
-- Task 7.2.1 — Combinazioni squadre più comuni. Normalizza l'ordine della
-- coppia con LEAST/GREATEST: get_random_match assegna team1/team2 in modo
-- casuale, la stessa combinazione di squadre può comparire scambiata tra
-- due partite diverse e va contata come la stessa combo.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_common_team_combos(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  team_a_id BIGINT, team_a_name TEXT,
  team_b_id BIGINT, team_b_name TEXT,
  times_played INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a leggere le statistiche di un altro utente';
  END IF;

  RETURN QUERY
  WITH combos AS (
    SELECT
      LEAST(ra.team1_id, ra.team2_id) AS ta,
      GREATEST(ra.team1_id, ra.team2_id) AS tb,
      COUNT(*)::INTEGER AS cnt
    FROM public.round_answers ra
    WHERE ra.user_id = p_user_id AND ra.team1_id IS NOT NULL AND ra.team2_id IS NOT NULL
    GROUP BY ta, tb
  )
  SELECT c.ta, t1.name, c.tb, t2.name, c.cnt
  FROM combos c
  JOIN public.teams t1 ON t1.id = c.ta
  JOIN public.teams t2 ON t2.id = c.tb
  ORDER BY c.cnt DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================================
-- Task 7.2.2 — Risposte corrette vs errate per difficoltà (1-4, include
-- Hard Mode).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_accuracy_by_difficulty(p_user_id UUID)
RETURNS TABLE (
  difficulty INTEGER, correct_count INTEGER, incorrect_count INTEGER, accuracy_pct NUMERIC(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a leggere le statistiche di un altro utente';
  END IF;

  RETURN QUERY
  SELECT
    ra.difficulty,
    COUNT(*) FILTER (WHERE ra.is_correct)::INTEGER,
    COUNT(*) FILTER (WHERE NOT ra.is_correct)::INTEGER,
    ROUND(100.0 * COUNT(*) FILTER (WHERE ra.is_correct) / COUNT(*), 2)
  FROM public.round_answers ra
  WHERE ra.user_id = p_user_id
  GROUP BY ra.difficulty
  ORDER BY ra.difficulty;
END;
$$;

-- =====================================================================
-- Task 7.2.3 — Tempo medio di risposta, complessivo e per difficoltà.
-- ROLLUP(difficulty) produce una riga per ogni difficoltà più una riga
-- finale con difficulty = NULL (il totale complessivo) in una sola query.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_avg_response_time(p_user_id UUID)
RETURNS TABLE (
  difficulty INTEGER, avg_response_time_ms INTEGER, sample_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a leggere le statistiche di un altro utente';
  END IF;

  RETURN QUERY
  SELECT
    ra.difficulty,
    ROUND(AVG(ra.response_time_ms))::INTEGER,
    COUNT(*)::INTEGER
  FROM public.round_answers ra
  WHERE ra.user_id = p_user_id AND ra.response_time_ms IS NOT NULL
  GROUP BY ROLLUP(ra.difficulty)
  ORDER BY ra.difficulty NULLS FIRST;
END;
$$;

-- =====================================================================
-- Task 7.2.4 — Giocatori più indovinati (solo risposte corrette).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_most_guessed_players(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  player_name TEXT, correct_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a leggere le statistiche di un altro utente';
  END IF;

  RETURN QUERY
  SELECT ra.player_name, COUNT(*)::INTEGER AS correct_count
  FROM public.round_answers ra
  WHERE ra.user_id = p_user_id AND ra.is_correct = TRUE
  GROUP BY ra.player_name
  ORDER BY correct_count DESC, ra.player_name
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.record_round_answer(UUID, BIGINT, BIGINT, TEXT, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_common_team_combos(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_accuracy_by_difficulty(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_avg_response_time(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_most_guessed_players(UUID, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_round_answer(UUID, BIGINT, BIGINT, TEXT, BOOLEAN, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_common_team_combos(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accuracy_by_difficulty(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_avg_response_time(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_most_guessed_players(UUID, INTEGER) TO authenticated;
