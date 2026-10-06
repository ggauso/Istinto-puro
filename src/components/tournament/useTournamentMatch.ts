import { useEffect, useRef } from 'react';
import { getMyActiveTournamentMatches } from '../../lib/api/tournaments';
import { LEAGUE_TEXT_TO_ID } from '../../lib/api/friend-challenges';
import { useAuthStore } from '../../authStore';

export type OnJoinTournamentMatch = (
  roomId: string,
  opponentUserId: string,
  opponentNickname: string,
  opponentTier: string,
  isHost: boolean,
  tournamentMatchId: string,
  leagueId?: number,
  difficulty?: number
) => void;

/**
 * Polling globale (stesso pattern delle sfide-amico in App.tsx): quando un
 * match di torneo diventa pronto per l'utente corrente (entrambi i
 * giocatori del bracket noti), naviga automaticamente alla partita — a
 * differenza delle sfide-amico non c'è nulla da "accettare": il bracket ha
 * già deciso gli accoppiamenti.
 *
 * Nota: aspetta `authLoading` da useAuthStore prima di avviare il polling,
 * stesso motivo del fix già applicato in src/components/challenge/useChallenge.ts
 * (dopo un reload completo `user` parte null finché l'auth non si inizializza).
 */
export function useTournamentMatch(onJoinMatch: OnJoinTournamentMatch) {
  const { user, loading: authLoading } = useAuthStore();
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    shownRef.current.clear();
  }, [user]);

  useEffect(() => {
    if (!user || authLoading) return;

    const poll = async () => {
      const result = await getMyActiveTournamentMatches();
      if (!result.success) return;

      for (const m of result.matches) {
        if (shownRef.current.has(m.match_id)) continue;
        if (!m.opponent_id) continue;

        shownRef.current.add(m.match_id);
        // 'all' (Tutti i Campionati) non ha un id numerico: undefined fa sì
        // che get_random_match non filtri per campionato (vedi handleJoinTournamentMatch
        // in App.tsx: `leagueId || null`).
        const leagueId = m.league === 'all' ? undefined : LEAGUE_TEXT_TO_ID[m.league];
        onJoinMatch(m.room_id, m.opponent_id, m.opponent_nickname, m.opponent_tier, m.is_player1, m.match_id, leagueId, m.difficulty);
        break; // un match alla volta: se ce ne fossero altri, il prossimo giro di polling li gestisce
      }
    };

    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [user, authLoading]);
}
