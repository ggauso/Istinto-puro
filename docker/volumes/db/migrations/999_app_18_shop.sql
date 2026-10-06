-- =====================================================================
-- 18_shop.sql
--
-- Milestone 9 (ROADMAP_FEATURES.md): Shop e Personalizzazione. Valuta
-- (coins) guadagnata vincendo partite e sbloccando achievement, spendibile
-- in un negozio cosmetico (badge + temi colore profilo).
--
-- Nota di design: il "cambio nickname" previsto dal roadmap originale
-- (Task 9.2.1) NON è stato implementato come oggetto a pagamento — il
-- nickname è già modificabile gratuitamente e senza limiti tramite
-- updateProfile() (src/authStore.ts, UPDATE diretto su profiles via RLS
-- "Users can update own profile"), senza nessuna RPC/cooldown di mezzo.
-- Un oggetto "sblocca il cambio nickname" sarebbe quindi un pagamento per
-- qualcosa già gratuito. Al suo posto: 3 badge cosmetici + 3 temi colore,
-- entrambi genuinamente nuovi.
-- =====================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_color TEXT;

-- =====================================================================
-- Catalogo (pattern identico ad achievements/user_achievements in
-- 12_achievements.sql): pubblico in lettura, scritture solo via RPC
-- SECURITY DEFINER sotto.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.shop_items (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  cost INTEGER NOT NULL CHECK (cost > 0),
  category TEXT NOT NULL CHECK (category IN ('badge', 'theme')),
  -- Solo per category='theme': colore applicato a profiles.theme_color
  -- quando il tema è attivato (set_active_theme). NULL per i badge.
  color_hex TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view shop catalog" ON public.shop_items;
CREATE POLICY "Anyone can view shop catalog" ON public.shop_items
  FOR SELECT USING (true);

INSERT INTO public.shop_items (code, label, description, icon, cost, category, color_hex, sort_order) VALUES
  ('badge_star',   'Stella',  'Badge stella accanto al nickname',  '⭐', 50,  'badge', NULL,      1),
  ('badge_fire',   'Fiamma',  'Badge fiamma accanto al nickname',  '🔥', 100, 'badge', NULL,      2),
  ('badge_crown',  'Corona',  'Badge corona accanto al nickname',  '👑', 150, 'badge', NULL,      3),
  ('theme_gold',   'Tema Oro',      'Accento colore oro per il profilo',      '🎨', 200, 'theme', '#FFD700', 4),
  ('theme_crimson','Tema Cremisi',  'Accento colore cremisi per il profilo',  '🎨', 200, 'theme', '#DC143C', 5),
  ('theme_azure',  'Tema Azzurro',  'Accento colore azzurro per il profilo',  '🎨', 200, 'theme', '#00BFFF', 6)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label, description = EXCLUDED.description, icon = EXCLUDED.icon,
  cost = EXCLUDED.cost, category = EXCLUDED.category, color_hex = EXCLUDED.color_hex,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS public.user_purchases (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL REFERENCES public.shop_items(code) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, item_code)
);

CREATE INDEX IF NOT EXISTS user_purchases_user_id_idx ON public.user_purchases (user_id);

ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view purchases" ON public.user_purchases;
CREATE POLICY "Anyone can view purchases" ON public.user_purchases
  FOR SELECT USING (true);

-- =====================================================================
-- get_shop_catalog — catalogo + stato "owned" per l'utente (pattern
-- identico a get_user_achievements)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_shop_catalog(p_user_id UUID)
RETURNS TABLE (
  code TEXT, label TEXT, description TEXT, icon TEXT, cost INTEGER,
  category TEXT, color_hex TEXT, owned BOOLEAN, purchased_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.code, s.label, s.description, s.icon, s.cost, s.category, s.color_hex,
    (up.user_id IS NOT NULL) AS owned,
    up.purchased_at
  FROM public.shop_items s
  LEFT JOIN public.user_purchases up
    ON up.item_code = s.code AND up.user_id = p_user_id
  ORDER BY s.sort_order;
END;
$$;

-- =====================================================================
-- purchase_shop_item — atomica: niente saldo negativo (UPDATE con WHERE
-- coins >= cost, controllo con FOUND) e niente doppio acquisto (WHERE NOT
-- EXISTS su user_purchases prima dello scalo coins).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.purchase_shop_item(p_user_id UUID, p_item_code TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost INTEGER;
  v_balance INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato ad acquistare per un altro utente';
  END IF;

  SELECT cost INTO v_cost FROM public.shop_items WHERE code = p_item_code;
  IF v_cost IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Oggetto non trovato'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_purchases WHERE user_id = p_user_id AND item_code = p_item_code) THEN
    SELECT coins INTO v_balance FROM public.profiles WHERE id = p_user_id;
    RETURN QUERY SELECT FALSE, 'Oggetto già posseduto'::TEXT, v_balance;
    RETURN;
  END IF;

  -- Scalo atomico: il WHERE coins >= v_cost nella stessa UPDATE evita la
  -- race condition "leggi saldo, poi scrivi" (due acquisti concorrenti
  -- potrebbero altrimenti portare il saldo sotto zero).
  UPDATE public.profiles
  SET coins = coins - v_cost, updated_at = NOW()
  WHERE id = p_user_id AND coins >= v_cost
  RETURNING coins INTO v_balance;

  IF NOT FOUND THEN
    SELECT coins INTO v_balance FROM public.profiles WHERE id = p_user_id;
    RETURN QUERY SELECT FALSE, 'Coins insufficienti'::TEXT, v_balance;
    RETURN;
  END IF;

  INSERT INTO public.user_purchases (user_id, item_code) VALUES (p_user_id, p_item_code);

  RETURN QUERY SELECT TRUE, 'Acquisto completato'::TEXT, v_balance;
END;
$$;

-- =====================================================================
-- set_active_theme — applica un tema già posseduto (NON lo acquista).
-- Separata da purchase_shop_item perché un utente può possedere più temi
-- e voler cambiare quale ha attivo senza pagare di nuovo.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_active_theme(p_user_id UUID, p_item_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_color TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a modificare il tema di un altro utente';
  END IF;

  SELECT s.color_hex INTO v_color
  FROM public.shop_items s
  JOIN public.user_purchases up ON up.item_code = s.code
  WHERE s.code = p_item_code AND s.category = 'theme' AND up.user_id = p_user_id;

  IF v_color IS NULL THEN
    RETURN FALSE; -- non posseduto, non esiste, o non è un tema
  END IF;

  UPDATE public.profiles SET theme_color = v_color, updated_at = NOW() WHERE id = p_user_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_shop_item(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_active_theme(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shop_catalog(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_theme(UUID, TEXT) TO authenticated;

-- =====================================================================
-- Guadagno coins vincendo partite: +15 coins per vittoria (qualunque
-- modalità/difficoltà). CREATE OR REPLACE sulla stessa firma esistente
-- (vedi 03_matches_and_leaderboard.sql) — solo il body cambia, nessun
-- DROP necessario. Corpo copiato fedelmente da quello attuale + 2 righe
-- per i coins.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.save_match_result(
  p_user_id UUID,
  p_player_name TEXT,
  p_opponent_name TEXT,
  p_player_tier TEXT,
  p_opponent_tier TEXT,
  p_player_score INTEGER,
  p_opponent_score INTEGER,
  p_is_win BOOLEAN,
  p_difficulty INTEGER DEFAULT 1,
  p_is_pvp BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_id UUID;
  v_won_delta INTEGER;
  v_coins_earned INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a salvare il risultato per un altro utente';
  END IF;

  v_won_delta := CASE WHEN p_is_win THEN 1 ELSE 0 END;
  v_coins_earned := CASE WHEN p_is_win THEN 15 ELSE 0 END;

  INSERT INTO public.matches_history (
    user_id, player_name, opponent_name, player_tier, opponent_tier,
    player_score, opponent_score, is_win, difficulty, is_pvp, played_at
  ) VALUES (
    p_user_id, p_player_name, p_opponent_name, p_player_tier, p_opponent_tier,
    p_player_score, p_opponent_score, p_is_win, p_difficulty, p_is_pvp, NOW()
  )
  RETURNING id INTO v_match_id;

  UPDATE public.profiles
  SET
    total_score = total_score + p_player_score,
    matches_played = matches_played + 1,
    matches_won = matches_won + v_won_delta,
    coins = coins + v_coins_earned,
    tier = CASE
      WHEN total_score + p_player_score >= 5001 THEN 'diamond'
      WHEN total_score + p_player_score >= 3001 THEN 'platinum'
      WHEN total_score + p_player_score >= 1501 THEN 'gold'
      WHEN total_score + p_player_score >= 501 THEN 'silver'
      ELSE 'bronze'
    END,
    updated_at = NOW()
  WHERE id = p_user_id;

  PERFORM public.update_weekly_leaderboard(p_user_id, p_player_score, 1, v_won_delta);
  PERFORM public.update_monthly_leaderboard(p_user_id, p_player_score, 1, v_won_delta);

  RETURN v_match_id;
END;
$$;

-- =====================================================================
-- Bonus coins per achievement sbloccati, proporzionale al tier
-- dell'achievement (bronze=10, silver=25, gold=50, platinum=100).
-- CREATE OR REPLACE su check_and_unlock_achievements (stessa firma,
-- corpo copiato da 13_achievements_expansion.sql + bonus coins finale) e
-- su unlock_achievement (stesso trattamento per i 4 codici client-side).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_and_unlock_achievements(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_matches_won INTEGER;
  v_longest_win_streak INTEGER;
  v_matches_played INTEGER;
  v_tier_rank INTEGER;
  v_pvp_matches INTEGER;
  v_tournament_joins INTEGER;
  v_tournament_wins INTEGER;
  v_big_tournament_win BOOLEAN;
  v_unlocked TEXT[];
  v_coin_bonus INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a verificare gli achievement di un altro utente';
  END IF;

  SELECT
    COALESCE(matches_won, 0),
    COALESCE(longest_win_streak, 0),
    COALESCE(matches_played, 0),
    CASE COALESCE(tier, 'bronze')
      WHEN 'silver' THEN 1 WHEN 'gold' THEN 2 WHEN 'platinum' THEN 3 WHEN 'diamond' THEN 4 ELSE 0
    END
  INTO v_matches_won, v_longest_win_streak, v_matches_played, v_tier_rank
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT COUNT(*)::INTEGER INTO v_pvp_matches
  FROM public.matches_history
  WHERE user_id = p_user_id AND is_pvp = TRUE;

  SELECT COUNT(*)::INTEGER INTO v_tournament_joins
  FROM public.tournament_participants
  WHERE user_id = p_user_id;

  SELECT COUNT(*)::INTEGER INTO v_tournament_wins
  FROM public.tournament_participants
  WHERE user_id = p_user_id AND status = 'winner';

  SELECT EXISTS(
    SELECT 1 FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
    WHERE tp.user_id = p_user_id AND tp.status = 'winner' AND t.max_players = 16
  ) INTO v_big_tournament_win;

  WITH criteria(code, qualifies) AS (
    VALUES
      ('first_win',          v_matches_won >= 1),
      ('win_10',             v_matches_won >= 10),
      ('win_50',             v_matches_won >= 50),
      ('win_150',            v_matches_won >= 150),
      ('win_500',            v_matches_won >= 500),
      ('streak5',            v_longest_win_streak >= 5),
      ('streak10',           v_longest_win_streak >= 10),
      ('streak25',           v_longest_win_streak >= 25),
      ('tier_silver',        v_tier_rank >= 1),
      ('tier_gold',          v_tier_rank >= 2),
      ('tier_platinum',      v_tier_rank >= 3),
      ('tier_diamond',       v_tier_rank >= 4),
      ('social10',           v_pvp_matches >= 10),
      ('social50',           v_pvp_matches >= 50),
      ('social200',          v_pvp_matches >= 200),
      ('play50',             v_matches_played >= 50),
      ('play250',            v_matches_played >= 250),
      ('play1000',           v_matches_played >= 1000),
      ('tournament_join',    v_tournament_joins >= 1),
      ('tournament_win',     v_tournament_wins >= 1),
      ('tournament_win5',    v_tournament_wins >= 5),
      ('tournament_big_win', v_big_tournament_win)
  ),
  ins AS (
    INSERT INTO public.user_achievements (user_id, achievement_code)
    SELECT p_user_id, code FROM criteria WHERE qualifies
    ON CONFLICT DO NOTHING
    RETURNING achievement_code
  )
  SELECT array_agg(achievement_code) INTO v_unlocked FROM ins;

  v_unlocked := COALESCE(v_unlocked, '{}');

  IF array_length(v_unlocked, 1) > 0 THEN
    SELECT COALESCE(SUM(
      CASE a.tier
        WHEN 'bronze' THEN 10 WHEN 'silver' THEN 25 WHEN 'gold' THEN 50 WHEN 'platinum' THEN 100 ELSE 0
      END
    ), 0)
    INTO v_coin_bonus
    FROM public.achievements a
    WHERE a.code = ANY(v_unlocked);

    IF v_coin_bonus > 0 THEN
      UPDATE public.profiles SET coins = coins + v_coin_bonus, updated_at = NOW() WHERE id = p_user_id;
    END IF;
  END IF;

  RETURN v_unlocked;
END;
$$;

CREATE OR REPLACE FUNCTION public.unlock_achievement(p_user_id UUID, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted TEXT;
  v_tier TEXT;
  v_coin_bonus INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a sbloccare un achievement per un altro utente';
  END IF;

  IF p_code NOT IN ('speed', 'speed_flash', 'perfect', 'perfect25') THEN
    RAISE EXCEPTION 'Codice achievement non sbloccabile direttamente dal client: %', p_code;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_code)
  VALUES (p_user_id, p_code)
  ON CONFLICT DO NOTHING
  RETURNING achievement_code INTO v_inserted;

  IF v_inserted IS NOT NULL THEN
    SELECT tier INTO v_tier FROM public.achievements WHERE code = p_code;
    v_coin_bonus := CASE v_tier
      WHEN 'bronze' THEN 10 WHEN 'silver' THEN 25 WHEN 'gold' THEN 50 WHEN 'platinum' THEN 100 ELSE 0
    END;
    IF v_coin_bonus > 0 THEN
      UPDATE public.profiles SET coins = coins + v_coin_bonus, updated_at = NOW() WHERE id = p_user_id;
    END IF;
  END IF;

  RETURN v_inserted IS NOT NULL;
END;
$$;
