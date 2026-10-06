import { StateCreator } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../authStore';
import { unlockAchievement } from '../lib/api/achievements';
import { recordRoundAnswer } from '../lib/api/round-stats';
import { GameState, GameplaySlice, MatchData, getRoundDurationMs, getRemainingSeconds, HARD_MODE_DIFFICULTY } from './types';

export const createGameplaySlice: StateCreator<GameState, [], [], GameplaySlice> = (set, get) => ({
  match: null,
  score: 0,
  timeLeft: 10,
  status: 'idle',
  gameChannel: null,
  selectedLeague: null,
  selectedDifficulty: 1, // Default Facile
  gameMode: 'pvp',
  correctAnswer: null,
  correctAnswerSeasons: null,
  recentTeams: [],
  isHost: false,
  round: 0,
  playerRoundsWon: 0,
  opponentRoundsWon: 0,
  streak: 0,
  roundStartTime: null,
  lastScoreAdded: 0,
  lastRarity: 1,
  lastCombo: 1,
  opponentInfo: null,
  currentChallengeId: null,
  currentFriendChallengeId: null,
  currentTournamentMatchId: null,

  setGameMode: (mode) => set({ gameMode: mode }),
  setSelectedLeague: (leagueId) => set({ selectedLeague: leagueId }),
  setSelectedDifficulty: (difficulty) => set({ selectedDifficulty: difficulty }),
  setStatus: (status) => set({ status }),
  setChallengeId: (id: string | null) => set({ currentChallengeId: id }),
  setFriendChallengeId: (id: string | null) => set({ currentFriendChallengeId: id }),
  setTournamentMatchId: (id: string | null) => set({ currentTournamentMatchId: id }),

  fetchMatchAndBroadcast: async () => {
    try {
      let matchData: MatchData | null = null;
      let fetchedAnswer: string | null = null;
      const { selectedLeague, selectedDifficulty, recentTeams } = get();

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_random_match', {
        p_league_id: selectedLeague,
        p_recent_teams: recentTeams
      });

      if (rpcError) {
        console.error('ERRORE RPC SUPABASE:', rpcError);
        throw rpcError;
      }

      if (rpcData && rpcData.length > 0) {
        const m = rpcData[0];
        matchData = {
          team1_id: m.team1_id,
          team1_name: m.team1_name,
          team1_logo: m.team1_logo,
          team2_id: m.team2_id,
          team2_name: m.team2_name,
          team2_logo: m.team2_logo,
        };
        fetchedAnswer = m.player_name;

        // Store seasons for both teams
        const team1Seasons = m.team1_seasons || [];
        const team2Seasons = m.team2_seasons || [];

        // Update recent teams to avoid picking them again soon
        const newRecentTeams = [...recentTeams, m.team1_id, m.team2_id].slice(-20); // Keep last 20 teams
        const correctAnswerSeasons = { team1: team1Seasons, team2: team2Seasons };

        const { gameChannel, gameMode, opponentInfo } = get();
        console.log('Host sending game_start, gameChannel exists:', !!gameChannel, 'gameMode:', gameMode, 'opponentInfo:', opponentInfo);
        // Timestamp condiviso: host e guest calcolano il tempo rimanente a
        // partire da questo stesso istante, per avere i countdown allineati.
        const roundStartTime = Date.now();
        if (gameChannel && matchData && gameMode === 'pvp') {
          console.log('HOST ACTUALLY SENDING game_start...');
          // Include opponent info in the payload
          const matchDataWithOpponent = {
            ...matchData,
            opponent_name: opponentInfo?.nickname || 'Avversario',
            opponent_tier: opponentInfo?.tier || 'bronze'
          };
          console.log('Sending match with opponent_name:', matchDataWithOpponent.opponent_name);

          // Send game_start with retry mechanism
          const sendGameStart = () => {
            console.log('Sending game_start with opponent info...');
            gameChannel.send({
              type: 'broadcast',
              event: 'game_start',
              payload: {
                match: matchDataWithOpponent,
                correctAnswer: fetchedAnswer,
                correctAnswerSeasons,
                roundStartTime
              }
            });
          };
          sendGameStart();

          // Retry after 1 second if no ack received
          setTimeout(() => {
            if (get().status !== 'playing') {
              console.log('No ack received, retrying game_start...');
              sendGameStart();
            }
          }, 1500);

          // Retry after 3 seconds as final attempt
          setTimeout(() => {
            if (get().status !== 'playing') {
              console.log('Still no ack, final retry...');
              sendGameStart();
            }
          }, 3500);
        }

        // Include opponent info in host's own match state too
        const matchDataForHost = gameMode === 'pvp' ? {
          ...matchData,
          opponent_name: opponentInfo?.nickname || 'Avversario',
          opponent_tier: opponentInfo?.tier || 'bronze'
        } : matchData;

        set({
          recentTeams: newRecentTeams,
          correctAnswerSeasons,
          match: matchDataForHost,
          timeLeft: getRoundDurationMs(gameMode, get().selectedDifficulty) / 1000,
          status: 'playing',
          correctAnswer: fetchedAnswer,
          roundStartTime,
          round: get().round + 1
        });
      } else {
        throw new Error('Nessun match valido trovato tramite RPC');
      }
    } catch (error) {
      console.error('Errore critico durante il fetch del match:', error);
      get().resetGame();
      alert('Impossibile trovare un match. Riprova o cambia campionato.');
    }
  },

  validatePlayer: async (playerName: string) => {
    const { match, gameChannel, playerId, gameMode } = get();
    if (!match) return false;

    let isCorrect = false;
    let rarity = 1.0;
    let realPlayerName = playerName;

    const isHardMode = get().selectedDifficulty === HARD_MODE_DIFFICULTY;

    try {
      const { data, error } = await supabase.rpc('validate_player_intersection', {
        team_a_id: match.team1_id,
        team_b_id: match.team2_id,
        input_name: playerName,
        p_strict: isHardMode
      });

      if (error) throw error;

      // Handle both boolean return (old RPC), object return, and array of objects (from RETURNS TABLE)
      if (data === true) {
        isCorrect = true;
      } else if (Array.isArray(data) && data.length > 0 && data[0].valid) {
        isCorrect = true;
        rarity = 1.0 + (data[0].similarity_score || 0); // Use similarity as a small rarity boost
        realPlayerName = data[0].player_name || playerName;
      } else if (data && !Array.isArray(data) && (data as any).is_valid) {
        isCorrect = true;
        rarity = (data as any).rarity_multiplier || 1.0;
        realPlayerName = (data as any).player_name || playerName;
      }
    } catch (error) {
      console.warn('Errore RPC durante la validazione:', error);
    }

    // Calcolato qui (non solo nel ramo isCorrect come prima) perché serve
    // ad entrambi i rami per il tracciamento per-round sotto (Milestone 7,
    // Task 7.2) — stesso valore di prima per il ramo corretto, nessun
    // cambio di comportamento: nessun await avviene tra la risoluzione
    // della RPC sopra e questo punto.
    const timeTaken = (Date.now() - (get().roundStartTime || Date.now())) / 1000;

    // Tracciamento per-round (fire-and-forget): ogni risposta, corretta o
    // sbagliata, viene registrata per le statistiche avanzate (combo
    // squadre, accuracy per difficoltà, tempo medio di risposta, giocatori
    // più indovinati). Il nome registrato è sempre quello corretto per
    // questo round (get().correctAnswer, valorizzato in
    // fetchMatchAndBroadcast), non l'input digitato dall'utente.
    {
      const trackingUserId = useAuthStore.getState().user?.id;
      const correctAnswerName = get().correctAnswer;
      if (trackingUserId && match && correctAnswerName) {
        recordRoundAnswer(
          trackingUserId,
          match.team1_id,
          match.team2_id,
          correctAnswerName,
          isCorrect,
          get().selectedDifficulty,
          Math.round(timeTaken * 1000)
        ).catch(err => console.error('Errore tracciamento round:', err));
      }
    }

    if (isCorrect) {
      const t = Math.min(Math.max(timeTaken, 0), 10);

      let combo = 1.0;
      const currentStreak = get().streak;
      if (currentStreak === 1) combo = 1.1;
      else if (currentStreak >= 2) combo = 1.25;

      // Moltiplicatore di difficoltà: Facile = 1x, Medio = 1.5x, Difficile = 2x
      const difficultyMultiplier = 1 + ((get().selectedDifficulty - 1) * 0.5);

      const roundScore = Math.floor((1000 - 100 * t) * rarity * combo * difficultyMultiplier);

      const newPlayerRoundsWon = get().playerRoundsWon + 1;
      const newStreak = currentStreak + 1;

      let nextStatus: GameState['status'] = 'won';
      if (newPlayerRoundsWon >= 2) {
        nextStatus = 'match_won';
        useAuthStore.getState().updateProfileStats(true, get().score + roundScore);
      }

      // Achievement osservabili solo in questo istante (non persistiti in
      // nessuna tabella): risposta sotto i 3s/1,5s, 10/25 risposte corrette
      // di fila. unlockAchievement deduplica da sé i tentativi ripetuti
      // nella stessa sessione browser (vedi src/lib/api/achievements.ts).
      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        const tryUnlock = (code: 'speed' | 'speed_flash' | 'perfect' | 'perfect25') => {
          unlockAchievement(userId, code)
            .then((isNew) => {
              if (isNew) set((state) => ({ newlyUnlockedAchievements: [...state.newlyUnlockedAchievements, code] }));
            })
            .catch(err => console.error(`Errore sblocco achievement ${code}:`, err));
        };

        if (timeTaken < 3) tryUnlock('speed');
        if (timeTaken < 1.5) tryUnlock('speed_flash');
        if (newStreak >= 10) tryUnlock('perfect');
        if (newStreak >= 25) tryUnlock('perfect25');
      }

      if (gameChannel && gameMode === 'pvp') {
        gameChannel.send({
          type: 'broadcast',
          event: 'player_won',
          payload: { playerId, roundScore, nextStatus }
        });
      }

      set((state) => ({
        score: state.score + roundScore,
        status: nextStatus,
        playerRoundsWon: newPlayerRoundsWon,
        streak: newStreak,
        lastScoreAdded: roundScore,
        lastRarity: rarity,
        lastCombo: combo,
        correctAnswer: realPlayerName
      }));
      return true;
    } else {
      // Penalità errore in modalità Hard (Task 10.1): -50 punti, stesso
      // valore già usato per la penalità di abbandono PvP
      // (abandonMatch in lifecycleSlice.ts) — mantiene coerente il "peso"
      // di un errore grave in tutta l'app invece di introdurre una nuova
      // costante arbitraria. Clampato a 0: lo score di sessione non deve
      // mai andare negativo (solo cosmetico, non incide sul punteggio
      // persistito in profiles.total_score).
      if (isHardMode) {
        set((state) => ({ streak: 0, score: Math.max(0, state.score - 50) }));
      } else {
        set({ streak: 0 });
      }
      return false;
    }
  },

  tickTimer: () => {
    set((state) => {
      if (state.status !== 'playing') return state;
      // Calcolato da roundStartTime (condiviso tra host e guest) invece di
      // decrementare localmente, così il round scade allo stesso istante
      // reale per entrambi i giocatori indipendentemente da quando il loro
      // setInterval locale è partito.
      const newTime = getRemainingSeconds(state.gameMode, state.roundStartTime, state.selectedDifficulty);
      if (newTime <= 0) {
        if (state.gameMode === 'ai') {
          useAuthStore.getState().updateProfileStats(false, state.score);
        }
        return { timeLeft: 0, status: 'lost', streak: 0 };
      }
      return { timeLeft: newTime };
    });
  },
});
