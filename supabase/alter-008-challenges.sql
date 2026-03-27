-- =====================================================
-- Sfide Express (Milestone 6)
-- =====================================================
-- Sistema di sfide tramite link condivisibile
-- =====================================================

-- Tabella delle sfide
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_name TEXT, -- nome del creatore al momento della sfida
  token TEXT UNIQUE NOT NULL DEFAULT substr(md5(gen_random_uuid()::text), 1, 12),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired')),
  opponent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  room_id TEXT, -- room ID per la partita quando accettata
  match_id UUID, -- riferimento al match se completato
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_challenges_token ON public.challenges (token);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON public.challenges (creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges (status);
CREATE INDEX IF NOT EXISTS idx_challenges_expires ON public.challenges (expires_at) WHERE status = 'pending';

-- Policy RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-run)
DROP POLICY IF EXISTS "Users can create challenges" ON public.challenges;
DROP POLICY IF EXISTS "Creator can view own challenges" ON public.challenges;
DROP POLICY IF EXISTS "Opponent can view their challenges" ON public.challenges;

-- Tutti possono creare sfide
CREATE POLICY "Users can create challenges"
ON public.challenges FOR INSERT
TO authenticated
WITH CHECK (true);

-- Il creatore può vedere le sue sfide
CREATE POLICY "Creator can view own challenges"
ON public.challenges FOR SELECT
TO authenticated
USING (creator_id = auth.uid());

-- Gli utenti possono vedere le sfide a loro destinate
CREATE POLICY "Opponent can view their challenges"
ON public.challenges FOR SELECT
TO authenticated
USING (opponent_id = auth.uid());

-- Drop existing functions if they exist (for re-run)
DROP FUNCTION IF EXISTS public.create_challenge();
DROP FUNCTION IF EXISTS public.accept_challenge(TEXT);
DROP FUNCTION IF EXISTS public.decline_challenge(TEXT);
DROP FUNCTION IF EXISTS public.get_challenge_by_token(TEXT);
DROP FUNCTION IF EXISTS public.get_my_challenges();
DROP FUNCTION IF EXISTS public.link_challenge_to_match(UUID, UUID);
DROP FUNCTION IF EXISTS public.cleanup_expired_challenges();

-- Funzione per creare una nuova sfida
CREATE FUNCTION public.create_challenge()
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
  -- Get current user
  v_user_id := auth.uid();

  -- Get user profile for display name
  SELECT first_name, nickname INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  -- Create challenge
  INSERT INTO public.challenges (
    creator_id,
    creator_name,
    token,
    status,
    expires_at
  )
  VALUES (
    v_user_id,
    COALESCE(v_profile.nickname, v_profile.first_name, 'Utente'),
    substr(md5(gen_random_uuid()::text), 1, 12),
    'pending',
    NOW() + INTERVAL '24 hours'
  )
  RETURNING id, public.challenges.token INTO v_challenge_id, v_token;

  -- Build challenge URL (da aggiornare con dominio reale)
  v_challenge_url := 'https://istintopuro.com/sfida/' || v_token;

  RETURN QUERY VALUES (v_challenge_id, v_token, v_challenge_url);
END;
$$;

-- Funzione per accettare una sfida
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

-- Funzione per rifiutare una sfida
CREATE FUNCTION public.decline_challenge(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_challenge
  FROM public.challenges
  WHERE token = p_token AND status = 'pending' AND expires_at > NOW();

  IF v_challenge IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.challenges
  SET status = 'declined', updated_at = NOW()
  WHERE id = v_challenge.id;

  RETURN TRUE;
END;
$$;

-- Funzione per ottenere una sfida tramite token (pubblica)
CREATE FUNCTION public.get_challenge_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  creator_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.creator_name,
    c.status,
    c.created_at,
    c.expires_at
  FROM public.challenges c
  WHERE c.token = p_token AND c.expires_at > NOW();
END;
$$;

-- Funzione per ottenere le sfide dell'utente
CREATE FUNCTION public.get_my_challenges()
RETURNS TABLE (
  id UUID,
  creator_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  opponent_name TEXT,
  is_creator BOOLEAN
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
    c.id,
    c.creator_name,
    c.status,
    c.created_at,
    p.nickname AS opponent_name,
    TRUE AS is_creator
  FROM public.challenges c
  LEFT JOIN public.profiles p ON c.opponent_id = p.id
  WHERE c.creator_id = v_user_id

  UNION ALL

  SELECT
    c.id,
    c.creator_name,
    c.status,
    c.created_at,
    p.nickname AS opponent_name,
    FALSE AS is_creator
  FROM public.challenges c
  LEFT JOIN public.profiles p ON c.creator_id = p.id
  WHERE c.opponent_id = v_user_id

  ORDER BY created_at DESC;
END;
$$;

-- Funzione per aggiornare match_id nella sfida (chiamata quando la partita inizia)
CREATE FUNCTION public.link_challenge_to_match(p_challenge_id UUID, p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.challenges
  SET match_id = p_match_id, updated_at = NOW()
  WHERE id = p_challenge_id;

  RETURN TRUE;
END;
$$;

-- Funzione per ottenere la sfida attiva dell'utente (per il creatore)
CREATE FUNCTION public.get_my_active_challenge()
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
  ORDER BY c.created_at DESC
  LIMIT 1;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_active_challenge TO authenticated;

-- Funzione per pulire sfide scadute (da eseguire periodicamente)
CREATE FUNCTION public.cleanup_expired_challenges()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  UPDATE public.challenges
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- =====================================================
-- QUERY DI UTILITÀ
-- =====================================================

-- Crea una sfida (da chiamare dal frontend)
-- SELECT * FROM public.create_challenge();

-- Accetta una sfida (dopo che l'utente ha cliccato il link)
-- SELECT * FROM public.accept_challenge('abc123def456');

-- Vedi le tue sfide
-- SELECT * FROM public.get_my_challenges();

-- Vedi dettagli sfida pubblica
-- SELECT * FROM public.get_challenge_by_token('abc123def456');

-- Per test: pulisci sfide scadute
-- SELECT public.cleanup_expired_challenges();