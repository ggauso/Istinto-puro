-- =====================================================
-- Milestone 6c: Sfide Dirette tra Amici
-- =====================================================

-- Tabella sfide tra amici
CREATE TABLE IF NOT EXISTS public.friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty IN (1, 2, 3)), -- 1=Facile, 2=Medio, 3=Difficile
  league TEXT DEFAULT 'seria_a' CHECK (league IN ('seria_a', 'premier', 'la_liga', 'bundesliga', 'ligue_1')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired', 'abandoned')),
  room_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_friend_challenges_creator ON public.friend_challenges (creator_id);
CREATE INDEX IF NOT EXISTS idx_friend_challenges_opponent ON public.friend_challenges (opponent_id);
CREATE INDEX IF NOT EXISTS idx_friend_challenges_status ON public.friend_challenges (status) WHERE status = 'pending';

-- Tabella storico sfide
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

-- Indici storico
CREATE INDEX IF NOT EXISTS idx_friend_challenge_history_creator ON public.friend_challenge_history (creator_id);
CREATE INDEX IF NOT EXISTS idx_friend_challenge_history_opponent ON public.friend_challenge_history (opponent_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.friend_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_challenge_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own friend challenges" ON public.friend_challenges;
DROP POLICY IF EXISTS "Users can create friend challenges" ON public.friend_challenges;
DROP POLICY IF EXISTS "Users can update own friend challenges" ON public.friend_challenges;
DROP POLICY IF EXISTS "Users can view own challenge history" ON public.friend_challenge_history;

-- Friend challenges: utente può vedere le proprie sfide
CREATE POLICY "Users can view own friend challenges"
ON public.friend_challenges FOR SELECT
TO authenticated
USING (creator_id = auth.uid() OR opponent_id = auth.uid());

-- Friend challenges: utente può creare sfide
CREATE POLICY "Users can create friend challenges"
ON public.friend_challenges FOR INSERT
TO authenticated
WITH CHECK (creator_id = auth.uid());

-- Friend challenges: utente può aggiornare le proprie sfide (accept/decline/complete)
CREATE POLICY "Users can update own friend challenges"
ON public.friend_challenges FOR UPDATE
TO authenticated
USING (creator_id = auth.uid() OR opponent_id = auth.uid());

-- Challenge history: utente può vedere il proprio storico
CREATE POLICY "Users can view own challenge history"
ON public.friend_challenge_history FOR SELECT
TO authenticated
USING (creator_id = auth.uid() OR opponent_id = auth.uid());

-- =====================================================
-- FUNZIONI RPC
-- =====================================================

-- Crea sfida tra amici
DROP FUNCTION IF EXISTS public.create_friend_challenge(UUID, INTEGER, TEXT);
CREATE FUNCTION public.create_friend_challenge(
  p_opponent_id UUID,
  p_difficulty INTEGER DEFAULT 1,
  p_league TEXT DEFAULT 'seria_a'
)
RETURNS TABLE (
  challenge_id UUID,
  room_id TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_id UUID;
  v_challenge_id UUID;
  v_room_id TEXT;
BEGIN
  v_creator_id := auth.uid();

  -- Verifica che non si stia sfidando se stessi
  IF v_creator_id = p_opponent_id THEN
    RAISE EXCEPTION 'Non puoi sfidare te stesso';
  END IF;

  -- Verifica che siano amici
  IF NOT EXISTS (
    SELECT 1 FROM public.friends
    WHERE (user_id = v_creator_id AND friend_id = p_opponent_id)
       OR (user_id = p_opponent_id AND friend_id = v_creator_id)
  ) THEN
    RAISE EXCEPTION 'Puoi sfidare solo i tuoi amici';
  END IF;

  -- Verifica che non ci sia già una sfida pendente
  IF EXISTS (
    SELECT 1 FROM public.friend_challenges
    WHERE ((creator_id = v_creator_id AND opponent_id = p_opponent_id)
       OR (creator_id = p_opponent_id AND opponent_id = v_creator_id))
    AND friend_challenges.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Esiste già una sfida pendente con questo amico';
  END IF;

  -- Genera room_id univoco
  v_room_id := 'friend_' || gen_random_uuid()::TEXT;

  -- Pulisci sfide expired prima di creare nuova
  UPDATE public.friend_challenges
  SET status = 'expired', updated_at = NOW()
  WHERE friend_challenges.status = 'pending'
  AND friend_challenges.expires_at < NOW();

  -- Crea la sfida
  INSERT INTO public.friend_challenges (creator_id, opponent_id, difficulty, league, room_id, status)
  VALUES (v_creator_id, p_opponent_id, p_difficulty, p_league, v_room_id, 'pending')
  RETURNING id INTO v_challenge_id;

  RETURN QUERY
  SELECT
    v_challenge_id,
    v_room_id,
    'pending'::TEXT AS status,
    (NOW() + INTERVAL '10 minutes')::TIMESTAMPTZ AS expires_at;
END;
$$;

-- Accetta sfida tra amici
DROP FUNCTION IF EXISTS public.accept_friend_challenge(UUID);
CREATE FUNCTION public.accept_friend_challenge(p_challenge_id UUID)
RETURNS TABLE (
  challenge_id UUID,
  room_id TEXT,
  creator_id UUID,
  creator_nickname TEXT,
  creator_tier TEXT,
  difficulty INTEGER,
  league TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_opponent_id UUID;
  v_challenge RECORD;
BEGIN
  v_opponent_id := auth.uid();

  -- Trova la sfida
  SELECT * INTO v_challenge
  FROM public.friend_challenges
  WHERE friend_challenges.id = p_challenge_id
    AND friend_challenges.opponent_id = v_opponent_id
    AND friend_challenges.status = 'pending';

  IF v_challenge IS NULL THEN
    RAISE EXCEPTION 'Sfida non trovata o già elaborata';
  END IF;

  -- Verifica che la sfida non sia scaduta
  IF v_challenge.expires_at < NOW() THEN
    UPDATE public.friend_challenges
    SET status = 'expired', updated_at = NOW()
    WHERE friend_challenges.id = p_challenge_id;
    RAISE EXCEPTION 'Sfida scaduta';
  END IF;

  -- Aggiorna stato sfida
  UPDATE public.friend_challenges
  SET status = 'accepted', updated_at = NOW()
  WHERE friend_challenges.id = p_challenge_id;

  RETURN QUERY
  SELECT
    v_challenge.id,
    v_challenge.room_id,
    v_challenge.creator_id,
    COALESCE(p.nickname, p.first_name, 'Sfidante')::TEXT,
    COALESCE(p.tier, 'bronze')::TEXT,
    v_challenge.difficulty,
    v_challenge.league
  FROM public.profiles p
  WHERE p.id = v_challenge.creator_id;
END;
$$;

-- Rifiuta sfida tra amici
DROP FUNCTION IF EXISTS public.decline_friend_challenge(UUID);
CREATE FUNCTION public.decline_friend_challenge(p_challenge_id UUID)
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

-- Ottieni sfide in attesa (inviate e ricevute)
DROP FUNCTION IF EXISTS public.get_pending_friend_challenges();
CREATE FUNCTION public.get_pending_friend_challenges()
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  creator_nickname TEXT,
  creator_tier TEXT,
  opponent_id UUID,
  opponent_nickname TEXT,
  opponent_tier TEXT,
  room_id TEXT,
  difficulty INTEGER,
  league TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
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
    fc.id,
    fc.creator_id,
    COALESCE(pc.nickname, pc.first_name, 'Sfidante')::TEXT,
    COALESCE(pc.tier, 'bronze')::TEXT,
    fc.opponent_id,
    COALESCE(po.nickname, po.first_name, 'Avversario')::TEXT,
    COALESCE(po.tier, 'bronze')::TEXT,
    fc.room_id,
    fc.difficulty,
    fc.league,
    fc.status,
    fc.created_at,
    fc.expires_at
  FROM public.friend_challenges fc
  LEFT JOIN public.profiles pc ON fc.creator_id = pc.id
  LEFT JOIN public.profiles po ON fc.opponent_id = po.id
  WHERE (fc.creator_id = v_current_user OR fc.opponent_id = v_current_user)
    AND fc.status = 'pending'
  ORDER BY fc.created_at DESC;
END;
$$;

-- Ottieni storico sfide giocate
DROP FUNCTION IF EXISTS public.get_friend_challenge_history();
CREATE FUNCTION public.get_friend_challenge_history()
RETURNS TABLE (
  id UUID,
  challenge_id UUID,
  opponent_id UUID,
  opponent_nickname TEXT,
  opponent_tier TEXT,
  difficulty INTEGER,
  league TEXT,
  result TEXT,
  score INTEGER,
  created_at TIMESTAMPTZ
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
    fch.id,
    fch.challenge_id,
    CASE WHEN fch.creator_id = v_current_user THEN fch.opponent_id ELSE fch.creator_id END,
    COALESCE(p.nickname, p.first_name, 'Avversario')::TEXT,
    COALESCE(p.tier, 'bronze')::TEXT,
    fch.difficulty,
    fch.league,
    fch.result,
    CASE WHEN fch.creator_id = v_current_user THEN fch.creator_score ELSE fch.opponent_score END,
    fch.created_at
  FROM public.friend_challenge_history fch
  LEFT JOIN public.profiles p ON CASE WHEN fch.creator_id = v_current_user THEN fch.opponent_id ELSE fch.creator_id END = p.id
  WHERE fch.creator_id = v_current_user OR fch.opponent_id = v_current_user
  ORDER BY fch.created_at DESC
  LIMIT 50;
END;
$$;

-- Completa sfida (salva risultato)
DROP FUNCTION IF EXISTS public.complete_friend_challenge(UUID, UUID, INTEGER, INTEGER);
CREATE FUNCTION public.complete_friend_challenge(
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
  -- Trova la sfida
  SELECT * INTO v_challenge
  FROM public.friend_challenges
  WHERE friend_challenges.id = p_challenge_id AND friend_challenges.status = 'accepted';

  IF v_challenge IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Determina il risultato
  IF p_winner_id = v_challenge.creator_id THEN
    v_result := 'creator_won';
  ELSE
    v_result := 'opponent_won';
  END IF;

  -- Aggiorna stato sfida
  UPDATE public.friend_challenges
  SET status = 'completed', updated_at = NOW()
  WHERE friend_challenges.id = p_challenge_id;

  -- Salva nello storico
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

-- Abbandona sfida
DROP FUNCTION IF EXISTS public.abandon_friend_challenge(UUID);
CREATE FUNCTION public.abandon_friend_challenge(p_challenge_id UUID)
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

  -- Trova la sfida
  SELECT * INTO v_challenge
  FROM public.friend_challenges
  WHERE friend_challenges.id = p_challenge_id AND friend_challenges.status = 'accepted';

  IF v_challenge IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Determina chi ha abbandonato
  IF v_challenge.creator_id = v_current_user THEN
    v_result := 'abandoned';
  ELSE
    v_result := 'abandoned';
  END IF;

  -- Aggiorna stato sfida
  UPDATE public.friend_challenges
  SET status = 'abandoned', updated_at = NOW()
  WHERE friend_challenges.id = p_challenge_id;

  -- Salva nello storico
  INSERT INTO public.friend_challenge_history (
    challenge_id, creator_id, opponent_id, difficulty, league,
    winner_id, creator_score, opponent_score, result
  ) VALUES (
    p_challenge_id, v_challenge.creator_id, v_challenge.opponent_id,
    v_challenge.difficulty, v_challenge.league,
    CASE WHEN v_challenge.creator_id = v_current_user THEN v_challenge.opponent_id ELSE v_challenge.creator_id END,
    CASE WHEN v_challenge.creator_id = v_current_user THEN 0 ELSE 0 END,
    CASE WHEN v_challenge.creator_id = v_current_user THEN 0 ELSE 0 END,
    v_result
  );

  RETURN TRUE;
END;
$$;

-- Cleanup sfide scadute
DROP FUNCTION IF EXISTS public.cleanup_friend_challenges();
CREATE FUNCTION public.cleanup_friend_challenges()
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

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.create_friend_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_friend_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_friend_challenges TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_challenge_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_friend_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_friend_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_friend_challenges TO authenticated;

-- =====================================================
-- QUERY DI TEST
-- =====================================================

-- SELECT * FROM public.get_pending_friend_challenges();
-- SELECT * FROM public.get_friend_challenge_history();
-- SELECT public.cleanup_friend_challenges();