-- =====================================================================
-- 08_friends.sql
--
-- Sistema amicizie. Stato consolidato di alter-009-friends.sql (mai
-- più ridefinita altrove — nessuna delle funzioni presentava problemi
-- di autorizzazione nell'audit di sicurezza, tutte già ancorate a
-- auth.uid()). block_user/unblock_user/get_sent_friend_requests/are_friends
-- non sono ancora usate dalla UI ma sono superficie applicativa legittima,
-- mantenute.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends (user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends (friend_id);

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON public.friend_requests (from_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON public.friend_requests (to_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_pending ON public.friend_requests (to_user_id, status) WHERE status = 'pending';

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own friends" ON public.friends;
CREATE POLICY "Users can view own friends"
ON public.friends FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own friends" ON public.friends;
CREATE POLICY "Users can delete own friends"
ON public.friends FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own friend requests" ON public.friend_requests;
CREATE POLICY "Users can view own friend requests"
ON public.friend_requests FOR SELECT TO authenticated USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create friend requests" ON public.friend_requests;
CREATE POLICY "Users can create friend requests"
ON public.friend_requests FOR INSERT TO authenticated WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update received friend requests" ON public.friend_requests;
CREATE POLICY "Users can update received friend requests"
ON public.friend_requests FOR UPDATE TO authenticated USING (to_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own friend requests" ON public.friend_requests;
CREATE POLICY "Users can delete own friend requests"
ON public.friend_requests FOR DELETE TO authenticated USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- =====================================================================
-- Funzioni RPC
-- =====================================================================

CREATE OR REPLACE FUNCTION public.search_users(p_nickname TEXT)
RETURNS TABLE (id UUID, nickname TEXT, first_name TEXT, tier TEXT, total_score INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.nickname, p.first_name, p.tier, p.total_score
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

CREATE OR REPLACE FUNCTION public.send_friend_request(p_to_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_from_user UUID;
  v_exists BOOLEAN;
  v_blocked BOOLEAN;
BEGIN
  v_from_user := auth.uid();

  IF v_from_user::TEXT = p_to_user_id THEN
    RAISE EXCEPTION 'Non puoi aggiungere te stesso';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.friend_requests
    WHERE from_user_id = p_to_user_id::UUID
      AND to_user_id = v_from_user
      AND status = 'blocked'
  ) INTO v_blocked;

  IF v_blocked THEN
    RAISE EXCEPTION 'Non puoi inviare richiesta a questo utente';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.friend_requests
    WHERE (from_user_id = v_from_user AND to_user_id = p_to_user_id::UUID AND status IN ('pending', 'accepted'))
       OR (from_user_id = p_to_user_id::UUID AND to_user_id = v_from_user AND status IN ('pending', 'accepted'))
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'Esiste già una richiesta pendente o siete già amici';
  END IF;

  DELETE FROM public.friend_requests
  WHERE (from_user_id = v_from_user AND to_user_id = p_to_user_id::UUID)
     OR (from_user_id = p_to_user_id::UUID AND to_user_id = v_from_user)
  AND status IN ('rejected', 'blocked');

  INSERT INTO public.friend_requests (from_user_id, to_user_id, status)
  VALUES (v_from_user, p_to_user_id::UUID, 'pending');

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  SELECT * INTO v_request
  FROM public.friend_requests
  WHERE id = p_request_id AND to_user_id = v_current_user AND status = 'pending';

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Richiesta non trovata o già elaborata';
  END IF;

  UPDATE public.friend_requests
  SET status = 'accepted', updated_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO public.friends (user_id, friend_id)
  VALUES (v_request.from_user_id, v_request.to_user_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.friends (user_id, friend_id)
  VALUES (v_request.to_user_id, v_request.from_user_id)
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_friend_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  UPDATE public.friend_requests
  SET status = 'rejected', updated_at = NOW()
  WHERE id = p_request_id AND to_user_id = v_current_user AND status = 'pending';

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_friend_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  DELETE FROM public.friends
  WHERE (user_id = v_current_user AND friend_id = p_friend_id)
     OR (user_id = p_friend_id AND friend_id = v_current_user);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  IF v_current_user = p_user_id THEN
    RAISE EXCEPTION 'Non puoi bloccare te stesso';
  END IF;

  DELETE FROM public.friends
  WHERE (user_id = v_current_user AND friend_id = p_user_id)
     OR (user_id = p_user_id AND friend_id = v_current_user);

  DELETE FROM public.friend_requests
  WHERE (from_user_id = v_current_user AND to_user_id = p_user_id)
     OR (from_user_id = p_user_id AND to_user_id = v_current_user);

  INSERT INTO public.friend_requests (from_user_id, to_user_id, status)
  VALUES (v_current_user, p_user_id, 'blocked')
  ON CONFLICT (from_user_id, to_user_id) DO UPDATE SET status = 'blocked';

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  DELETE FROM public.friend_requests
  WHERE from_user_id = v_current_user AND to_user_id = p_user_id AND status = 'blocked';

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friends()
RETURNS TABLE (
  id UUID, friend_id UUID, nickname TEXT, first_name TEXT, tier TEXT,
  total_score INTEGER, is_online BOOLEAN, last_login TIMESTAMPTZ
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
    f.id, f.friend_id, p.nickname, p.first_name, p.tier, p.total_score,
    FALSE AS is_online, p.updated_at AS last_login
  FROM public.friends f
  JOIN public.profiles p ON f.friend_id = p.id
  WHERE f.user_id = v_current_user
  ORDER BY p.nickname;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_friend_requests()
RETURNS TABLE (id UUID, from_user_id UUID, nickname TEXT, first_name TEXT, tier TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  RETURN QUERY
  SELECT fr.id, fr.from_user_id, p.nickname, p.first_name, p.tier, fr.created_at
  FROM public.friend_requests fr
  JOIN public.profiles p ON fr.from_user_id = p.id
  WHERE fr.to_user_id = v_current_user AND fr.status = 'pending'
  ORDER BY fr.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sent_friend_requests()
RETURNS TABLE (id UUID, to_user_id UUID, nickname TEXT, first_name TEXT, tier TEXT, status TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  RETURN QUERY
  SELECT fr.id, fr.to_user_id, p.nickname, p.first_name, p.tier, fr.status, fr.created_at
  FROM public.friend_requests fr
  JOIN public.profiles p ON fr.to_user_id = p.id
  WHERE fr.from_user_id = v_current_user
  ORDER BY fr.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.are_friends(p_other_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
  v_are_friends BOOLEAN;
BEGIN
  v_current_user := auth.uid();

  SELECT EXISTS(
    SELECT 1 FROM public.friends
    WHERE (user_id = v_current_user AND friend_id = p_other_user_id::UUID)
       OR (user_id = p_other_user_id::UUID AND friend_id = v_current_user)
  ) INTO v_are_friends;

  RETURN v_are_friends;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_friend_requests TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sent_friend_requests TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends TO authenticated;
