-- =====================================================================
-- 14_match_history.sql
--
-- Milestone 7, Task 7.3 (ROADMAP_FEATURES.md): Storico Partite — lista
-- paginata delle partite giocate con filtro per modalità (PvP/IA) e
-- risultato (vittoria/sconfitta), dettaglio già tutto incluso in ogni riga
-- (nessuna RPC aggiuntiva per il "dettaglio singola partita").
--
-- Nessuna nuova tabella: usa `matches_history` (consolidata in
-- 03_matches_and_leaderboard.sql), che grazie alla Milestone 8
-- (Achievement) ora si popola davvero durante il gioco reale — prima era
-- scritta da `save_match_result` ma la funzione non veniva mai invocata
-- dal client (bug corretto in GameScreen.tsx, vedi DOCUMENTATION.md).
--
-- Task 7.2 (combinazioni squadre più comuni, tempo medio di risposta,
-- giocatori più indovinati) resta FUORI SCOPE qui: richiederebbe una
-- tabella di tracciamento per-round che oggi non esiste (matches_history
-- registra solo l'esito finale di una partita, non le singole risposte).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_match_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_mode TEXT DEFAULT NULL,
  p_result TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  opponent_name TEXT,
  player_tier TEXT,
  opponent_tier TEXT,
  player_score INTEGER,
  opponent_score INTEGER,
  is_win BOOLEAN,
  is_pvp BOOLEAN,
  difficulty INTEGER,
  played_at TIMESTAMPTZ,
  total_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a leggere lo storico partite di un altro utente';
  END IF;

  IF p_mode IS NOT NULL AND p_mode NOT IN ('pvp', 'ai') THEN
    RAISE EXCEPTION 'Modalità non valida: %', p_mode;
  END IF;

  IF p_result IS NOT NULL AND p_result NOT IN ('win', 'loss') THEN
    RAISE EXCEPTION 'Risultato non valido: %', p_result;
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    p_limit := 20;
  END IF;

  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.opponent_name,
    m.player_tier,
    m.opponent_tier,
    m.player_score,
    m.opponent_score,
    m.is_win,
    m.is_pvp,
    m.difficulty,
    m.played_at,
    COUNT(*) OVER()::INTEGER AS total_count
  FROM public.matches_history m
  WHERE m.user_id = p_user_id
    AND (p_mode IS NULL OR (p_mode = 'pvp' AND m.is_pvp = TRUE) OR (p_mode = 'ai' AND m.is_pvp = FALSE))
    AND (p_result IS NULL OR (p_result = 'win' AND m.is_win = TRUE) OR (p_result = 'loss' AND m.is_win = FALSE))
  ORDER BY m.played_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_history(UUID, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_history(UUID, INTEGER, INTEGER, TEXT, TEXT) TO authenticated;
