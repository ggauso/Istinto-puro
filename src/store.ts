import { create } from 'zustand';
import { supabase } from './lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  status: 'idle' | 'searching' | 'joining' | 'starting' | 'playing' | 'won' | 'lost' | 'opponent_won';
  gameChannel: RealtimeChannel | null;
  matchmakingChannel: RealtimeChannel | null;
  selectedLeague: number | null;
  gameMode: 'pvp' | 'ai';
  correctAnswer: string | null;
  
  setGameMode: (mode: 'pvp' | 'ai') => void;
  setSelectedLeague: (leagueId: number | null) => void;
  findMatch: () => void;
  joinGameRoom: (roomId: string, isHost: boolean) => void;
  fetchMatchAndBroadcast: () => Promise<void>;
  validatePlayer: (playerName: string) => Promise<boolean>;
  tickTimer: () => void;
  resetGame: () => void;
  setStatus: (status: GameState['status']) => void;
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
  gameMode: 'pvp',
  correctAnswer: null,

  setGameMode: (mode) => set({ gameMode: mode }),
  setSelectedLeague: (leagueId) => set({ selectedLeague: leagueId }),

  findMatch: () => {
    const { gameMode } = get();
    
    if (gameMode === 'ai') {
      set({ status: 'starting' });
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
    set({ status: 'joining' });

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
        set({ match: payload.payload.match, status: 'playing', timeLeft: 10, correctAnswer: payload.payload.correctAnswer });
      })
      .on('broadcast', { event: 'player_won' }, (payload) => {
        if (payload.payload.playerId !== get().playerId) {
          set({ status: 'opponent_won' });
        }
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
              payload: { match: state.match }
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
      const { selectedLeague } = get();

      try {
        let validTeamIds: number[] | null = null;
        let teamToLeague: Record<number, number> = {};
        
        const { data: allTeamsData, error: allTeamsError } = await supabase
          .from('teams')
          .select('id, league_id');
          
        if (!allTeamsError && allTeamsData) {
          allTeamsData.forEach(t => {
            teamToLeague[t.id] = t.league_id;
          });
          if (selectedLeague) {
            validTeamIds = allTeamsData.filter(t => t.league_id === selectedLeague).map(t => t.id);
          }
        }

        // Fetch all player_teams to find a valid pair
        const { data: ptData, error: ptError } = await supabase
          .from('player_teams')
          .select('player_id, team_id');
          
        if (ptError) throw ptError;

        // Group by player_id
        const playerToTeams: Record<number, number[]> = {};
        (ptData || []).forEach((pt) => {
          if (!validTeamIds || validTeamIds.includes(pt.team_id)) {
            if (!playerToTeams[pt.player_id]) playerToTeams[pt.player_id] = [];
            playerToTeams[pt.player_id].push(pt.team_id);
          }
        });

        // Find players with at least 2 teams
        const validPlayers = Object.keys(playerToTeams).filter(
          (pid) => playerToTeams[Number(pid)].length >= 2
        );

        if (validPlayers.length > 0) {
          // Pick a random player
          const randomPlayerId = Number(validPlayers[Math.floor(Math.random() * validPlayers.length)]);
          const teamsForPlayer = playerToTeams[randomPlayerId];

          // Pick 2 random teams from this player's history
          const shuffledTeams = teamsForPlayer.sort(() => 0.5 - Math.random());
          let team1Id = shuffledTeams[0];
          let team2Id = shuffledTeams[1];

          // In "Tutti i Campionati" mode, try to pick teams from different leagues to mix it up
          if (!selectedLeague) {
            const t1League = teamToLeague[team1Id];
            const differentLeagueTeam = shuffledTeams.find(t => teamToLeague[t] !== t1League);
            if (differentLeagueTeam) {
              team2Id = differentLeagueTeam;
            }
          }

          // Fetch team details
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select('*')
            .in('id', [team1Id, team2Id]);

          if (teamsError || !teamsData || teamsData.length < 2) throw teamsError;

          const t1 = teamsData.find(t => t.id === team1Id)!;
          const t2 = teamsData.find(t => t.id === team2Id)!;

          matchData = {
            team1_id: t1.id,
            team1_name: t1.name,
            team1_logo: t1.logo_url,
            team2_id: t2.id,
            team2_name: t2.name,
            team2_logo: t2.logo_url,
          };

          // Fetch the player's name for the correct answer
          const { data: playerData } = await supabase
            .from('players')
            .select('name')
            .eq('id', randomPlayerId)
            .single();
            
          if (playerData) {
            fetchedAnswer = playerData.name;
          }
        } else {
          throw new Error('Nessun match valido trovato nel database');
        }
      } catch (dbError) {
        console.warn('Database vuoto o errore RLS, uso dati di fallback:', dbError);
        // Fallback data if DB is empty so we can still test multiplayer
        matchData = {
          team1_id: 496,
          team1_name: 'Juventus',
          team1_logo: 'https://media.api-sports.io/football/teams/496.png',
          team2_id: 505,
          team2_name: 'Inter',
          team2_logo: 'https://media.api-sports.io/football/teams/505.png',
        };
        fetchedAnswer = 'Zlatan Ibrahimovic';
      }

      const { gameChannel, gameMode } = get();
      if (gameChannel && matchData && gameMode === 'pvp') {
        gameChannel.send({
          type: 'broadcast',
          event: 'game_start',
          payload: { match: matchData, correctAnswer: fetchedAnswer }
        });
      }

      set((state) => ({ 
        match: matchData, 
        timeLeft: gameMode === 'ai' ? 15 : 10, 
        status: 'playing', 
        correctAnswer: fetchedAnswer 
      }));
    } catch (error) {
      console.error('Errore critico durante il fetch del match:', error);
    }
  },

  validatePlayer: async (playerName: string) => {
    const { match, gameChannel, playerId, gameMode } = get();
    if (!match) return false;

    let isCorrect = false;

    try {
      const { data, error } = await supabase.rpc('validate_player_intersection', {
        team_a_id: match.team1_id,
        team_b_id: match.team2_id,
        input_name: playerName
      });

      if (error) throw error;
      isCorrect = data === true;
    } catch (error) {
      console.warn('Errore RPC (forse non esiste ancora), uso fallback:', error);
      // Fallback validation for testing
      if (match.team1_name === 'Juventus' && match.team2_name === 'Inter') {
        const validNames = ['ibrahimovic', 'baggio', 'pirlo', 'cannavaro', 'vidal', 'cancelo', 'seedorf', 'vieri'];
        isCorrect = validNames.some(n => playerName.toLowerCase().includes(n));
      }
    }

    if (isCorrect) {
      if (gameChannel && gameMode === 'pvp') {
        gameChannel.send({
          type: 'broadcast',
          event: 'player_won',
          payload: { playerId }
        });
      }
      set((state) => ({ score: state.score + 1, status: 'won' }));
      return true;
    } else {
      return false;
    }
  },

  tickTimer: () => {
    set((state) => {
      if (state.status !== 'playing') return state;
      const newTime = state.timeLeft - 1;
      if (newTime <= 0) {
        return { timeLeft: 0, status: 'lost' };
      }
      return { timeLeft: newTime };
    });
  },

  resetGame: () => {
    const { gameChannel, matchmakingChannel, gameMode } = get();
    if (gameChannel) supabase.removeChannel(gameChannel);
    if (matchmakingChannel) supabase.removeChannel(matchmakingChannel);
    
    set({ status: 'idle', score: 0, timeLeft: gameMode === 'ai' ? 15 : 10, match: null, gameChannel: null, matchmakingChannel: null });
  },

  setStatus: (status) => set({ status }),
}));
