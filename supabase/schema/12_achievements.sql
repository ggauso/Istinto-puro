-- =====================================================================
-- 12_achievements.sql
--
-- Milestone 8 (ROADMAP_FEATURES.md): sistema achievement/badge. Catalogo
-- statico `achievements` + progressi utente `user_achievements`.
--
-- Due famiglie di criteri:
-- 1) Verificabili server-side da dati già persistiti in `profiles`/
--    `matches_history` (prima vittoria, streak, campione, social, tier
--    diamond): calcolati da `check_and_unlock_achievements`, fonte di
--    verità, chiamata dal client subito dopo il salvataggio di una partita.
-- 2) Eventi momentanei osservabili solo lato client durante il round in
--    corso (risposta "veloce" sotto i 3s, streak di risposte corrette
--    all'interno della partita) — nessuna colonna li persiste oggi, quindi
--    `unlock_achievement` li sblocca su richiesta diretta del client. Per
--    non trasformarla in un endpoint "sblocca qualsiasi achievement a
--    piacere", accetta solo i due codici di questa famiglia (whitelist).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.achievements (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('progress', 'skill', 'social')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view achievement catalog" ON public.achievements;
CREATE POLICY "Anyone can view achievement catalog" ON public.achievements
  FOR SELECT USING (true);

INSERT INTO public.achievements (code, label, description, icon, category, sort_order) VALUES
  ('first_win',   'Prima vittoria', 'Vinci la tua prima partita',                 'Trophy', 'progress', 1),
  ('streak5',     'Serie vincente', 'Vinci 5 partite consecutive',                'Flame',  'progress', 2),
  ('champion50',  'Campione',       'Vinci 50 partite',                          'Crown',  'progress', 3),
  ('tier_diamond','Diamante',       'Raggiungi il tier Diamond',                  'Gem',    'progress', 4),
  ('speed',       'Fulmine',        'Rispondi correttamente in meno di 3 secondi','Zap',    'skill',    5),
  ('perfect',     'Perfetto',       'Rispondi corretto 10 volte di fila',         'Star',   'skill',    6),
  ('social10',    'Socievole',      'Gioca 10 partite PvP',                      'Users',  'social',   7)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_code TEXT NOT NULL REFERENCES public.achievements(code) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, achievement_code)
);

CREATE INDEX IF NOT EXISTS user_achievements_user_id_idx ON public.user_achievements (user_id);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Pubblico in lettura, come i profili (badge visibili anche su profili altrui
-- in futuro) — nessuna policy INSERT/UPDATE: le uniche scritture passano
-- dalle funzioni SECURITY DEFINER sotto, che bypassano la RLS.
DROP POLICY IF EXISTS "Anyone can view unlocked achievements" ON public.user_achievements;
CREATE POLICY "Anyone can view unlocked achievements" ON public.user_achievements
  FOR SELECT USING (true);

-- =====================================================================
-- get_user_achievements — catalogo completo con stato sblocco/locked
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_user_achievements(p_user_id UUID)
RETURNS TABLE (
  code TEXT, label TEXT, description TEXT, icon TEXT, category TEXT,
  unlocked BOOLEAN, unlocked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.code, a.label, a.description, a.icon, a.category,
    (ua.user_id IS NOT NULL) AS unlocked,
    ua.unlocked_at
  FROM public.achievements a
  LEFT JOIN public.user_achievements ua
    ON ua.achievement_code = a.code AND ua.user_id = p_user_id
  ORDER BY a.sort_order;
END;
$$;

-- =====================================================================
-- check_and_unlock_achievements — famiglia 1 (server-truth). Idempotente:
-- richiamabile dopo ogni partita, inserisce solo i nuovi sblocchi (ON
-- CONFLICT DO NOTHING) e ritorna solo i codici appena sbloccati in questa
-- chiamata (array vuoto se nessuno).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_and_unlock_achievements(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_matches_won INTEGER;
  v_longest_win_streak INTEGER;
  v_tier TEXT;
  v_pvp_matches INTEGER;
  v_unlocked TEXT[] := '{}';
  v_code TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a verificare gli achievement di un altro utente';
  END IF;

  SELECT COALESCE(matches_won, 0), COALESCE(longest_win_streak, 0), COALESCE(tier, 'bronze')
  INTO v_matches_won, v_longest_win_streak, v_tier
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT COUNT(*)::INTEGER INTO v_pvp_matches
  FROM public.matches_history
  WHERE user_id = p_user_id AND is_pvp = TRUE;

  IF v_matches_won >= 1 THEN
    INSERT INTO public.user_achievements (user_id, achievement_code)
    VALUES (p_user_id, 'first_win')
    ON CONFLICT DO NOTHING
    RETURNING achievement_code INTO v_code;
    IF v_code IS NOT NULL THEN v_unlocked := array_append(v_unlocked, v_code); v_code := NULL; END IF;
  END IF;

  IF v_longest_win_streak >= 5 THEN
    INSERT INTO public.user_achievements (user_id, achievement_code)
    VALUES (p_user_id, 'streak5')
    ON CONFLICT DO NOTHING
    RETURNING achievement_code INTO v_code;
    IF v_code IS NOT NULL THEN v_unlocked := array_append(v_unlocked, v_code); v_code := NULL; END IF;
  END IF;

  IF v_matches_won >= 50 THEN
    INSERT INTO public.user_achievements (user_id, achievement_code)
    VALUES (p_user_id, 'champion50')
    ON CONFLICT DO NOTHING
    RETURNING achievement_code INTO v_code;
    IF v_code IS NOT NULL THEN v_unlocked := array_append(v_unlocked, v_code); v_code := NULL; END IF;
  END IF;

  IF v_tier = 'diamond' THEN
    INSERT INTO public.user_achievements (user_id, achievement_code)
    VALUES (p_user_id, 'tier_diamond')
    ON CONFLICT DO NOTHING
    RETURNING achievement_code INTO v_code;
    IF v_code IS NOT NULL THEN v_unlocked := array_append(v_unlocked, v_code); v_code := NULL; END IF;
  END IF;

  IF v_pvp_matches >= 10 THEN
    INSERT INTO public.user_achievements (user_id, achievement_code)
    VALUES (p_user_id, 'social10')
    ON CONFLICT DO NOTHING
    RETURNING achievement_code INTO v_code;
    IF v_code IS NOT NULL THEN v_unlocked := array_append(v_unlocked, v_code); v_code := NULL; END IF;
  END IF;

  RETURN v_unlocked;
END;
$$;

-- =====================================================================
-- unlock_achievement — famiglia 2 (eventi client-side momentanei).
-- Whitelist esplicita dei codici sbloccabili così, per non trasformarla in
-- un endpoint "sblocca qualsiasi achievement": gli altri 5 codici restano
-- raggiungibili solo tramite check_and_unlock_achievements.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.unlock_achievement(p_user_id UUID, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a sbloccare un achievement per un altro utente';
  END IF;

  IF p_code NOT IN ('speed', 'perfect') THEN
    RAISE EXCEPTION 'Codice achievement non sbloccabile direttamente dal client: %', p_code;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_code)
  VALUES (p_user_id, p_code)
  ON CONFLICT DO NOTHING
  RETURNING achievement_code INTO v_inserted;

  RETURN v_inserted IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_unlock_achievements(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unlock_achievement(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_unlock_achievements(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_achievement(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_achievements(UUID) TO anon, authenticated;
