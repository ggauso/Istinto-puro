import { create } from 'zustand';
import { supabase } from './lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuthStore } from './authStore';

export interface Team {
  id: number;
  name: string;
  logo_url: string;
}

export interface MatchData {
  team1_id: number;
  team1_name: string;
  team1_logo: string;
  team2_id: number;
  team2_name: string;
  team2_logo: string;
}

interface GameState {
  playerId: string;
  match: MatchData | null;
  score: number;
  timeLeft: number;
  status: 'idle' | 'searching' | 'joining' | 'starting' | 'playing' | 'won' | 'lost' | 'opponent_won' | 'match_won' | 'match_lost';
  gameChannel: RealtimeChannel | null;
  matchmakingChannel: RealtimeChannel | null;
  selectedLeague: number | null;
  selectedDifficulty: number;
  gameMode: 'pvp' | 'ai';
  correctAnswer: string | null;
  correctAnswerSeasons: { team1: number[], team2: number[] } | null;
  recentTeams: number[];
  errorMsg: string | null;
  
  isHost: boolean;
  round: number;
  playerRoundsWon: number;
  opponentRoundsWon: number;
  streak: number;
  roundStartTime: number | null;
  lastScoreAdded: number;
  lastRarity: number;
  lastCombo: number;
  
  setGameMode: (mode: 'pvp' | 'ai') => void;
  setSelectedLeague: (leagueId: number | null) => void;
  setSelectedDifficulty: (difficulty: number) => void;
  findMatch: () => void;
  joinGameRoom: (roomId: string, isHost: boolean) => void;
  fetchMatchAndBroadcast: () => Promise<void>;
  validatePlayer: (playerName: string) => Promise<boolean>;
  tickTimer: () => void;
  abandonMatch: () => void;
  resetGame: () => void;
  setStatus: (status: GameState['status']) => void;
  setErrorMsg: (msg: string | null) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 10);

export const useGameStore = create<GameState>((set, get) => ({
  playerId: generateId(),
  match: null,
  score: 0,
  timeLeft: 10,
  status: 'idle',
  gameChannel: null,
  matchmakingChannel: null,
  selectedLeague: null,
  selectedDifficulty: 1, // Default Facile
  gameMode: 'pvp',
  correctAnswer: null,
  correctAnswerSeasons: null,
  recentTeams: [],
  errorMsg: null,
  isHost: false,
  round: 0,
  playerRoundsWon: 0,
  opponentRoundsWon: 0,
  streak: 0,
  roundStartTime: null,
  lastScoreAdded: 0,
  lastRarity: 1,
  lastCombo: 1,

  setGameMode: (mode) => set({ gameMode: mode }),
  setSelectedLeague: (leagueId) => set({ selectedLeague: leagueId }),
  setSelectedDifficulty: (difficulty) => set({ selectedDifficulty: difficulty }),
  setErrorMsg: (msg) => set({ errorMsg: msg }),

  findMatch: () => {
    const { gameMode } = get();
    
    if (gameMode === 'ai') {
      set({ status: 'starting', isHost: true });
      get().fetchMatchAndBroadcast();
      return;
    }

    set({ status: 'searching' });
    const { playerId, matchmakingChannel: existingChannel, selectedLeague } = get();
    
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const channelName = selectedLeague ? `matchmaking_${selectedLeague}` : 'matchmaking';
    const channel = supabase.channel(channelName);
    set({ matchmakingChannel: channel });
    
    channel
      .on('broadcast', { event: 'match_found' }, (payload) => {
        const { player1, player2, roomId } = payload.payload;
        const state = get();
        if (state.status === 'searching' && (state.playerId === player1 || state.playerId === player2)) {
          console.log('Match trovato via broadcast!');
          const otherId = state.playerId === player1 ? player2 : player1;
          const isHost = state.playerId < otherId;
          get().joinGameRoom(roomId, isHost);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = get();
        if (state.status !== 'searching') return;

        const statePresences = channel.presenceState();
        const presences = Object.values(statePresences).flat() as any[];

        // Trova un altro giocatore che sta cercando
        const otherPlayer = presences.find(p => p.playerId !== state.playerId && p.status === 'searching');

        if (otherPlayer) {
          console.log('Avversario trovato in presence!', otherPlayer.playerId);
          // Ordine deterministico per decidere chi è l'host
          const isHost = state.playerId < otherPlayer.playerId;
          const roomId = `room_${isHost ? state.playerId : otherPlayer.playerId}_${isHost ? otherPlayer.playerId : state.playerId}`;
          
          // Invia un broadcast per avvisare l'avversario prima di uscire dal canale
          channel.send({
            type: 'broadcast',
            event: 'match_found',
            payload: { player1: state.playerId, player2: otherPlayer.playerId, roomId }
          }).then(() => {
            get().joinGameRoom(roomId, isHost);
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('In ricerca...');
          await channel.track({ playerId, status: 'searching' });
        }
      });
  },

  joinGameRoom: (roomId: string, isHost: boolean) => {
    const state = get();
    if (state.status !== 'searching') return;
    set({ status: 'joining', isHost });

    const { matchmakingChannel, gameChannel: existingGameChannel } = get();
    if (matchmakingChannel) {
      supabase.removeChannel(matchmakingChannel);
      set({ matchmakingChannel: null });
    }
    if (existingGameChannel) {
      supabase.removeChannel(existingGameChannel);
    }

    console.log(`Unione alla stanza ${roomId}. Host: ${isHost}`);
    const channel = supabase.channel(roomId, {
      config: { broadcast: { ack: true } }
    });
    set({ gameChannel: channel });
    
    let readyInterval: NodeJS.Timeout;

    channel
      .on('broadcast', { event: 'game_start' }, (payload) => {
        console.log('Partita iniziata!');
        if (readyInterval) clearInterval(readyInterval);
        set((state) => ({ 
          match: payload.payload.match, 
          status: 'playing', 
          timeLeft: 10, 
          correctAnswer: payload.payload.correctAnswer,
          correctAnswerSeasons: payload.payload.correctAnswerSeasons,
          roundStartTime: Date.now(),
          round: state.round + 1
        }));
      })
      .on('broadcast', { event: 'player_won' }, (payload) => {
        if (payload.payload.playerId !== get().playerId) {
          const newOpponentRoundsWon = get().opponentRoundsWon + 1;
          let nextStatus: GameState['status'] = 'opponent_won';
          if (newOpponentRoundsWon >= 2) {
            nextStatus = 'match_lost';
            useAuthStore.getState().updateProfileStats(false, get().score);
          }
          set({ 
            status: nextStatus, 
            opponentRoundsWon: newOpponentRoundsWon,
            streak: 0
          });
        }
      })
      .on('broadcast', { event: 'opponent_abandoned' }, (payload) => {
        if (payload.payload.playerId !== get().playerId) {
          useAuthStore.getState().updateProfileStats(true, get().score + 50);
          set({ 
            status: 'match_won', 
            playerRoundsWon: 2,
            streak: 0
          });
        }
      })
      .on('broadcast', { event: 'match_failed' }, () => {
        // L'host non è riuscito a generare il match
        get().resetGame();
        set({ errorMsg: 'Impossibile generare un match. Riprova o cambia campionato.' });
      })
      .on('broadcast', { event: 'guest_ready' }, () => {
        if (isHost) {
          const state = get();
          if (state.status === 'joining') {
            console.log('Guest pronto, recupero match...');
            set({ status: 'starting' });
            get().fetchMatchAndBroadcast();
          } else if (state.status === 'playing') {
            console.log('Guest pronto ma partita già iniziata, reinvio match...');
            channel.send({
              type: 'broadcast',
              event: 'game_start',
              payload: { match: state.match, correctAnswer: state.correctAnswer, correctAnswerSeasons: state.correctAnswerSeasons }
            });
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (!isHost) {
            console.log('Guest iscritto, invio guest_ready...');
            channel.send({ type: 'broadcast', event: 'guest_ready' });
            readyInterval = setInterval(() => {
              if (get().status !== 'playing') {
                console.log('Reinvio guest_ready...');
                channel.send({ type: 'broadcast', event: 'guest_ready' });
              } else {
                clearInterval(readyInterval);
              }
            }, 1000);
          } else {
            // Fallback per l'host nel caso il messaggio guest_ready vada perso
            setTimeout(() => {
              const state = get();
              if (state.status === 'joining') {
                console.log('Fallback host: recupero match...');
                set({ status: 'starting' });
                get().fetchMatchAndBroadcast();
              }
            }, 3000);
          }
        }
      });
  },

  fetchMatchAndBroadcast: async () => {
    try {
      let matchData: MatchData | null = null;
      let fetchedAnswer: string | null = null;
      let fetchedSeasons: { team1: number[], team2: number[] } | null = null;
      const { selectedLeague, selectedDifficulty, recentTeams } = get();

      // Implement timeout for RPC call
      const rpcPromise = supabase.rpc('get_random_match', {
        p_league_id: selectedLeague,
        p_recent_teams: recentTeams,
        p_difficulty: selectedDifficulty
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout RPC Supabase')), 8000)
      );

      const { data: rpcData, error: rpcError } = await Promise.race([rpcPromise, timeoutPromise]) as any;

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
        fetchedSeasons = {
          team1: m.team1_seasons || [],
          team2: m.team2_seasons || []
        };

        // Update recent teams to avoid picking them again soon
        const newRecentTeams = [...recentTeams, m.team1_id, m.team2_id].slice(-20); // Keep last 20 teams
        set({ recentTeams: newRecentTeams });
      } else {
        throw new Error('Nessun match valido trovato tramite RPC');
      }

      const { gameChannel, gameMode } = get();
      if (gameChannel && matchData && gameMode === 'pvp') {
        gameChannel.send({
          type: 'broadcast',
          event: 'game_start',
          payload: { match: matchData, correctAnswer: fetchedAnswer, correctAnswerSeasons: fetchedSeasons }
        });
      }

      set((state) => ({ 
        match: matchData, 
        timeLeft: gameMode === 'ai' ? 15 : 10, 
        status: 'playing', 
        correctAnswer: fetchedAnswer,
        correctAnswerSeasons: fetchedSeasons,
        roundStartTime: Date.now(),
        round: state.round + 1
      }));
    } catch (error) {
      console.error('Errore critico durante il fetch del match:', error);
      const { gameChannel, gameMode } = get();
      if (gameChannel && gameMode === 'pvp') {
        gameChannel.send({ type: 'broadcast', event: 'match_failed' });
      }
      get().resetGame();
      set({ errorMsg: 'Impossibile trovare un match. Riprova o cambia campionato.' });
    }
  },

  validatePlayer: async (playerName: string) => {
    const { match, gameChannel, playerId, gameMode } = get();
    if (!match) return false;

    let isCorrect = false;
    let rarity = 1.0;
    let realPlayerName = playerName;
    let teamASeasons: number[] = [];
    let teamBSeasons: number[] = [];

    try {
      const { data, error } = await supabase.rpc('validate_player_intersection', {
        team_a_id: match.team1_id,
        team_b_id: match.team2_id,
        input_name: playerName
      });

      if (error) throw error;

      // Handle both boolean return (old RPC), object return, and array of objects (from RETURNS TABLE)
      if (data === true) {
        isCorrect = true;
      } else if (Array.isArray(data) && data.length > 0 && data[0].valid) {
        isCorrect = true;
        rarity = 1.0 + (data[0].similarity_score || 0); // Use similarity as a small rarity boost
        realPlayerName = data[0].player_name || playerName;
        teamASeasons = data[0].team_a_seasons || [];
        teamBSeasons = data[0].team_b_seasons || [];
      } else if (data && !Array.isArray(data) && (data as any).is_valid) {
        isCorrect = true;
        rarity = (data as any).rarity_multiplier || 1.0;
        realPlayerName = (data as any).player_name || playerName;
        teamASeasons = (data as any).team_a_seasons || [];
        teamBSeasons = (data as any).team_b_seasons || [];
      }
    } catch (error) {
      console.warn('Errore RPC durante la validazione:', error);
    }

    if (isCorrect) {
      const timeTaken = (Date.now() - (get().roundStartTime || Date.now())) / 1000;
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
        correctAnswer: realPlayerName,
        correctAnswerSeasons: { team1: teamASeasons, team2: teamBSeasons }
      }));
      return true;
    } else {
      set({ streak: 0 });
      return false;
    }
  },

  tickTimer: () => {
    set((state) => {
      if (state.status !== 'playing') return state;
      const newTime = state.timeLeft - 1;
      if (newTime <= 0) {
        if (state.gameMode === 'ai') {
          useAuthStore.getState().updateProfileStats(false, state.score);
        }
        return { timeLeft: 0, status: 'lost', streak: 0 };
      }
      return { timeLeft: newTime };
    });
  },

  abandonMatch: () => {
    const { status, gameMode, gameChannel, playerId, score } = get();
    const isGameOver = status === 'match_won' || status === 'match_lost' || (status === 'lost' && gameMode === 'ai');
    
    if (!isGameOver) {
      if (gameMode === 'pvp') {
        if (gameChannel) {
          gameChannel.send({
            type: 'broadcast',
            event: 'opponent_abandoned',
            payload: { playerId }
          });
        }
        // Penalità di 50 punti per abbandono in PvP
        useAuthStore.getState().updateProfileStats(false, -50);
      } else if (gameMode === 'ai') {
        // Nessuna penalità extra per l'IA, solo i punti attuali
        useAuthStore.getState().updateProfileStats(false, score);
      }
    }
    
    get().resetGame();
  },

  resetGame: () => {
    const { gameChannel, matchmakingChannel, gameMode } = get();
    try {
      if (gameChannel) supabase.removeChannel(gameChannel);
      if (matchmakingChannel) supabase.removeChannel(matchmakingChannel);
    } catch (e) {
      console.error('Error removing channels:', e);
    }
    
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
      isHost: false
    });
  },

  setStatus: (status) => set({ status }),
}));
