-- =====================================================
-- Fix Challenge: create_challenge deve pulire sfide vecchie
-- =====================================================

-- Prima crea la funzione di cleanup se non esiste
CREATE OR REPLACE FUNCTION public.cleanup_old_challenges()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Expire all previous pending challenges from this user
  UPDATE public.challenges
  SET status = 'expired', updated_at = NOW()
  WHERE creator_id = v_user_id
    AND status = 'pending';

  -- Also mark accepted challenges as expired (they'll be re-created if needed)
  UPDATE public.challenges
  SET status = 'expired', updated_at = NOW()
  WHERE creator_id = v_user_id
    AND status = 'accepted'
    AND created_at < NOW() - INTERVAL '10 minutes';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_challenges TO authenticated;

-- Aggiorna create_challenge per chiamare cleanup prima di creare
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
  -- Get current user
  v_user_id := auth.uid();

  -- Get user profile for display name
  SELECT first_name, nickname INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  -- Cleanup old challenges before creating new one
  PERFORM public.cleanup_old_challenges();

  -- Generate unique token
  v_token := substr(md5(gen_random_uuid()::text), 1, 12);

  -- Create challenge with status 'pending'
  INSERT INTO public.challenges (
    creator_id,
    creator_name,
    token,
    status,
    expires_at
  )
  VALUES (
    v_user_id,
    COALESCE(v_profile.nickname, v_profile.first_name, 'Giocatore'),
    v_token,
    'pending',
    NOW() + INTERVAL '24 hours'
  )
  RETURNING id INTO v_challenge_id;

  v_challenge_url := 'https://istintopuro.com/sfida/' || v_token;

  RETURN QUERY VALUES (v_challenge_id, v_token, v_challenge_url);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_challenge TO authenticated;