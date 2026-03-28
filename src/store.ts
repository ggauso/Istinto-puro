import { create } from 'zustand';
import { supabase } from './lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuthStore } from './authStore';
import { saveMatchResult, getUserInfo, recordGameAudit, completeFriendChallenge, abandonFriendChallenge } from './lib/rpc-client';
import { calculateTier, generateGuestName } from './lib/game-utils';

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
  // Info avversario per feature di gioco
  opponent_id?: string;
  opponent_name?: string;
  opponent_tier?: string;
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
  
  isHost: boolean;
  round: number;
  playerRoundsWon: number;
  opponentRoundsWon: number;
  streak: number;
  roundStartTime: number | null;
  lastScoreAdded: number;
  lastRarity: number;
  lastCombo: number;

  // Info avversario per PvP
  opponentInfo: { nickname: string; tier: string } | null;

  // ID della sfida corrente (per completarla alla fine della partita)
  currentChallengeId: string | null;

  setGameMode: (mode: 'pvp' | 'ai') => void;
  setSelectedLeague: (leagueId: number | null) => void;
  setSelectedDifficulty: (difficulty: number) => void;
  findMatch: () => void;
  joinGameRoom: (roomId: string, isHost: boolean, opponentUserId?: string, opponentNicknameFromPresence?: string | null, challengeId?: string) => void;
  fetchMatchAndBroadcast: () => Promise<void>;
  validatePlayer: (playerName: string) => Promise<boolean>;
  tickTimer: () => void;
  abandonMatch: () => void;
  resetGame: () => void;
  setChallengeId: (id: string | null) => void;
  setStatus: (status: GameState['status']) => void;
  saveMatchResultToDb: (isWin: boolean, finalScore: number) => Promise<void>;
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

  setGameMode: (mode) => set({ gameMode: mode }),
  setSelectedLeague: (leagueId) => set({ selectedLeague: leagueId }),
  setSelectedDifficulty: (difficulty) => set({ selectedDifficulty: difficulty }),

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
        const { player1, player2, player1UserId, player2UserId, player1Nickname, player2Nickname, roomId } = payload.payload;
        const state = get();
        console.log('match_found broadcast - my playerId:', state.playerId, 'player1:', player1, 'player2:', player2, 'player1UserId:', player1UserId, 'player2UserId:', player2UserId);
        if (state.status === 'searching' && (state.playerId === player1 || state.playerId === player2)) {
          console.log('Match trovato via broadcast!');
          // If I am player1, opponent is player2
          // If I am player2, opponent is player1
          const isPlayer1 = state.playerId === player1;
          const opponentUserId = isPlayer1 ? player2UserId : player1UserId;
          const opponentNickname = isPlayer1 ? player2Nickname : player1Nickname;
          const isHost = state.playerId < (isPlayer1 ? player2 : player1);
          console.log('Calculated - isPlayer1:', isPlayer1, 'opponentUserId:', opponentUserId, 'opponentNickname:', opponentNickname, 'isHost:', isHost);
          get().joinGameRoom(roomId, isHost, opponentUserId, opponentNickname);
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
          console.log('Avversario trovato in presence!', otherPlayer.playerId, 'userId:', otherPlayer.userId, 'nickname:', otherPlayer.nickname);
          // Ordine deterministico per decidere chi è l'host
          const isHost = state.playerId < otherPlayer.playerId;
          const roomId = `room_${isHost ? state.playerId : otherPlayer.playerId}_${isHost ? otherPlayer.playerId : state.playerId}`;
          
          // Invia un broadcast per avvisare l'avversario prima di uscire dal canale
          const currentUser = useAuthStore.getState().user;
          const currentUserId = currentUser?.id || null;
          const currentNickname = currentUser?.nickname || currentUser?.first_name || null;
          channel.send({
            type: 'broadcast',
            event: 'match_found',
            payload: {
              player1: state.playerId,
              player2: otherPlayer.playerId,
              player1UserId: currentUserId,  // current player's userId
              player1Nickname: currentNickname,
              player2UserId: otherPlayer.userId,  // opponent's userId
              player2Nickname: otherPlayer.nickname || null,
              roomId
            }
          }).then(() => {
            get().joinGameRoom(roomId, isHost, otherPlayer.userId, otherPlayer.nickname || null);
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('In ricerca...');
          const { user } = useAuthStore.getState();
          await channel.track({
            playerId,
            userId: user?.id || null,
            nickname: user?.nickname || user?.first_name || null,
            status: 'searching'
          });
        }
      });
  },

  joinGameRoom: async (roomId: string, isHost: boolean, opponentUserId?: string, opponentNicknameFromPresence?: string | null) => {
    const state = get();
    if (state.status !== 'searching') return;

    const currentUser = useAuthStore.getState().user;
    console.log('joinGameRoom - myUserId:', currentUser?.id, 'opponentUserId:', opponentUserId, 'isHost:', isHost, 'opponentNicknameFromPresence:', opponentNicknameFromPresence);

    // Fetch opponent info if we have their user ID (logged-in PvP match)
    let opponentInfoFetched: { nickname: string; tier: string } | null = null;
    if (opponentUserId && state.gameMode === 'pvp') {
      console.log('Fetching opponent info from DB for:', opponentUserId);
      const { user: oppUser, success } = await getUserInfo(opponentUserId);
      console.log('getUserInfo result:', { success, fields: oppUser ? {nickname: oppUser.nickname, firstName: oppUser.firstName, lastName: oppUser.lastName} : null });
      if (oppUser) {
        opponentInfoFetched = {
          nickname: oppUser.nickname || oppUser.firstName || oppUser.lastName || opponentNicknameFromPresence || 'Avversario',
          tier: oppUser.tier || 'bronze'
        };
      } else {
        // Fallback: use nickname from presence
        console.log('getUserInfo failed, using fallback:', opponentNicknameFromPresence);
        const fallbackName = opponentNicknameFromPresence || `Giocatore ${Math.floor(Math.random() * 9000) + 1000}`;
        opponentInfoFetched = {
          nickname: fallbackName,
          tier: 'bronze'
        };
      }
    } else if (state.gameMode === 'pvp') {
      // Guest opponent - use nickname from presence or generate a name
      const guestName = opponentNicknameFromPresence || `Giocatore ${Math.floor(Math.random() * 9000) + 1000}`;
      opponentInfoFetched = {
        nickname: guestName,
        tier: 'bronze'
      };
    }

    console.log('Setting opponentInfo:', opponentInfoFetched);
    set({ status: 'joining', isHost, opponentInfo: opponentInfoFetched });

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
        const myUserId = useAuthStore.getState().user?.id || 'guest';
        console.log('=== GAME_START RECEIVED === myUserId:', myUserId);
        console.log('1. opponentInfo from store:', get().opponentInfo);
        if (readyInterval) clearInterval(readyInterval);
        const state = get();
        // Use local opponentInfo - already set correctly in joinGameRoom
        const incomingMatch = payload.payload.match || {};
        console.log('2. incomingMatch.opponent_name:', incomingMatch.opponent_name);
        const finalNickname = state.opponentInfo?.nickname || incomingMatch.opponent_name || 'Avversario';
        console.log('3. finalNickname chosen:', finalNickname, 'because state.opponentInfo:', state.opponentInfo?.nickname);
        const mergedMatch = {
          ...incomingMatch,
          opponent_name: finalNickname,
          opponent_tier: state.opponentInfo?.tier || incomingMatch.opponent_tier || 'bronze'
        };
        console.log('4. FINAL mergedMatch OPPONENT:', JSON.stringify({opponent_name: mergedMatch.opponent_name, opponent_tier: mergedMatch.opponent_tier}));
        set((state) => ({
          match: mergedMatch,
          status: 'playing',
          timeLeft: 10,
          correctAnswer: payload.payload.correctAnswer,
          correctAnswerSeasons: payload.payload.correctAnswerSeasons || null,
          roundStartTime: Date.now(),
          round: state.round + 1
        }));

        // Send acknowledgment back to host
        console.log('Sending game_start_ack to host...');
        channel.send({ type: 'broadcast', event: 'game_start_ack' });
      })
      .on('broadcast', { event: 'game_start_ack' }, (payload) => {
        console.log('Received game_start_ack from guest!');
        if (readyInterval) clearInterval(readyInterval);
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
      .on('broadcast', { event: 'guest_ready' }, () => {
        console.log('Received guest_ready, isHost:', isHost, 'current status:', get().status);
        if (isHost) {
          const state = get();
          if (state.status === 'joining') {
            console.log('Guest pronto, recupero match...');
            set({ status: 'starting' });
            console.log('Calling fetchMatchAndBroadcast...');
            get().fetchMatchAndBroadcast();
          } else if (state.status === 'playing') {
            console.log('Guest pronto ma partita già iniziata, reinvio match...');
            // Include opponent info in the payload
            const matchWithOpponent = {
              ...state.match,
              opponent_name: state.opponentInfo?.nickname || state.match?.opponent_name || 'Avversario',
              opponent_tier: state.opponentInfo?.tier || state.match?.opponent_tier || 'bronze'
            };
            console.log('Re-sending match with opponent:', matchWithOpponent?.opponent_name);
            channel.send({
              type: 'broadcast',
              event: 'game_start',
              payload: { match: matchWithOpponent, correctAnswer: state.correctAnswer, correctAnswerSeasons: state.correctAnswerSeasons }
            });
          }
        }
      })
      .subscribe(async (status, err) => {
        console.log('*** Game channel subscription status:', status, 'error:', err);
        // Don't auto-resubscribe - it causes conflicts with sending
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
          let sent = false;
          const sendGameStart = () => {
            console.log('Sending game_start with opponent info...');
            gameChannel.send({
              type: 'broadcast',
              event: 'game_start',
              payload: {
                match: matchDataWithOpponent,
                correctAnswer: fetchedAnswer,
                correctAnswerSeasons
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
          timeLeft: gameMode === 'ai' ? 15 : 10,
          status: 'playing',
          correctAnswer: fetchedAnswer,
          roundStartTime: Date.now(),
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
      } else if (data && !Array.isArray(data) && (data as any).is_valid) {
        isCorrect = true;
        rarity = (data as any).rarity_multiplier || 1.0;
        realPlayerName = (data as any).player_name || playerName;
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
        correctAnswer: realPlayerName
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
    const { status, gameMode, gameChannel, playerId, score, currentChallengeId } = get();
    const isGameOver = status === 'match_won' || status === 'match_lost' || (status === 'lost' && gameMode === 'ai');

    // Abbandona la sfida amichevole se presente
    if (currentChallengeId && gameMode === 'pvp') {
      abandonFriendChallenge(currentChallengeId).catch(err => console.error('Errore abbandono sfida amica:', err));
    }

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
      currentChallengeId: null
    });
  },

  setStatus: (status) => set({ status }),

  setChallengeId: (id: string | null) => set({ currentChallengeId: id }),

  saveMatchResultToDb: async (isWin: boolean, finalScore: number) => {
    const { match, gameMode, score, selectedDifficulty, currentChallengeId, isHost, playerRoundsWon, opponentRoundsWon } = get();
    const { user } = useAuthStore.getState();

    if (!user || !match) return;

    // Completa la sfida amichevole se presente
    if (currentChallengeId && gameMode === 'pvp') {
      const winnerId = isWin ? user.id : match.opponent_id;
      const creatorScore = isHost ? playerRoundsWon : opponentRoundsWon;
      const opponentScore = isHost ? opponentRoundsWon : playerRoundsWon;

      completeFriendChallenge(
        currentChallengeId,
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
      selectedDifficulty
    ).catch(err => console.error('Errore salvataggio risultato:', err));

    // Registra evento di audit per il gioco
    const eventType = isWin ? 'match_won' : 'match_lost';
    recordGameAudit(user.id, eventType, match.team1_id?.toString(), score, {
      opponent: opponentName,
      opponent_tier: opponentTier,
      game_mode: gameMode,
      difficulty: selectedDifficulty
    }).catch(err => console.error('Errore audit game:', err));
  },
}));
