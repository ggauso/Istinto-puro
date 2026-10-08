import { StateCreator } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../authStore';
import { getUserInfo } from '../lib/api/profile';
import { GameState, MatchmakingSlice, getRemainingSeconds } from './types';

const generateId = () => Math.random().toString(36).substring(2, 10);

export const createMatchmakingSlice: StateCreator<GameState, [], [], MatchmakingSlice> = (set, get) => ({
  playerId: generateId(),
  matchmakingChannel: null,

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
          const currentNickname = useAuthStore.getState().profile?.nickname || null;
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
            nickname: useAuthStore.getState().profile?.nickname || null,
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
      console.log('getUserInfo result:', { success, fields: oppUser ? {nickname: oppUser.nickname} : null });
      if (oppUser) {
        opponentInfoFetched = {
          nickname: oppUser.nickname || opponentNicknameFromPresence || 'Avversario',
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
        // Usa il roundStartTime inviato dall'host (non Date.now() locale) così
        // il countdown del guest è allineato a quello dell'host invece di
        // partire in ritardo per via della latenza di rete del broadcast.
        const hostRoundStartTime: number = payload.payload.roundStartTime || Date.now();
        set((state) => ({
          match: mergedMatch,
          status: 'playing',
          timeLeft: getRemainingSeconds(state.gameMode, hostRoundStartTime, state.selectedDifficulty),
          correctAnswer: payload.payload.correctAnswer,
          correctAnswerSeasons: payload.payload.correctAnswerSeasons || null,
          roundStartTime: hostRoundStartTime,
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
              payload: {
                match: matchWithOpponent,
                correctAnswer: state.correctAnswer,
                correctAnswerSeasons: state.correctAnswerSeasons,
                roundStartTime: state.roundStartTime
              }
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
});
