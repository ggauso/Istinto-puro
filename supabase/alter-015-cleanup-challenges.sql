-- =====================================================
-- Fix Challenge: pulisci sfide vecchie quando ne crei una nuova
-- =====================================================

-- Quando un utente crea una nuova sfida, invalida tutte le sue sfide precedenti
-- (sia pending che accepted) per evitare conflitti
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

-- Modifica create_challenge per chiamare cleanup prima di creare una nuova
-- (nota: questa è una modifica opzionale se create_challenge esiste già)
-- La logica deve essere: pulisci prima di creare