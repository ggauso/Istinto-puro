/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from './store';
import { useAuthStore } from './authStore';
import { supabase } from './lib/supabase';
import { HomeScreen } from './components/HomeScreen';
import { GameScreen } from './components/GameScreen';
import { AuthScreen } from './components/AuthScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { ChallengeScreen } from './components/ChallengeScreen';
import { TournamentsScreen } from './components/TournamentsScreen';
import { getPendingFriendChallenges, acceptFriendChallenge } from './lib/api/friend-challenges';
import { startDueTournaments } from './lib/api/tournaments';
import { useTournamentMatch } from './components/tournament/useTournamentMatch';
import type { AchievementCode } from './types/game';
import { ACHIEVEMENT_LABELS } from './types/game';
import { Award, X, Goal, BarChart3, Trophy, User } from 'lucide-react';
import { BottomNavBar } from './components/ui/BottomNavBar';
import { Toast } from './components/ui/Toast';
import { Button } from './components/ui/Button';

const NAV_ITEMS = [
  { key: 'home', label: 'Gioca', icon: <Goal className="h-5 w-5" /> },
  { key: 'leaderboard', label: 'Classifica', icon: <BarChart3 className="h-5 w-5" /> },
  { key: 'tournaments', label: 'Tornei', icon: <Trophy className="h-5 w-5" /> },
  { key: 'profile', label: 'Profilo', icon: <User className="h-5 w-5" /> },
] as const;

type NavScreen = (typeof NAV_ITEMS)[number]['key'];

// Chiave sessionStorage per i toast achievement in attesa di essere
// mostrati/chiusi esplicitamente — sopravvive al redirect a pagina intera
// (`window.location.href = '/'`) che GameScreen fa a fine partita, che
// altrimenti cancellerebbe il toast (e lo stato Zustand in memoria) prima
// che l'utente riesca a leggerlo. Vedi useEffect dedicato più sotto.
const PENDING_ACHIEVEMENT_TOASTS_KEY = 'pendingAchievementToasts';

function readPendingAchievementToasts(): AchievementCode[] {
  try {
    const raw = sessionStorage.getItem(PENDING_ACHIEVEMENT_TOASTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writePendingAchievementToasts(codes: AchievementCode[]): void {
  try {
    if (codes.length === 0) sessionStorage.removeItem(PENDING_ACHIEVEMENT_TOASTS_KEY);
    else sessionStorage.setItem(PENDING_ACHIEVEMENT_TOASTS_KEY, JSON.stringify(codes));
  } catch {
    // sessionStorage non disponibile: il toast resta comunque visibile per
    // questa sessione in memoria, solo non sopravvive a un reload.
  }
}

export default function App() {
  const { status, newlyUnlockedAchievements } = useGameStore();
  const { initialize, loading } = useAuthStore();
  const [currentScreen, setCurrentScreen] = useState<'home' | 'auth' | 'profile' | 'leaderboard' | 'challenge' | 'tournaments'>('home');
  const [profileInitialTab, setProfileInitialTab] = useState<'stats' | 'friends' | 'achievements' | 'history'>('stats');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [currentChallengeId, setCurrentChallengeId] = useState<string | null>(null);
  const [userLeftChallenge, setUserLeftChallenge] = useState(false);

  // Toast achievement (Milestone 8) — stato separato dal toastWithAction
  // generico sotto: quello è un'unica "slot" condivisa riusata da polling
  // sfide/tornei, e un evento di quel tipo poco dopo uno sblocco achievement
  // lo avrebbe sovrascritto/nascosto. Lazy init legge subito eventuali
  // sblocchi lasciati in sessionStorage da PRIMA del redirect a pagina
  // intera di fine partita (vedi commento sopra su PENDING_ACHIEVEMENT_TOASTS_KEY).
  const [pendingAchievementToasts, setPendingAchievementToasts] = useState<AchievementCode[]>(
    () => readPendingAchievementToasts()
  );

  // Global toast state
  const [toastWithAction, setToastWithAction] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    action?: () => void;
    actionLabel?: string;
    challengeId?: string;
    challengeRoomId?: string;
    challengeCreatorId?: string;
    challengeCreatorNickname?: string;
    challengeCreatorTier?: string;
  } | null>(null);

  // Global polling for friend challenges (every 30 seconds)
  const shownChallengesRef = useRef<Set<string>>(new Set());
  const { user } = useAuthStore();

  // Clear shown challenges when user changes
  useEffect(() => {
    shownChallengesRef.current.clear();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const pollFriendChallenges = async () => {
      try {
        // Skip if user explicitly left a challenge (to prevent re-redirect)
        if (userLeftChallenge) {
          return;
        }

        // Skip if we're already on a challenge page
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/sfida/')) {
          return;
        }

        // Get all pending challenges where user is the OPPONENT
        const result = await getPendingFriendChallenges();
        const challenges = result.challenges || [];
        const currentUserId = user.id;

        // Show toast for pending challenges where user is opponent and not yet shown
        for (const challenge of challenges) {
          if (challenge.opponent_id === currentUserId && !shownChallengesRef.current.has(challenge.id)) {
            shownChallengesRef.current.add(challenge.id);
            setToastWithAction({
              message: `${challenge.creator_nickname} ti ha sfidato!`,
              type: 'info',
              actionLabel: 'Accetta',
              challengeId: challenge.id,
              challengeRoomId: challenge.room_id,
              challengeCreatorId: challenge.creator_id,
              challengeCreatorNickname: challenge.creator_nickname,
              challengeCreatorTier: challenge.creator_tier
            });
            break;
          }
        }

        // Check if any of THIS user's created challenges have been accepted
        // Only redirect to challenges accepted in the LAST 2 minutes (to avoid old redirects)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: acceptedChallenges, error } = await supabase
          .from('friend_challenges')
          .select('id, room_id, opponent_id, updated_at')
          .eq('creator_id', user.id)
          .eq('status', 'accepted')
          .gte('updated_at', twoMinutesAgo)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (!error && acceptedChallenges && acceptedChallenges.length > 0) {
          const latestAccepted = acceptedChallenges[0];

          // Check if we've already processed this one
          if (!shownChallengesRef.current.has(`accepted_${latestAccepted.id}`)) {
            shownChallengesRef.current.add(`accepted_${latestAccepted.id}`);

            // Redirect to /sfida/room_id
            window.location.href = `/sfida/${latestAccepted.room_id}`;
          }
        }
      } catch (err) {
        console.error('Error polling friend challenges:', err);
      }
    };

    // Initial load
    pollFriendChallenges();

    // Poll every 10 seconds (shortened for faster response)
    const pollInterval = setInterval(pollFriendChallenges, 10000);
    return () => clearInterval(pollInterval);
  }, [user]);

  // Avvia i tornei schedulati la cui data/ora è arrivata. Nessun job
  // server-side (no pg_cron): un client loggato qualsiasi può far scattare
  // l'avvio chiamando questa RPC periodicamente, è idempotente.
  useEffect(() => {
    if (!user) return;

    const pollDueTournaments = () => {
      startDueTournaments().catch((err) => console.error('Error starting due tournaments:', err));
    };

    pollDueTournaments();
    const interval = setInterval(pollDueTournaments, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Auto-clear toast after 6 seconds
  useEffect(() => {
    if (toastWithAction) {
      const timer = setTimeout(() => setToastWithAction(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toastWithAction]);

  // Achievement appena sbloccati (Milestone 8), popolati dallo store di
  // gioco sia a fine partita (check server-truth) sia durante il round
  // (eventi momentanei "speed"/"perfect"/...) — vedi lifecycleSlice.ts e
  // gameplaySlice.ts. Li spostiamo subito in pendingAchievementToasts
  // (persistito in sessionStorage) e svuotiamo lo store, così anche se il
  // redirect a pagina intera di fine partita scatta un attimo dopo, il
  // toast riappare intatto sulla home invece di sparire silenziosamente.
  useEffect(() => {
    if (newlyUnlockedAchievements.length === 0) return;

    setPendingAchievementToasts((prev) => {
      const merged = [...prev, ...newlyUnlockedAchievements];
      writePendingAchievementToasts(merged);
      return merged;
    });

    useGameStore.getState().clearNewlyUnlockedAchievements();
  }, [newlyUnlockedAchievements]);

  const dismissAchievementToasts = () => {
    setPendingAchievementToasts([]);
    writePendingAchievementToasts([]);
  };

  useEffect(() => {
    initialize();

    // Check if URL is a challenge link (istintopuro.com/sfida/TOKEN)
    const path = window.location.pathname;
    if (path.startsWith('/sfida/')) {
      const token = path.replace('/sfida/', '');
      if (token && token.length >= 8) {
        setChallengeToken(token);
        setCurrentScreen('challenge');
      }
    }

    // Intercetta il callback del link di recupero password inviato da Supabase.
    // Quando l'utente clicca il link, Supabase emette PASSWORD_RECOVERY prima di autenticarlo.
    // In questo momento forziamo la schermata di reset invece di permettere l'accesso normale.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setCurrentScreen('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [initialize]);

  // Un match di torneo è già stato deciso dal bracket (nessun "accetta/rifiuta"):
  // appena il polling lo rileva pronto, naviga automaticamente alla partita.
  // NOTE: definita qui (prima degli "early return" sotto) perché usata dall'hook
  // useTournamentMatch subito dopo, che va chiamato incondizionatamente ad ogni
  // render (regole degli Hooks di React).
  const handleJoinTournamentMatch = (
    roomId: string,
    opponentUserId: string,
    opponentNickname: string,
    opponentTier: string,
    isHost: boolean,
    tournamentMatchId: string,
    leagueId?: number,
    difficulty?: number
  ) => {
    const gameStore = useGameStore.getState();
    gameStore.setGameMode('pvp');
    useGameStore.setState({
      status: 'searching',
      selectedLeague: leagueId || null,
      selectedDifficulty: difficulty || 1
    });

    gameStore.joinGameRoom(roomId, isHost, opponentUserId, opponentNickname);
    useGameStore.setState({
      opponentInfo: { nickname: opponentNickname, tier: opponentTier },
      currentTournamentMatchId: tournamentMatchId
    });
    setCurrentScreen('game');
  };

  // Polling globale (ovunque si trovi l'utente) per i match di torneo pronti
  useTournamentMatch(handleJoinTournamentMatch);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFD700]"></div>
      </div>
    );
  }

  // If game is active, show game screen
  if (status !== 'idle' && status !== 'searching') {
    return (
      <div className="min-h-screen bg-[#121212] text-white font-sans selection:bg-[#FFD700] selection:text-black">
        <GameScreen />
      </div>
    );
  }

  // Handle challenge acceptance - start the game
  // This is called when:
  // 1. Someone accepts a challenge link (they are the challenger) - isHost=false
  // 2. A challenge creator detects someone accepted their challenge - isHost=true
  const handleAcceptChallenge = (
    roomId: string,
    opponentUserId: string,
    opponentNickname: string,
    opponentTier: string,
    isHost: boolean = false,
    challengeId?: string,
    leagueId?: number,
    difficulty?: number,
    isFriendChallenge?: boolean
  ) => {
    // Get game store functions
    const gameStore = useGameStore.getState();

    // Set game mode to PvP
    gameStore.setGameMode('pvp');

    // Set league and difficulty from challenge if provided
    useGameStore.setState({
      status: 'searching',
      selectedLeague: leagueId || null,
      selectedDifficulty: difficulty || 1
    });

    // Sfide-link e sfide-amico scrivono in campi distinti dello store
    // (completate da due RPC diverse a fine partita, vedi GameScreen.tsx)
    const challengeIdFields = isFriendChallenge
      ? { currentFriendChallengeId: challengeId || null }
      : { currentChallengeId: challengeId || null };

    if (isHost) {
      // Host (challenge creator) joins immediately - they'll wait for challenger
      gameStore.joinGameRoom(roomId, isHost, opponentUserId, opponentNickname);

      // Set opponent info and challenge ID manually since we know it
      useGameStore.setState({
        opponentInfo: {
          nickname: opponentNickname,
          tier: opponentTier
        },
        ...challengeIdFields
      });

      // Navigate to game screen
      setCurrentScreen('game');
    } else {
      // Challenger (challenge acceptor) waits a bit before joining
      // This gives the host time to detect acceptance and join the room first
      setTimeout(() => {
        gameStore.joinGameRoom(roomId, isHost, opponentUserId, opponentNickname);

        // Set opponent info manually since we know it
        useGameStore.setState({
          opponentInfo: {
            nickname: opponentNickname,
            tier: opponentTier
          },
          ...challengeIdFields
        });

        // Navigate to game screen
        setCurrentScreen('game');
      }, 2000);
    }
  };

  // Stessa pulizia sessionStorage/stato già applicata dai bottoni di navigazione
  // di HomeScreen, riusata qui per la bottom nav persistente (Fase 2).
  const handleBottomNav = (key: NavScreen) => {
    sessionStorage.removeItem('userLeftChallenge');
    sessionStorage.removeItem('lastChallengeRoomId');
    setUserLeftChallenge(false);
    if (key === 'profile') setProfileInitialTab('stats');
    setCurrentScreen(key);
  };

  const showBottomNav = NAV_ITEMS.some((item) => item.key === currentScreen);

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans selection:bg-[#FFD700] selection:text-black">
      {currentScreen === 'challenge' && challengeToken && (
        <ChallengeScreen
          token={challengeToken}
          onBack={() => {
            // Use history API to change URL without reload, then navigate via React state
            window.history.pushState({}, '', '/');
            setCurrentScreen('home');
          }}
          onAcceptChallenge={handleAcceptChallenge}
        />
      )}
      {currentScreen === 'auth' && <AuthScreen
        onBack={() => setCurrentScreen('home')}
        isPasswordRecovery={isPasswordRecovery}
        onPasswordRecoveryDone={() => {
          setIsPasswordRecovery(false);
          setCurrentScreen('home');
        }}
      />}
      {currentScreen === 'profile' && (
        <ProfileScreen
          onBack={() => setCurrentScreen('home')}
          initialTab={profileInitialTab}
        />
      )}
      {currentScreen === 'leaderboard' && <LeaderboardScreen onBack={() => setCurrentScreen('home')} />}
      {currentScreen === 'tournaments' && <TournamentsScreen onBack={() => setCurrentScreen('home')} />}
      {currentScreen === 'home' && (
        <HomeScreen
          onNavigateToAuth={() => {
            sessionStorage.removeItem('userLeftChallenge');
            sessionStorage.removeItem('lastChallengeRoomId');
            setUserLeftChallenge(false);
            setCurrentScreen('auth');
          }}
          onNavigateToProfile={() => {
            sessionStorage.removeItem('userLeftChallenge');
            sessionStorage.removeItem('lastChallengeRoomId');
            setUserLeftChallenge(false);
            setProfileInitialTab('stats');
            setCurrentScreen('profile');
          }}
        />
      )}

      {showBottomNav && (
        <BottomNavBar items={NAV_ITEMS} active={currentScreen} onChange={handleBottomNav} />
      )}

      {/*
        Fase 4B: tutti i toast vivono in alto, sotto la safe area, impilati
        in un unico contenitore (invece di due posizioni fisse scoordinate
        top/bottom come prima) per non sovrapporsi quando entrambi sono
        visibili insieme.
      */}
      <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-3 px-4">
        {/* Toast Achievement (Milestone 8) — chiusura solo esplicita (nessun
            auto-dismiss): a differenza del toast generico sotto, questo
            sopravvive al redirect di fine partita (vedi sessionStorage sopra)
            e l'utente deve vederlo e chiuderlo di proposito, non sparire da
            solo mentre è ancora sulla schermata di vittoria/sconfitta.
            Contenuto multi-riga con 2 azioni: non entra nel primitivo
            `Toast` (pensato per 1 riga + 1 azione), resta una card dedicata
            ma con i token del design system al posto del gradiente oro/ambra
            originale. */}
        {pendingAchievementToasts.length > 0 && (
          <div className="toast pointer-events-auto flex min-w-[320px] max-w-md items-center gap-4 rounded-np-lg border border-[#F2C14E]/40 bg-[#2B2210] px-5 py-4 shadow-np-sheet">
            <Award className="h-8 w-8 shrink-0 text-[#FFE7A8]" />
            <div className="flex-1">
              <div className="text-sm font-bold text-[#FFE7A8]">
                {pendingAchievementToasts.length === 1
                  ? `Achievement sbloccato: ${ACHIEVEMENT_LABELS[pendingAchievementToasts[0]]}!`
                  : `${pendingAchievementToasts.length} achievement sbloccati!`}
              </div>
              {pendingAchievementToasts.length > 1 && (
                <div className="mt-0.5 text-xs text-[#FFE7A8]/80">
                  {pendingAchievementToasts.map((code) => ACHIEVEMENT_LABELS[code]).join(', ')}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setProfileInitialTab('achievements');
                setCurrentScreen('profile');
                dismissAchievementToasts();
              }}
              className="shrink-0 rounded-np-pill bg-white/10 px-3 py-1.5 text-xs font-bold text-[#FFE7A8] transition-colors hover:bg-white/20"
            >
              I miei achievement
            </button>
            <button
              onClick={dismissAchievementToasts}
              aria-label="Chiudi"
              className="shrink-0 text-[#FFE7A8]/70 transition-colors hover:text-[#FFE7A8]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Toast globale: sfida-amico (2 azioni, resta una pill dedicata) o conferma/errore/info a 1 azione (usa il primitivo `Toast`) */}
        {toastWithAction && (
          <div className="pointer-events-auto">
            {toastWithAction.challengeId ? (
              <div className="toast flex min-w-[320px] max-w-md items-center gap-4 rounded-np-pill bg-turf-2 px-5 py-3 shadow-np-sheet">
                <span className="flex-1 text-sm font-semibold">{toastWithAction.message}</span>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="volt"
                    size="sm"
                    onClick={async () => {
                      if (!toastWithAction.challengeId || !toastWithAction.challengeRoomId) return;
                      try {
                        const result = await acceptFriendChallenge(toastWithAction.challengeId);
                        if (result && result.success) {
                          // Accepted! Redirect to /sfida/room_id (BOTH players will go here)
                          window.location.href = `/sfida/${toastWithAction.challengeRoomId}`;
                        }
                      } catch (err) {
                        console.error('Error accepting challenge:', err);
                      }
                      setToastWithAction(null);
                    }}
                  >
                    Accetta
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (toastWithAction.challengeId) {
                        try {
                          await supabase.rpc('decline_friend_challenge', { p_challenge_id: toastWithAction.challengeId });
                          // TODO: Notify A that B declined
                        } catch (err) {
                          console.error('Error declining challenge:', err);
                        }
                      }
                      setToastWithAction(null);
                    }}
                  >
                    Rifiuta
                  </Button>
                </div>
              </div>
            ) : (
              <Toast
                tone={toastWithAction.type === 'success' ? 'success' : toastWithAction.type === 'error' ? 'error' : 'info'}
                message={toastWithAction.message}
                actionLabel={toastWithAction.action ? toastWithAction.actionLabel : undefined}
                onAction={() => {
                  toastWithAction.action?.();
                  setToastWithAction(null);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
