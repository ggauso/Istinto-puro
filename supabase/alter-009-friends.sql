-- =====================================================
-- Sistema Amicizie (Milestone 6b)
-- =====================================================
-- Tabella per le relazioni di amicizia e richieste
-- =====================================================

-- Tabella amicizie (relazioni confermate)
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends (user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends (friend_id);

-- Tabella richieste di amicizia
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON public.friend_requests (from_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON public.friend_requests (to_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_pending ON public.friend_requests (to_user_id, status) WHERE status = 'pending';

-- Policy RLS
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-run)
DROP POLICY IF EXISTS "Users can view own friends" ON public.friends;
DROP POLICY IF EXISTS "Users can view own friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can create friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can update received friend requests" ON public.friend_requests;

-- Friends: utente può vedere i propri amici
CREATE POLICY "Users can view own friends"
ON public.friends FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Friends: utente può eliminare i propri amici
CREATE POLICY "Users can delete own friends"
ON public.friends FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Friend requests: utente può vedere le proprie richieste
CREATE POLICY "Users can view own friend requests"
ON public.friend_requests FOR SELECT
TO authenticated
USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Friend requests: utente può inserire richieste
CREATE POLICY "Users can create friend requests"
ON public.friend_requests FOR INSERT
TO authenticated
WITH CHECK (from_user_id = auth.uid());

-- Friend requests: utente può aggiornare le richieste ricevute
CREATE POLICY "Users can update received friend requests"
ON public.friend_requests FOR UPDATE
TO authenticated
USING (to_user_id = auth.uid());

-- Friend requests: utente può eliminare le proprie richieste
CREATE POLICY "Users can delete own friend requests"
ON public.friend_requests FOR DELETE
TO authenticated
USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- =====================================================
-- FUNZIONI RPC
-- =====================================================

-- Cerca utente per nickname (restituisce max 10 risultati)
DROP FUNCTION IF EXISTS public.search_users(TEXT);
CREATE FUNCTION public.search_users(p_nickname TEXT)
RETURNS TABLE (
  id UUID,
  nickname TEXT,
  first_name TEXT,
  tier TEXT,
  total_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nickname,
    p.first_name,
    p.tier,
    p.total_score
  FROM public.profiles p
  WHERE p.nickname ILIKE '%' || p_nickname || '%'
    AND p.id != auth.uid()  -- Escludi se stessou
  ORDER BY
    CASE
      WHEN p.nickname ILIKE p_nickname || '%' THEN 1  -- Inizia con la stringa
      WHEN p.nickname ILIKE '%' || p_nickname || '%' THEN 2
      ELSE 3
    END
  LIMIT 10;
END;
$$;

-- Invia richiesta di amicizia
DROP FUNCTION IF EXISTS public.send_friend_request(TEXT);
CREATE FUNCTION public.send_friend_request(p_to_user_id TEXT)
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

  -- Verifica che non si stia cercando di aggiungere se stessi
  IF v_from_user::TEXT = p_to_user_id THEN
    RAISE EXCEPTION 'Non puoi aggiungere te stesso';
  END IF;

  -- Verifica se l'altro utente ti ha bloccato
  SELECT EXISTS(
    SELECT 1 FROM public.friend_requests
    WHERE from_user_id = p_to_user_id::UUID
      AND to_user_id = v_from_user
      AND status = 'blocked'
  ) INTO v_blocked;

  IF v_blocked THEN
    RAISE EXCEPTION 'Non puoi inviare richiesta a questo utente';
  END IF;

  -- Verifica che non ci sia già una richiesta pendente (accettata o pending)
  SELECT EXISTS(
    SELECT 1 FROM public.friend_requests
    WHERE (from_user_id = v_from_user AND to_user_id = p_to_user_id::UUID AND status IN ('pending', 'accepted'))
       OR (from_user_id = p_to_user_id::UUID AND to_user_id = v_from_user AND status IN ('pending', 'accepted'))
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'Esiste già una richiesta pendente o siete già amici';
  END IF;

  -- Crea la richiesta (rimuovi prima eventuali richieste rifiutate o vecchie)
  DELETE FROM public.friend_requests
  WHERE (from_user_id = v_from_user AND to_user_id = p_to_user_id::UUID)
     OR (from_user_id = p_to_user_id::UUID AND to_user_id = v_from_user)
  AND status IN ('rejected', 'blocked');

  INSERT INTO public.friend_requests (from_user_id, to_user_id, status)
  VALUES (v_from_user, p_to_user_id::UUID, 'pending');

  RETURN TRUE;
END;
$$;

-- Accetta richiesta di amicizia
DROP FUNCTION IF EXISTS public.accept_friend_request(UUID);
CREATE FUNCTION public.accept_friend_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  -- Trova la richiesta
  SELECT * INTO v_request
  FROM public.friend_requests
  WHERE id = p_request_id
    AND to_user_id = v_current_user
    AND status = 'pending';

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Richiesta non trovata o già elaborata';
  END IF;

  -- Aggiorna stato richiesta
  UPDATE public.friend_requests
  SET status = 'accepted', updated_at = NOW()
  WHERE id = p_request_id;

  -- Crea relazione di amicizia (in entrambe le direzioni)
  INSERT INTO public.friends (user_id, friend_id)
  VALUES (v_request.from_user_id, v_request.to_user_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.friends (user_id, friend_id)
  VALUES (v_request.to_user_id, v_request.from_user_id)
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$;

-- Rifiuta richiesta di amicizia
DROP FUNCTION IF EXISTS public.reject_friend_request(UUID);
CREATE FUNCTION public.reject_friend_request(p_request_id UUID)
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
  WHERE id = p_request_id
    AND to_user_id = v_current_user
    AND status = 'pending';

  RETURN TRUE;
END;
$$;

-- Rimuovi amico
DROP FUNCTION IF EXISTS public.remove_friend(UUID);
CREATE FUNCTION public.remove_friend(p_friend_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  -- Elimina amicizia in entrambe le direzioni
  DELETE FROM public.friends
  WHERE (user_id = v_current_user AND friend_id = p_friend_id)
     OR (user_id = p_friend_id AND friend_id = v_current_user);

  RETURN TRUE;
END;
$$;

-- Blocca utente
DROP FUNCTION IF EXISTS public.block_user(UUID);
CREATE FUNCTION public.block_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  -- Non puoi bloccare te stesso
  IF v_current_user = p_user_id THEN
    RAISE EXCEPTION 'Non puoi bloccare te stesso';
  END IF;

  -- Rimuovi prima eventuali amicizie
  DELETE FROM public.friends
  WHERE (user_id = v_current_user AND friend_id = p_user_id)
     OR (user_id = p_user_id AND friend_id = v_current_user);

  -- Rimuovi/Rifiuta richieste pendenti
  DELETE FROM public.friend_requests
  WHERE (from_user_id = v_current_user AND to_user_id = p_user_id)
     OR (from_user_id = p_user_id AND to_user_id = v_current_user);

  -- Blocca l'utente (crea richiesta con status blocked)
  INSERT INTO public.friend_requests (from_user_id, to_user_id, status)
  VALUES (v_current_user, p_user_id, 'blocked')
  ON CONFLICT (from_user_id, to_user_id) DO UPDATE SET status = 'blocked';

  RETURN TRUE;
END;
$$;

-- Sblocca utente
DROP FUNCTION IF EXISTS public.unblock_user(UUID);
CREATE FUNCTION public.unblock_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  -- Rimuovi il blocco
  DELETE FROM public.friend_requests
  WHERE from_user_id = v_current_user
    AND to_user_id = p_user_id
    AND status = 'blocked';

  RETURN TRUE;
END;
$$;

-- Ottieni lista amici
DROP FUNCTION IF EXISTS public.get_friends();
CREATE FUNCTION public.get_friends()
RETURNS TABLE (
  id UUID,
  friend_id UUID,
  nickname TEXT,
  first_name TEXT,
  tier TEXT,
  total_score INTEGER,
  is_online BOOLEAN,
  last_login TIMESTAMPTZ
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
    p.first_name,
    p.tier,
    p.total_score,
    FALSE AS is_online,  -- Simplified for now
    p.updated_at AS last_login
  FROM public.friends f
  JOIN public.profiles p ON f.friend_id = p.id
  WHERE f.user_id = v_current_user
  ORDER BY p.nickname;
END;
$$;

-- Ottieni richieste di amicizia ricevute
DROP FUNCTION IF EXISTS public.get_pending_friend_requests();
CREATE FUNCTION public.get_pending_friend_requests()
RETURNS TABLE (
  id UUID,
  from_user_id UUID,
  nickname TEXT,
  first_name TEXT,
  tier TEXT,
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
    fr.id,
    fr.from_user_id,
    p.nickname,
    p.first_name,
    p.tier,
    fr.created_at
  FROM public.friend_requests fr
  JOIN public.profiles p ON fr.from_user_id = p.id
  WHERE fr.to_user_id = v_current_user
    AND fr.status = 'pending'
  ORDER BY fr.created_at DESC;
END;
$$;

-- Ottieni richieste di amicizia inviate
DROP FUNCTION IF EXISTS public.get_sent_friend_requests();
CREATE FUNCTION public.get_sent_friend_requests()
RETURNS TABLE (
  id UUID,
  to_user_id UUID,
  nickname TEXT,
  first_name TEXT,
  tier TEXT,
  status TEXT,
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
    fr.id,
    fr.to_user_id,
    p.nickname,
    p.first_name,
    p.tier,
    fr.status,
    fr.created_at
  FROM public.friend_requests fr
  JOIN public.profiles p ON fr.to_user_id = p.id
  WHERE fr.from_user_id = v_current_user
  ORDER BY fr.created_at DESC;
END;
$$;

-- Verifica se due utenti sono amici
DROP FUNCTION IF EXISTS public.are_friends(TEXT);
CREATE FUNCTION public.are_friends(p_other_user_id TEXT)
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

-- =====================================================
-- QUERY DI UTILITÀ
-- =====================================================

--Cerca utenti per nickname
-- SELECT * FROM public.search_users('mario');

--Invia richiesta (da frontend)
-- SELECT public.send_friend_request('uuid-del-utente');

--Accetta richiesta
-- SELECT public.accept_friend_request('uuid-richiesta');

--Rifiuta richiesta
-- SELECT public.reject_friend_request('uuid-richiesta');

--Rimuovi amico
-- SELECT public.remove_friend('uuid-amico');

--Lista amici
-- SELECT * FROM public.get_friends();

--Richieste ricevute
-- SELECT * FROM public.get_pending_friend_requests();

--Richieste inviate
-- SELECT * FROM public.get_sent_friend_requests();

--Sono amici?
-- SELECT public.are_friends('uuid-altro-utente');

-- =====================================================
-- GRANTS
-- =====================================================

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