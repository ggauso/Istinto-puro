-- =====================================================================
-- 17_friend_challenges_all_leagues.sql
--
-- Bug fix (2026-10-06, segnalato dall'utente): nella sfida diretta tra
-- amici (ChallengeFriendModal.tsx) non era possibile selezionare "Tutti i
-- Campionati" — opzione già presente nel matchmaking singolo/PvP e nei
-- tornei (Milestone 5, Task 5.5.5). Il CHECK su `friend_challenges.league`
-- non ammetteva il valore 'all', stesso fix già applicato a
-- `tournaments.league` in 11_tournaments.sql.
--
-- Il resto della catena funziona già senza modifiche: LEAGUE_TEXT_TO_ID
-- (src/lib/api/friend-challenges.ts) non ha una voce per 'all' per design
-- (mappa solo i 5 campionati singoli), e `useChallenge.ts` già tratta
-- `leagueId` undefined come "nessun filtro campionato" passandolo a valle
-- con `leagueId || undefined` — stesso pattern già verificato per i tornei
-- in useTournamentMatch.ts.
-- =====================================================================

ALTER TABLE public.friend_challenges DROP CONSTRAINT IF EXISTS friend_challenges_league_check;
ALTER TABLE public.friend_challenges ADD CONSTRAINT friend_challenges_league_check
  CHECK (league IN ('all', 'seria_a', 'premier', 'la_liga', 'bundesliga', 'ligue_1'));
