-- =====================================================================
-- 21_public_data_nickname_only.sql
--
-- Gli altri utenti devono vedere solo il nickname:
--  1. il nickname viene salvato alla registrazione (metadata `nickname`);
--  2. i profili senza nickname ricevono un nickname generato;
--  3. classifiche e RPC pubbliche non restituiscono più nome/cognome;
--  4. la tabella profiles è leggibile solo dal proprietario (prima era
--     leggibile da chiunque, anche anonimo, con tutte le colonne).
--     I dati degli altri utenti passano solo dalle RPC SECURITY DEFINER.
-- =====================================================================

-- 1. Trigger di registrazione: salva anche il nickname
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    nickname,
    birth_date,
    favorite_team,
    privacy_accepted,
    avatar_url
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(
      NULLIF(btrim(new.raw_user_meta_data->>'nickname'), ''),
      'Giocatore' || substr(replace(new.id::text, '-', ''), 1, 6)
    ),
    NULLIF(new.raw_user_meta_data->>'birth_date', '')::DATE,
    new.raw_user_meta_data->>'favorite_team',
    COALESCE((new.raw_user_meta_data->>'privacy_accepted')::BOOLEAN, false),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill dei profili esistenti senza nickname
UPDATE public.profiles
SET nickname = 'Giocatore' || substr(replace(id::text, '-', ''), 1, 6)
WHERE nickname IS NULL OR btrim(nickname) = '';

-- 3a. Classifiche: mostrano il nickname, non il nome
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_limit INTEGER DEFAULT 100,
  p_tier TEXT DEFAULT NULL
)
RETURNS TABLE (
  rank INTEGER, user_id UUID, display_name TEXT, total_score INTEGER,
  tier TEXT, matches_played INTEGER, matches_won INTEGER, win_rate INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.total_score DESC)::INTEGER AS rank,
    p.id::UUID,
    COALESCE(NULLIF(p.nickname, ''), 'Anonimo')::TEXT AS display_name,
    p.total_score::INTEGER,
    p.tier::TEXT,
    p.matches_played::INTEGER,
    p.matches_won::INTEGER,
    CASE WHEN p.matches_played > 0 THEN ((p.matches_won::FLOAT / p.matches_played::FLOAT) * 100)::INTEGER ELSE 0 END::INTEGER AS win_rate
  FROM public.profiles p
  WHERE p.tier = COALESCE(p_tier, p.tier)
  ORDER BY p.total_score DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  rank INTEGER, user_id UUID, display_name TEXT, total_score INTEGER,
  tier TEXT, matches_played INTEGER, matches_won INTEGER, win_rate INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY lw.total_score DESC)::INTEGER AS rank,
    lw.user_id::UUID,
    COALESCE(NULLIF(p.nickname, ''), 'Anonimo')::TEXT AS display_name,
    lw.total_score::INTEGER,
    p.tier::TEXT,
    lw.matches_played::INTEGER,
    lw.matches_won::INTEGER,
    CASE WHEN lw.matches_played > 0 THEN ((lw.matches_won::FLOAT / lw.matches_played::FLOAT) * 100)::INTEGER ELSE 0 END::INTEGER AS win_rate
  FROM public.leaderboard_weekly lw
  JOIN public.profiles p ON lw.user_id = p.id
  WHERE lw.week_start = public.get_week_start()
  ORDER BY lw.total_score DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  rank INTEGER, user_id UUID, display_name TEXT, total_score INTEGER,
  tier TEXT, matches_played INTEGER, matches_won INTEGER, win_rate INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY lm.total_score DESC)::INTEGER AS rank,
    lm.user_id::UUID,
    COALESCE(NULLIF(p.nickname, ''), 'Anonimo')::TEXT AS display_name,
    lm.total_score::INTEGER,
    p.tier::TEXT,
    lm.matches_played::INTEGER,
    lm.matches_won::INTEGER,
    CASE WHEN lm.matches_played > 0 THEN ((lm.matches_won::FLOAT / lm.matches_played::FLOAT) * 100)::INTEGER ELSE 0 END::INTEGER AS win_rate
  FROM public.leaderboard_monthly lm
  JOIN public.profiles p ON lm.user_id = p.id
  WHERE lm.month_start = public.get_month_start()
  ORDER BY lm.total_score DESC
  LIMIT p_limit;
END;
$$;

-- 3b. RPC pubbliche: via first_name/last_name dal risultato (cambia la firma)
DROP FUNCTION IF EXISTS public.get_user_info(UUID);
CREATE FUNCTION public.get_user_info(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  nickname TEXT,
  tier TEXT,
  total_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id::UUID,
    p.nickname::TEXT,
    p.tier::TEXT,
    p.total_score::INTEGER
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.search_users(TEXT);
CREATE FUNCTION public.search_users(p_nickname TEXT)
RETURNS TABLE (id UUID, nickname TEXT, tier TEXT, total_score INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nickname,
    p.tier,
    p.total_score
  FROM public.profiles p
  WHERE p.nickname ILIKE '%' || p_nickname || '%'
    AND p.id != auth.uid()
  ORDER BY
    CASE
      WHEN p.nickname ILIKE p_nickname || '%' THEN 1
      WHEN p.nickname ILIKE '%' || p_nickname || '%' THEN 2
      ELSE 3
    END
  LIMIT 10;
END;
$$;

DROP FUNCTION IF EXISTS public.get_friends();
CREATE FUNCTION public.get_friends()
RETURNS TABLE (
  id UUID, friend_id UUID, nickname TEXT, tier TEXT, total_score INTEGER,
  is_online BOOLEAN, last_login TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  RETURN QUERY
  SELECT
    f.id,
    f.friend_id,
    p.nickname,
    p.tier,
    p.total_score,
    FALSE AS is_online,
    p.updated_at AS last_login
  FROM public.friends f
  JOIN public.profiles p ON f.friend_id = p.id
  WHERE f.user_id = v_current_user
  ORDER BY p.nickname;
END;
$$;

DROP FUNCTION IF EXISTS public.get_pending_friend_requests();
CREATE FUNCTION public.get_pending_friend_requests()
RETURNS TABLE (id UUID, from_user_id UUID, nickname TEXT, tier TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  RETURN QUERY
  SELECT
    fr.id,
    fr.from_user_id,
    p.nickname,
    p.tier,
    fr.created_at
  FROM public.friend_requests fr
  JOIN public.profiles p ON fr.from_user_id = p.id
  WHERE fr.to_user_id = v_current_user
    AND fr.status = 'pending'
  ORDER BY fr.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.get_sent_friend_requests();
CREATE FUNCTION public.get_sent_friend_requests()
RETURNS TABLE (id UUID, to_user_id UUID, nickname TEXT, tier TEXT, status TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  RETURN QUERY
  SELECT
    fr.id,
    fr.to_user_id,
    p.nickname,
    p.tier,
    fr.status,
    fr.created_at
  FROM public.friend_requests fr
  JOIN public.profiles p ON fr.to_user_id = p.id
  WHERE fr.from_user_id = v_current_user
  ORDER BY fr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_friend_requests TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sent_friend_requests TO authenticated;

-- 4. profiles leggibile solo dal proprietario
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile." ON public.profiles;
CREATE POLICY "Users can view own profile." ON public.profiles
  FOR SELECT USING (auth.uid() = id);
