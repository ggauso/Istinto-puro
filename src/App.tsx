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
import { getPendingFriendChallenges, acceptFriendChallenge } from './lib/rpc-client';

export default function App() {
  const { status } = useGameStore();
  const { initialize, loading } = useAuthStore();
  const [currentScreen, setCurrentScreen] = useState<'home' | 'auth' | 'profile' | 'leaderboard' | 'challenge'>('home');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [currentChallengeId, setCurrentChallengeId] = useState<string | null>(null);
  const [userLeftChallenge, setUserLeftChallenge] = useState(false);

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

  // Auto-clear toast after 6 seconds
  useEffect(() => {
    if (toastWithAction) {
      const timer = setTimeout(() => setToastWithAction(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toastWithAction]);

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
    difficulty?: number
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

    if (isHost) {
      // Host (challenge creator) joins immediately - they'll wait for challenger
      gameStore.joinGameRoom(roomId, isHost, opponentUserId, opponentNickname);

      // Set opponent info and challenge ID manually since we know it
      useGameStore.setState({
        opponentInfo: {
          nickname: opponentNickname,
          tier: opponentTier
        },
        currentChallengeId: challengeId || null
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
          currentChallengeId: challengeId || null
        });

        // Navigate to game screen
        setCurrentScreen('game');
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans selection:bg-[#FFD700] selection:text-black">
      {currentScreen === 'challenge' && challengeToken && (
        <ChallengeScreen
          token={challengeToken}
          onBack={() => {
            window.location.href = '/';
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
          onChallengeFriend={(friendId, friendName, friendTier) => {
            // Challenge is created in ProfileScreen, modal shows the link
            // This callback is for potential future use
            console.log('Challenge friend:', friendId, friendName, friendTier);
          }}
        />
      )}
      {currentScreen === 'leaderboard' && <LeaderboardScreen onBack={() => setCurrentScreen('home')} />}
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
            setCurrentScreen('profile');
          }}
          onNavigateToLeaderboard={() => {
            sessionStorage.removeItem('userLeftChallenge');
            sessionStorage.removeItem('lastChallengeRoomId');
            setUserLeftChallenge(false);
            setCurrentScreen('leaderboard');
          }}
        />
      )}

      {/* Global Toast Notification */}
      {toastWithAction && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className={`
            px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 min-w-[320px] max-w-md
            animate-slide-up
            ${toastWithAction.type === 'success' ? 'bg-green-600' :
              toastWithAction.type === 'error' ? 'bg-red-600' : 'bg-zinc-800 border border-yellow-500/30'}
          `}>
            <span className="flex-1 text-white text-sm font-medium">{toastWithAction.message}</span>

            {/* Friend Challenge Toast with Accept/Decline */}
            {toastWithAction.challengeId ? (
              <div className="flex gap-2">
                <button
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
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  Accetta
                </button>
                <button
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
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  Rifiuta
                </button>
              </div>
            ) : (
              // Regular Toast
              toastWithAction.action && toastWithAction.actionLabel && (
                <button
                  onClick={() => {
                    toastWithAction.action?.();
                    setToastWithAction(null);
                  }}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold rounded-lg transition-colors"
                >
                  {toastWithAction.actionLabel}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
