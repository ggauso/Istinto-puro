-- =====================================================================
-- 15_friends_leaderboard.sql
--
-- Milestone 11 (ROADMAP_FEATURES.md): classifica filtrata sui soli amici
-- dell'utente (+ l'utente stesso). Riusa il sistema amicizie esistente
-- (08_friends.sql): `friends` è già simmetrica a livello di scrittura
-- (accept_friend_request inserisce sia (A,B) che (B,A)), quindi un singolo
-- filtro `WHERE user_id = p_user_id` sulla tabella basta — nessun OR sulle
-- due direzioni serve qui (a differenza di remove_friend/are_friends, che
-- devono gestire entrambe le righe per cancellare/verificare).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_friends_leaderboard(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  rank INTEGER, user_id UUID, display_name TEXT, total_score INTEGER,
  tier TEXT, matches_played INTEGER, matches_won INTEGER, win_rate INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a leggere la classifica amici di un altro utente';
  END IF;

  RETURN QUERY
  WITH friend_ids AS (
    -- Alias "f" necessario: altrimenti "user_id" è ambiguo qui dentro, dato
    -- che è anche il nome di una colonna di output della funzione stessa
    -- (RETURNS TABLE), visibile come variabile in questo scope plpgsql.
    SELECT f.friend_id AS id FROM public.friends f WHERE f.user_id = p_user_id
    UNION
    SELECT p_user_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.total_score DESC)::INTEGER AS rank,
    p.id::UUID,
    COALESCE(NULLIF(p.nickname, ''), NULLIF(p.first_name, ''), 'Giocatore')::TEXT AS display_name,
    p.total_score::INTEGER,
    p.tier::TEXT,
    p.matches_played::INTEGER,
    p.matches_won::INTEGER,
    CASE WHEN p.matches_played > 0 THEN ((p.matches_won::FLOAT / p.matches_played::FLOAT) * 100)::INTEGER ELSE 0 END::INTEGER AS win_rate
  FROM public.profiles p
  JOIN friend_ids fi ON fi.id = p.id
  ORDER BY p.total_score DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_friends_leaderboard(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_friends_leaderboard(UUID, INTEGER) TO authenticated;
