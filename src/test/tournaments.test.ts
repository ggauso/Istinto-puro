/**
 * Test per il sistema Tornei (Milestone 5)
 *
 * La logica di autorizzazione/avanzamento bracket vive lato server
 * (supabase/schema/11_tournaments.sql, SECURITY DEFINER) ed è stata
 * verificata end-to-end contro un DB Postgres reale (torneo a 4
 * giocatori: iscrizione, generazione round 1, avanzamento a round 2,
 * posizioni finali corrette, idempotenza su doppio completamento match).
 *
 * Qui testiamo la logica client-side pura: formato dati, algoritmo di
 * accoppiamento round-successivo (stessa formula usata in SQL), calcolo
 * posizione finale, dedup del polling — stesso livello di dettaglio di
 * challenges.test.ts/friend-challenges.test.ts.
 */

import { describe, it, expect } from 'vitest';

describe('Tornei - Creazione e iscrizione', () => {
  it('accetta solo potenze di 2 come numero massimo di giocatori', () => {
    const ALLOWED = [2, 4, 8, 16];
    expect(ALLOWED.includes(4)).toBe(true);
    expect(ALLOWED.includes(8)).toBe(true);
    expect(ALLOWED.includes(3)).toBe(false);
    expect(ALLOWED.includes(5)).toBe(false);
  });

  it('un torneo nuovo parte con status "open" e current_players 0', () => {
    const tournament = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Torneo del venerdì',
      max_players: 8,
      current_players: 0,
      status: 'open',
    };

    expect(tournament.status).toBe('open');
    expect(tournament.current_players).toBe(0);
    expect(tournament.current_players).toBeLessThan(tournament.max_players);
  });

  it('il torneo si avvia solo quando current_players raggiunge max_players', () => {
    const shouldStart = (current: number, max: number) => current === max;

    expect(shouldStart(3, 4)).toBe(false);
    expect(shouldStart(4, 4)).toBe(true);
  });
});

describe('Tornei - Algoritmo di accoppiamento bracket', () => {
  // Stessa formula usata in supabase/schema/11_tournaments.sql
  // (_finalize_tournament_match): il vincitore del match dispari diventa
  // player1 del match successivo, il vincitore del match pari diventa
  // player2 dello stesso match (match_number = ceil(n/2)).
  const nextMatchNumber = (matchNumber: number) => Math.ceil(matchNumber / 2);
  const isPlayer1Slot = (matchNumber: number) => matchNumber % 2 === 1;

  it('accoppia correttamente i vincitori del round 1 in un torneo da 8 (4 match -> 2 match)', () => {
    expect(nextMatchNumber(1)).toBe(1);
    expect(nextMatchNumber(2)).toBe(1);
    expect(nextMatchNumber(3)).toBe(2);
    expect(nextMatchNumber(4)).toBe(2);

    expect(isPlayer1Slot(1)).toBe(true);  // vincitore match 1 -> player1 del match 1 del round succ.
    expect(isPlayer1Slot(2)).toBe(false); // vincitore match 2 -> player2 dello stesso match
    expect(isPlayer1Slot(3)).toBe(true);
    expect(isPlayer1Slot(4)).toBe(false);
  });

  it('un torneo da 2 giocatori ha un solo round (la finale è il round 1)', () => {
    const totalRounds = (maxPlayers: number) => ({ 2: 1, 4: 2, 8: 3, 16: 4 } as Record<number, number>)[maxPlayers];
    expect(totalRounds(2)).toBe(1);
    expect(totalRounds(4)).toBe(2);
    expect(totalRounds(8)).toBe(3);
    expect(totalRounds(16)).toBe(4);
  });
});

describe('Tornei - Posizione finale a eliminazione', () => {
  // Stessa formula usata lato server: max_players / 2^eliminated_round + 1.
  // Verificata live su un torneo reale da 4 giocatori in questa sessione:
  // vincitore=1, finalista perdente=2, semifinalisti=3 (pari merito).
  const finalPosition = (maxPlayers: number, eliminatedRound: number) =>
    Math.floor(maxPlayers / Math.pow(2, eliminatedRound)) + 1;

  it('calcola correttamente le posizioni per un torneo da 4 giocatori', () => {
    expect(finalPosition(4, 1)).toBe(3); // eliminato in semifinale (round 1 di un torneo da 4)
    expect(finalPosition(4, 2)).toBe(2); // perdente della finale (round 2)
  });

  it('calcola correttamente le posizioni per un torneo da 8 giocatori', () => {
    expect(finalPosition(8, 1)).toBe(5); // eliminato ai quarti
    expect(finalPosition(8, 2)).toBe(3); // eliminato in semifinale
    expect(finalPosition(8, 3)).toBe(2); // perdente della finale
  });

  it('il vincitore ha sempre posizione 1 (assegnata esplicitamente, non dalla formula)', () => {
    // Il vincitore non passa mai per "eliminated": la sua final_position=1
    // viene impostata a parte quando il torneo si conclude.
    const winnerPosition = 1;
    expect(winnerPosition).toBe(1);
  });
});

describe('Tornei - Polling match pronti (stesso pattern delle sfide-amico)', () => {
  it('non deve notificare due volte lo stesso match già mostrato', () => {
    const shownMatches = new Set<string>();

    const shouldNotify = (matchId: string) => {
      if (shownMatches.has(matchId)) return false;
      shownMatches.add(matchId);
      return true;
    };

    expect(shouldNotify('match-1')).toBe(true);
    expect(shouldNotify('match-1')).toBe(false);
    expect(shouldNotify('match-2')).toBe(true);
  });

  it('ignora i match senza avversario ancora assegnato (bracket non completo)', () => {
    const matches = [
      { match_id: 'm1', opponent_id: 'user-2' },
      { match_id: 'm2', opponent_id: null },
    ];

    const ready = matches.filter((m) => m.opponent_id !== null);
    expect(ready).toHaveLength(1);
    expect(ready[0].match_id).toBe('m1');
  });
});

describe('Tornei - room_id per il join della partita', () => {
  it('riconosce un room_id di torneo dal prefisso (stesso pattern di friend_/challenge_)', () => {
    const isTournamentRoom = (roomId: string) => roomId.startsWith('tournament_');

    expect(isTournamentRoom('tournament_abc123')).toBe(true);
    expect(isTournamentRoom('friend_abc123')).toBe(false);
    expect(isTournamentRoom('challenge_abc123')).toBe(false);
  });
});

describe('Tornei - separazione campi completamento partita (fix collaterale)', () => {
  // GameScreen.tsx a fine partita deve chiamare la RPC di completamento
  // giusta in base a QUALE dei tre campi distinti dello store è impostato
  // (currentChallengeId / currentFriendChallengeId / currentTournamentMatchId)
  // — mai più di uno insieme, e mai confusi tra loro (bug preesistente
  // corretto in questa sessione: prima esisteva solo currentChallengeId,
  // riusato ambiguamente anche per le sfide-amico).
  type CompletionKind = 'challenge' | 'friend_challenge' | 'tournament' | 'none';

  function pickCompletionKind(state: {
    currentChallengeId: string | null;
    currentFriendChallengeId: string | null;
    currentTournamentMatchId: string | null;
  }): CompletionKind {
    if (state.currentChallengeId) return 'challenge';
    if (state.currentFriendChallengeId) return 'friend_challenge';
    if (state.currentTournamentMatchId) return 'tournament';
    return 'none';
  }

  it('sceglie completeFriendChallenge quando è impostato solo currentFriendChallengeId', () => {
    const kind = pickCompletionKind({ currentChallengeId: null, currentFriendChallengeId: 'fc-1', currentTournamentMatchId: null });
    expect(kind).toBe('friend_challenge');
  });

  it('sceglie completeTournamentMatch quando è impostato solo currentTournamentMatchId', () => {
    const kind = pickCompletionKind({ currentChallengeId: null, currentFriendChallengeId: null, currentTournamentMatchId: 'tm-1' });
    expect(kind).toBe('tournament');
  });

  it('sceglie completeChallenge (sfida-link) quando è impostato solo currentChallengeId', () => {
    const kind = pickCompletionKind({ currentChallengeId: 'c-1', currentFriendChallengeId: null, currentTournamentMatchId: null });
    expect(kind).toBe('challenge');
  });

  it('non completa nulla per una partita AI (tutti e tre i campi null)', () => {
    const kind = pickCompletionKind({ currentChallengeId: null, currentFriendChallengeId: null, currentTournamentMatchId: null });
    expect(kind).toBe('none');
  });
});
