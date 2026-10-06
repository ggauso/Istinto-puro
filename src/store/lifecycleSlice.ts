import { StateCreator } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../authStore';
import { saveMatchResult } from '../lib/api/matches';
import { recordGameAudit } from '../lib/api/audit';
import { completeFriendChallenge, abandonFriendChallenge } from '../lib/api/friend-challenges';
import { abandonTournamentMatch } from '../lib/api/tournaments';
import { checkAndUnlockAchievements } from '../lib/api/achievements';
import { calculateTier, generateGuestName } from '../lib/game-utils';
import { GameState, LifecycleSlice } from './types';

export const createLifecycleSlice: StateCreator<GameState, [], [], LifecycleSlice> = (set, get) => ({
  newlyUnlockedAchievements: [],
  clearNewlyUnlockedAchievements: () => set({ newlyUnlockedAchievements: [] }),

  abandonMatch: async () => {
    const { status, gameMode, gameChannel, playerId, score, currentFriendChallengeId, currentTournamentMatchId } = get();
    const isGameOver = status === 'match_won' || status === 'match_lost' || (status === 'lost' && gameMode === 'ai');

    // Abbandona la sfida amichevole se presente
    if (currentFriendChallengeId && gameMode === 'pvp') {
      abandonFriendChallenge(currentFriendChallengeId).catch(err => console.error('Errore abbandono sfida amica:', err));
    }

    // Abbandona il match di torneo se presente (assegna vittoria per forfeit all'avversario)
    if (currentTournamentMatchId && gameMode === 'pvp') {
      abandonTournamentMatch(currentTournamentMatchId).catch(err => console.error('Errore abbandono match torneo:', err));
    }

    if (!isGameOver) {
      if (gameMode === 'pvp') {
        if (gameChannel) {
          // Attendiamo che il broadcast sia stato effettivamente inviato
          // (il canale usa ack:true) PRIMA di chiamare resetGame(): quella
          // rimuove subito il canale realtime, e senza questo await la
          // rimozione può correre in parallelo con l'invio e cancellarlo
          // prima che raggiunga il server — l'avversario resta bloccato
          // nella partita senza mai sapere di aver vinto per abbandono.
          try {
            await gameChannel.send({
              type: 'broadcast',
              event: 'opponent_abandoned',
              payload: { playerId }
            });
          } catch (err) {
            console.error('Errore invio broadcast abbandono:', err);
          }
        }
        // Penalità di 50 punti per abbandono in PvP
        useAuthStore.getState().updateProfileStats(false, -50, true);
      } else if (gameMode === 'ai') {
        // Nessuna penalità extra per l'IA, solo i punti attuali
        useAuthStore.getState().updateProfileStats(false, score, true);
      }
    }

    get().resetGame();
  },

  resetGame: () => {
    const { gameChannel, matchmakingChannel, gameMode } = get();
    if (gameChannel) supabase.removeChannel(gameChannel);
    if (matchmakingChannel) supabase.removeChannel(matchmakingChannel);

    set({
      status: 'idle',
      score: 0,
      timeLeft: gameMode === 'ai' ? 15 : 10,
      match: null,
      gameChannel: null,
      matchmakingChannel: null,
      round: 0,
      playerRoundsWon: 0,
      opponentRoundsWon: 0,
      streak: 0,
      isHost: false,
      opponentInfo: null,
      currentChallengeId: null,
      currentFriendChallengeId: null,
      currentTournamentMatchId: null
    });
  },

  saveMatchResultToDb: async (isWin: boolean, finalScore: number) => {
    const { match, gameMode, score, selectedDifficulty, currentFriendChallengeId, isHost, playerRoundsWon, opponentRoundsWon } = get();
    const { user } = useAuthStore.getState();

    if (!user || !match) return;

    // Completa la sfida amichevole se presente
    if (currentFriendChallengeId && gameMode === 'pvp') {
      const winnerId = isWin ? user.id : match.opponent_id;
      const creatorScore = isHost ? playerRoundsWon : opponentRoundsWon;
      const opponentScore = isHost ? opponentRoundsWon : playerRoundsWon;

      completeFriendChallenge(
        currentFriendChallengeId,
        winnerId,
        creatorScore,
        opponentScore
      ).catch(err => console.error('Errore completamento sfida amica:', err));
    }

    // Determina il nome del giocatore
    const { profile } = useAuthStore.getState();
    const playerName = profile?.first_name || generateGuestName();

    // Determina nome e tier dell'avversario
    const opponentName = gameMode === 'ai' ? 'AI' : (match.opponent_name || 'Avversario');
    const opponentTier = match.opponent_tier || 'bronze';

    // Calcola il tier del giocatore corrente
    const currentTotalScore = (profile?.total_score || 0) + score;
    const playerTier = calculateTier(currentTotalScore);

    // Salva il risultato nel database (non bloccante)
    saveMatchResult(
      playerName,
      opponentName,
      playerTier,
      opponentTier,
      isWin ? score : 0,
      isWin ? 0 : score,
      isWin,
      selectedDifficulty,
      gameMode === 'pvp'
    ).catch(err => console.error('Errore salvataggio risultato:', err));

    // Verifica achievement sbloccati da questa partita (prima vittoria,
    // streak, campione, tier diamond, social) — non bloccante, in coda
    // dopo il salvataggio così matches_history/profiles sono già aggiornati
    // nella maggior parte dei casi (eventuale ritardo si autocorregge alla
    // partita successiva, vedi commento in 12_achievements.sql).
    checkAndUnlockAchievements(user.id)
      .then((unlocked) => {
        if (unlocked.length > 0) {
          set((state) => ({
            newlyUnlockedAchievements: [...state.newlyUnlockedAchievements, ...unlocked]
          }));
        }
      })
      .catch(err => console.error('Errore verifica achievement:', err));

    // Registra evento di audit per il gioco
    const eventType = isWin ? 'match_won' : 'match_lost';
    recordGameAudit(user.id, eventType, match.team1_id?.toString(), score, {
      opponent: opponentName,
      opponent_tier: opponentTier,
      game_mode: gameMode,
      difficulty: selectedDifficulty
    }).catch(err => console.error('Errore audit game:', err));
  },
});
