-- =====================================================================
-- 09_friend_challenges.sql
--
-- Sfide dirette tra amici (Milestone 6c). Stato consolidato di
-- alter-021-friend-challenges.sql + alter-022-security-fixes.sql
-- (complete_friend_challenge/abandon_friend_challenge: aggiunto il
-- controllo che il chiamante sia uno dei due giocatori, mancante
-- nell'originale — vedi ROADMAP_SECURITY.md).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty IN (1, 2, 3)),
  league TEXT DEFAULT 'seria_a' CHECK (league IN ('seria_a', 'premier', 'la_liga', 'bundesliga', 'ligue_1')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired', 'abandoned')),
  room_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_friend_challenges_creator ON public.friend_challenges (creator_id);
CREATE INDEX IF NOT EXISTS idx_friend_challenges_opponent ON public.friend_challenges (opponent_id);
CREATE INDEX IF NOT EXISTS idx_friend_challenges_status ON public.friend_challenges (status) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.friend_challenge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.friend_challenges(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty INTEGER NOT NULL,
  league TEXT NOT NULL,
  winner_id UUID,
  creator_score INTEGER DEFAULT 0,
  opponent_score INTEGER DEFAULT 0,
  result TEXT CHECK (result IN ('creator_won', 'opponent_won', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_friend_challenge_history_creator ON public.friend_challenge_history (creator_id);
CREATE INDEX IF NOT EXISTS idx_friend_challenge_history_opponent ON public.friend_challenge_history (opponent_id);

ALTER TABLE public.friend_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_challenge_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own friend challenges" ON public.friend_challenges;
CREATE POLICY "Users can view own friend challenges"
ON public.friend_challenges FOR SELECT TO authenticated
USING (creator_id = auth.uid() OR opponent_id = auth.uid());

DROP POLICY IF EXISTS "Users can create friend challenges" ON public.friend_challenges;
CREATE POLICY "Users can create friend challenges"
ON public.friend_challenges FOR INSERT TO authenticated
WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own friend challenges" ON public.friend_challenges;
CREATE POLICY "Users can update own friend challenges"
ON public.friend_challenges FOR UPDATE TO authenticated
USING (creator_id = auth.uid() OR opponent_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own challenge history" ON public.friend_challenge_history;
CREATE POLICY "Users can view own challenge history"
ON public.friend_challenge_history FOR SELECT TO authenticated
USING (creator_id = auth.uid() OR opponent_id = auth.uid());

-- =====================================================================
-- Funzioni RPC
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_friend_challenge(
  p_opponent_id UUID,
  p_difficulty INTEGER DEFAULT 1,
  p_league TEXT DEFAULT 'seria_a'
)
RETURNS TABLE (challenge_id UUID, room_id TEXT, status TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_id UUID;
  v_challenge_id UUID;
  v_room_id TEXT;
BEGIN
  v_creator_id := auth.uid();

  IF v_creator_id = p_opponent_id THEN
    RAISE EXCEPTION 'Non puoi sfidare te stesso';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.friends
    WHERE (user_id = v_creator_id AND friend_id = p_opponent_id)
       OR (user_id = p_opponent_id AND friend_id = v_creator_id)
  ) THEN
    RAISE EXCEPTION 'Puoi sfidare solo i tuoi amici';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friend_challenges
    WHERE ((creator_id = v_creator_id AND opponent_id = p_opponent_id)
       OR (creator_id = p_opponent_id AND opponent_id = v_creator_id))
    AND friend_challenges.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Esiste già una sfida pendente con questo amico';
  END IF;

  v_room_id := 'friend_' || gen_random_uuid()::TEXT;

  UPDATE public.friend_challenges
  SET status = 'expired', updated_at = NOW()
  WHERE friend_challenges.status = 'pending'
  AND friend_challenges.expires_at < NOW();

  INSERT INTO public.friend_challenges (creator_id, opponent_id, difficulty, league, room_id, status)
  VALUES (v_creator_id, p_opponent_id, p_difficulty, p_league, v_room_id, 'pending')
  RETURNING id INTO v_challenge_id;

  RETURN QUERY
  SELECT v_challenge_id, v_room_id, 'pending'::TEXT AS status, (NOW() + INTERVAL '10 minutes')::TIMESTAMPTZ AS expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_challenge(p_challenge_id UUID)
RETURNS TABLE (
  challenge_id UUID, room_id TEXT, creator_id UUID, creator_nickname TEXT,
  creator_tier TEXT, difficulty INTEGER, league TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_opponent_id UUID;
  v_challenge RECORD;
BEGIN
  v_opponent_id := auth.uid();

  SELECT * INTO v_challenge
  FROM public.friend_challenges
  WHERE friend_challenges.id = p_challenge_id
    AND friend_challenges.opponent_id = v_opponent_id
    AND friend_challenges.status = 'pending';

  IF v_challenge IS NULL THEN
    RAISE EXCEPTION 'Sfida non trovata o già elaborata';
  END IF;

  IF v_challenge.expires_at < NOW() THEN
    UPDATE public.friend_challenges
    SET status = 'expired', updated_at = NOW()
    WHERE friend_challenges.id = p_challenge_id;
    RAISE EXCEPTION 'Sfida scaduta';
  END IF;

  UPDATE public.friend_challenges
  SET status = 'accepted', updated_at = NOW()
  WHERE friend_challenges.id = p_challenge_id;

  RETURN QUERY
  SELECT
    v_challenge.id, v_challenge.room_id, v_challenge.creator_id,
    COALESCE(p.nickname, p.first_name, 'Sfidante')::TEXT,
    COALESCE(p.tier, 'bronze')::TEXT,
    v_challenge.difficulty, v_challenge.league
  FROM public.profiles p
  WHERE p.id = v_challenge.creator_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_friend_challenge(p_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_opponent_id UUID;
BEGIN
  v_opponent_id := auth.uid();

  UPDATE public.friend_challenges
  SET status = 'declined', updated_at = NOW()
  WHERE friend_challenges.id = p_challenge_id
    AND friend_challenges.opponent_id = v_opponent_id
    AND friend_challenges.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sfida non trovata o già elaborata';
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_friend_challenges()
RETURNS TABLE (
  id UUID, creator_id UUID, creator_nickname TEXT, creator_tier TEXT,
  opponent_id UUID, opponent_nickname TEXT, opponent_tier TEXT, room_id TEXT,
  difficulty INTEGER, league TEXT, status TEXT, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ
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
    fc.id, fc.creator_id,
    COALESCE(pc.nickname, pc.first_name, 'Sfidante')::TEXT,
    COALESCE(pc.tier, 'bronze')::TEXT,
    fc.opponent_id,
    COALESCE(po.nickname, po.first_name, 'Avversario')::TEXT,
    COALESCE(po.tier, 'bronze')::TEXT,
    fc.room_id, fc.difficulty, fc.league, fc.status, fc.created_at, fc.expires_at
  FROM public.friend_challenges fc
  LEFT JOIN public.profiles pc ON fc.creator_id = pc.id
  LEFT JOIN public.profiles po ON fc.opponent_id = po.id
  WHERE (fc.creator_id = v_current_user OR fc.opponent_id = v_current_user)
    AND fc.status = 'pending'
  ORDER BY fc.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_challenge_history()
RETURNS TABLE (
  id UUID, challenge_id UUID, opponent_id UUID, opponent_nickname TEXT,
  opponent_tier TEXT, difficulty INTEGER, league TEXT, result TEXT,
  score INTEGER, created_at TIMESTAMPTZ
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
    fch.id, fch.challenge_id,
    CASE WHEN fch.creator_id = v_current_user THEN fch.opponent_id ELSE fch.creator_id END,
    COALESCE(p.nickname, p.first_name, 'Avversario')::TEXT,
    COALESCE(p.tier, 'bronze')::TEXT,
    fch.difficulty, fch.league, fch.result,
    CASE WHEN fch.creator_id = v_current_user THEN fch.creator_score ELSE fch.opponent_score END,
    fch.created_at
  FROM public.friend_challenge_history fch
  LEFT JOIN public.profiles p ON CASE WHEN fch.creator_id = v_current_user THEN fch.opponent_id ELSE fch.creator_id END = p.id
  WHERE fch.creator_id = v_current_user OR fch.opponent_id = v_current_user
  ORDER BY fch.created_at DESC
  LIMIT 50;
END;
$$;

-- complete_friend_challenge — con fix di sicurezza: il chiamante deve
-- essere uno dei due giocatori, e p_winner_id deve essere uno dei due.
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

-- abandon_friend_challenge — con fix di sicurezza: il chiamante deve
-- essere uno dei due giocatori (auth.uid() era letto ma mai verificato).
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
    0, 0, v_result
  );

  RETURN TRUE;
END;
$$;

-- Manutenzione (non chiamata dal client, uso amministrativo/cron)
CREATE OR REPLACE FUNCTION public.cleanup_friend_challenges()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.friend_challenges
  SET status = 'expired', updated_at = NOW()
  WHERE friend_challenges.status = 'pending'
  AND friend_challenges.expires_at < NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_friend_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_friend_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_friend_challenges TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_challenge_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_friend_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_friend_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_friend_challenges TO authenticated;
