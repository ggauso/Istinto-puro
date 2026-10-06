-- =====================================================
-- Fix Sfide Express (Challenge System)
-- =====================================================
-- Aggiunge colonna room_id mancante e fix vari

-- =====================================================
-- 1. Aggiungi colonna room_id se non esiste
-- =====================================================
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS room_id TEXT;

-- =====================================================
-- 2. Crea funzione get_my_active_challenge - solo la più recente
-- =====================================================
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

  -- Return only the MOST RECENT accepted challenge
  RETURN QUERY
  SELECT
    c.id,
    c.room_id,
    c.status,
    COALESCE(p.nickname, p.first_name, 'Sfidante') AS opponent_name,
    COALESCE(p.tier, 'bronze') AS opponent_tier,
    c.opponent_id
  FROM public.challenges c
  LEFT JOIN public.profiles p ON c.opponent_id = p.id
  WHERE c.creator_id = v_user_id
    AND c.status = 'accepted'
    AND c.room_id IS NOT NULL
    AND c.created_at > NOW() - INTERVAL '1 hour'  -- Only consider challenges from the last hour
  ORDER BY c.created_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_active_challenge TO authenticated;

-- =====================================================
-- Debug: visualizza le sfide dell'utente corrente
-- =====================================================
CREATE OR REPLACE FUNCTION public.debug_my_challenges()
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  creator_name TEXT,
  opponent_id UUID,
  status TEXT,
  room_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  RAISE NOTICE 'debug_my_challenges for user: %', v_user_id;

  RETURN QUERY
  SELECT
    c.id,
    c.creator_id,
    c.creator_name,
    c.opponent_id,
    c.status,
    c.room_id,
    c.created_at
  FROM public.challenges c
  WHERE c.creator_id = v_user_id OR c.opponent_id = v_user_id
  ORDER BY c.created_at DESC
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_my_challenges TO authenticated;

-- =====================================================
-- Test: crea una sfida di test
-- =====================================================
CREATE OR REPLACE FUNCTION public.test_create_challenge()
RETURNS TABLE (
  challenge_id UUID,
  token TEXT,
  challenge_url TEXT,
  error_msg TEXT
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
  -- Get current user
  v_user_id := auth.uid();

  RAISE NOTICE 'test_create_challenge: user_id=%', v_user_id;

  -- Get user profile
  SELECT first_name, nickname INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  RAISE NOTICE 'Profile found: %', v_profile;

  -- Test insert
  INSERT INTO public.challenges (
    creator_id,
    creator_name,
    token,
    status,
    expires_at
  )
  VALUES (
    v_user_id,
    COALESCE(v_profile.nickname, v_profile.first_name, 'TestUser'),
    substr(md5(gen_random_uuid()::text), 1, 12),
    'pending',
    NOW() + INTERVAL '24 hours'
  )
  RETURNING id, public.challenges.token INTO v_challenge_id, v_token;

  RAISE NOTICE 'Challenge created: id=%, token=%', v_challenge_id, v_token;

  v_challenge_url := 'https://istintopuro.com/sfida/' || v_token;

  RETURN QUERY VALUES (v_challenge_id, v_token, v_challenge_url, NULL::TEXT);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating challenge: %', SQLERRM;
    RETURN QUERY VALUES (NULL::UUID, NULL::TEXT, NULL::TEXT, SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_create_challenge TO authenticated;

-- =====================================================
-- Verifica le policies RLS sulla tabella challenges
-- =====================================================
-- Rendi le insert possibili per authenticated users
DROP POLICY IF EXISTS "Users can create challenges" ON public.challenges;
CREATE POLICY "Users can create challenges"
ON public.challenges FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verifica lettura
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

-- =====================================================
-- Fix: aggiorna accept_challenge per salvare room_id
-- =====================================================
DROP FUNCTION IF EXISTS public.accept_challenge(TEXT);

CREATE FUNCTION public.accept_challenge(p_token TEXT)
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
  -- Get current user
  v_user_id := auth.uid();

  -- Get challenge by token
  SELECT * INTO v_challenge
  FROM public.challenges
  WHERE token = p_token AND status = 'pending' AND expires_at > NOW();

  IF v_challenge IS NULL THEN
    RETURN QUERY VALUES (FALSE, NULL, 'Sfida non valida o scaduta', NULL, NULL, NULL, NULL);
    RETURN;
  END IF;

  -- Can't challenge yourself
  IF v_challenge.creator_id = v_user_id THEN
    RETURN QUERY VALUES (FALSE, NULL, 'Non puoi accettare la tua stessa sfida', NULL, NULL, NULL, NULL);
    RETURN;
  END IF;

  -- Get creator info
  SELECT nickname, tier INTO v_creator
  FROM public.profiles
  WHERE id = v_challenge.creator_id;

  -- Generate room ID for the match
  v_room_id := 'challenge_' || substr(md5(gen_random_uuid()::text), 1, 8);

  RAISE NOTICE 'accept_challenge: challenge_id=%, room_id=%, creator_id=%', v_challenge.id, v_room_id, v_challenge.creator_id;

  -- Update challenge status
  UPDATE public.challenges
  SET
    status = 'accepted',
    opponent_id = v_user_id,
    room_id = v_room_id,
    updated_at = NOW()
  WHERE id = v_challenge.id;

  RETURN QUERY VALUES (
    TRUE,
    v_challenge.id,
    'Sfida accettata!',
    v_room_id,
    v_challenge.creator_id,
    COALESCE(v_creator.nickname, 'Sfidante'),
    COALESCE(v_creator.tier, 'bronze')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_challenge TO authenticated;

-- =====================================================
-- Completa una sfida (mark as completed)
-- =====================================================
CREATE OR REPLACE FUNCTION public.complete_challenge(p_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.challenges
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_challenge_id AND status = 'accepted';

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_challenge TO authenticated;

-- =====================================================
-- Marca sfida come expired (quando la partita finisce)
-- =====================================================
CREATE OR REPLACE FUNCTION public.expire_challenge(p_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.challenges
  SET status = 'expired', updated_at = NOW()
  WHERE id = p_challenge_id AND status = 'accepted';

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_challenge TO authenticated;