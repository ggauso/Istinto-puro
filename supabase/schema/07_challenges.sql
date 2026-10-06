-- =====================================================================
-- 07_challenges.sql
--
-- Sfide Express (link pubblico condivisibile). Stato consolidato delle
-- 11 migrazioni incrementali alter-008...alter-020. Escluse (confermate
-- dead code/debug, mai chiamate da altre funzioni né da src/):
-- decline_challenge, get_my_challenges, link_challenge_to_match,
-- cleanup_expired_challenges, debug_my_challenges, test_create_challenge.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_name TEXT,
  token TEXT UNIQUE NOT NULL DEFAULT substr(md5(gen_random_uuid()::text), 1, 12),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired')),
  opponent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  room_id TEXT,
  -- Scritta solo da link_challenge_to_match (esclusa, mai chiamata), mai letta:
  -- mantenuta per compatibilità, candidata a rimozione futura.
  match_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_token ON public.challenges (token);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON public.challenges (creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges (status);
CREATE INDEX IF NOT EXISTS idx_challenges_expires ON public.challenges (expires_at) WHERE status = 'pending';

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create challenges" ON public.challenges;
CREATE POLICY "Users can create challenges"
ON public.challenges FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Creator can view own challenges" ON public.challenges;
CREATE POLICY "Creator can view own challenges"
ON public.challenges FOR SELECT
TO authenticated
USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "Opponent can view their challenges" ON public.challenges;
CREATE POLICY "Opponent can view their challenges"
ON public.challenges FOR SELECT
TO authenticated
USING (opponent_id = auth.uid());

-- Nessuna policy UPDATE/DELETE: tutte le transizioni di stato passano
-- esclusivamente per le funzioni SECURITY DEFINER sotto.

-- =====================================================================
-- cleanup_old_challenges — invalida le sfide precedenti dello stesso
-- utente quando ne crea una nuova (alter-016-update-create-challenge.sql)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_challenges()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  UPDATE public.challenges
  SET status = 'expired', updated_at = NOW()
  WHERE creator_id = v_user_id
    AND status = 'pending';

  UPDATE public.challenges
  SET status = 'expired', updated_at = NOW()
  WHERE creator_id = v_user_id
    AND status = 'accepted'
    AND created_at < NOW() - INTERVAL '10 minutes';
END;
$$;

-- =====================================================================
-- create_challenge (alter-016, versione finale)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.create_challenge()
RETURNS TABLE (
  challenge_id UUID,
  token TEXT,
  challenge_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_challenge_id UUID;
  v_token TEXT;
  v_challenge_url TEXT;
BEGIN
  v_user_id := auth.uid();

  SELECT first_name, nickname INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  PERFORM public.cleanup_old_challenges();

  v_token := substr(md5(gen_random_uuid()::text), 1, 12);

  INSERT INTO public.challenges (creator_id, creator_name, token, status, expires_at)
  VALUES (v_user_id, COALESCE(v_profile.nickname, v_profile.first_name, 'Giocatore'), v_token, 'pending', NOW() + INTERVAL '24 hours')
  RETURNING id INTO v_challenge_id;

  v_challenge_url := 'https://istintopuro.com/sfida/' || v_token;

  RETURN QUERY VALUES (v_challenge_id, v_token, v_challenge_url);
END;
$$;

-- =====================================================================
-- accept_challenge (alter-011-fix-challenges, versione finale)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.accept_challenge(p_token TEXT)
RETURNS TABLE (
  success BOOLEAN,
  challenge_id UUID,
  message TEXT,
  room_id TEXT,
  creator_id UUID,
  creator_nickname TEXT,
  creator_tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge RECORD;
  v_user_id UUID;
  v_room_id TEXT;
  v_creator RECORD;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_challenge
  FROM public.challenges
  WHERE token = p_token AND status = 'pending' AND expires_at > NOW();

  IF v_challenge IS NULL THEN
    RETURN QUERY VALUES (FALSE, NULL::UUID, 'Sfida non valida o scaduta', NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT);
    RETURN;
  END IF;

  IF v_challenge.creator_id = v_user_id THEN
    RETURN QUERY VALUES (FALSE, NULL::UUID, 'Non puoi accettare la tua stessa sfida', NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT);
    RETURN;
  END IF;

  SELECT nickname, tier INTO v_creator
  FROM public.profiles
  WHERE id = v_challenge.creator_id;

  v_room_id := 'challenge_' || substr(md5(gen_random_uuid()::text), 1, 8);

  UPDATE public.challenges
  SET status = 'accepted', opponent_id = v_user_id, room_id = v_room_id, updated_at = NOW()
  WHERE id = v_challenge.id;

  RETURN QUERY VALUES (
    TRUE, v_challenge.id, 'Sfida accettata!', v_room_id, v_challenge.creator_id,
    COALESCE(v_creator.nickname, 'Sfidante'), COALESCE(v_creator.tier, 'bronze')
  );
END;
$$;

-- =====================================================================
-- get_challenge_by_token (alter-019, versione finale — pubblica, anche anon)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_challenge_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  creator_name TEXT,
  status TEXT,
  room_id TEXT,
  opponent_id UUID,
  opponent_name TEXT,
  opponent_tier TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.creator_id, c.creator_name, c.status, c.room_id, c.opponent_id,
    COALESCE(p.nickname, p.first_name, 'Sfidante') AS opponent_name,
    COALESCE(p.tier, 'bronze') AS opponent_tier,
    c.created_at, c.expires_at
  FROM public.challenges c
  LEFT JOIN public.profiles p ON c.opponent_id = p.id
  WHERE c.token = p_token
    AND c.expires_at > NOW()
    AND c.status IN ('pending', 'accepted')
    AND c.created_at > NOW() - INTERVAL '10 minutes';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_challenge_by_token TO authenticated, anon;

-- =====================================================================
-- get_my_active_challenge (alter-018, versione finale)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_my_active_challenge()
RETURNS TABLE (
  id UUID,
  room_id TEXT,
  status TEXT,
  opponent_name TEXT,
  opponent_tier TEXT,
  opponent_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  RETURN QUERY
  SELECT
    c.id, c.room_id, c.status,
    COALESCE(p.nickname, p.first_name, 'Sfidante') AS opponent_name,
    COALESCE(p.tier, 'bronze') AS opponent_tier,
    c.opponent_id
  FROM public.challenges c
  LEFT JOIN public.profiles p ON c.opponent_id = p.id
  WHERE c.creator_id = v_user_id
    AND c.status = 'accepted'
    AND c.room_id IS NOT NULL
    AND c.created_at > NOW() - INTERVAL '10 minutes'
  ORDER BY c.created_at DESC
  LIMIT 1;
END;
$$;

-- =====================================================================
-- complete_challenge / expire_challenge — con fix di sicurezza
-- (alter-020/alter-011-fix-challenges + alter-022-security-fixes.sql)
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
