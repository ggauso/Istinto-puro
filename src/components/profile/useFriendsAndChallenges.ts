import { useEffect, useRef, useState } from 'react';
import { getFriends, getPendingFriendRequests } from '../../lib/api/friends';
import { getPendingFriendChallenges, getFriendChallengeHistory } from '../../lib/api/friend-challenges';

export interface ToastWithAction {
  message: string;
  type: 'success' | 'error' | 'info';
  action?: () => void;
  actionLabel?: string;
}

/**
 * Carica amici, richieste di amicizia e sfide tra amici, con polling periodico
 * per notificare l'utente di novità anche mentre non è sulla scheda "Amici".
 *
 * Il polling gira sempre (non è legato al tab attivo) per preservare la
 * notifica cross-tab già presente nell'app.
 */
export function useFriendsAndChallenges(userId: string | undefined, onNavigateToFriendsSubTab: (tab: 'requests' | 'challenges') => void) {
  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const [pendingChallenges, setPendingChallenges] = useState<any[]>([]);
  const [challengeHistory, setChallengeHistory] = useState<any[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);

  const [toastWithAction, setToastWithAction] = useState<ToastWithAction | null>(null);

  const previousRequestsCountRef = useRef(0);
  const previousOpponentChallengesCountRef = useRef(0);

  async function reloadFriends() {
    setLoadingFriends(true);
    try {
      const [friendsResult, requestsResult] = await Promise.all([
        getFriends(),
        getPendingFriendRequests()
      ]);
      if (friendsResult.success) setFriends(friendsResult.friends);
      if (requestsResult.success) setFriendRequests(requestsResult.requests);
    } catch (err) {
      console.error('Error loading friends data:', err);
    }
    setLoadingFriends(false);
  }

  async function reloadChallenges() {
    setLoadingChallenges(true);
    try {
      const [pendingResult, historyResult] = await Promise.all([
        getPendingFriendChallenges(),
        getFriendChallengeHistory()
      ]);
      if (pendingResult.success) setPendingChallenges(pendingResult.challenges);
      if (historyResult.success) setChallengeHistory(historyResult.history);
    } catch (err) {
      console.error('Error loading challenges:', err);
    }
    setLoadingChallenges(false);
  }

  // Load friends and requests on mount
  useEffect(() => {
    if (!userId) return;
    reloadFriends();
  }, [userId]);

  // Auto-clear toastWithAction after 6 seconds (longer to allow user to click)
  useEffect(() => {
    if (toastWithAction) {
      const timer = setTimeout(() => setToastWithAction(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toastWithAction]);

  // Polling for friend requests (every 5 minutes)
  useEffect(() => {
    if (!userId) return;
    const pollInterval = setInterval(async () => {
      const prevCount = previousRequestsCountRef.current;
      await reloadFriends();
      const newCount = friendRequests.length;
      if (newCount > prevCount) {
        const addedCount = newCount - prevCount;
        setToastWithAction({
          message: `Hai ${addedCount} nuova${addedCount > 1 ? 'e' : ''} richiesta${addedCount > 1 ? 'e' : ''} di amicizia!`,
          type: 'info',
          action: () => onNavigateToFriendsSubTab('requests'),
          actionLabel: 'Vedi Richieste'
        });
      }
      previousRequestsCountRef.current = newCount;
    }, 300000); // 5 minutes
    return () => clearInterval(pollInterval);
  }, [userId]);

  // Polling for friend challenges (every 30 seconds)
  useEffect(() => {
    if (!userId) return;
    const pollInterval = setInterval(async () => {
      await reloadChallenges();
      // Only count challenges where user is the OPPONENT (received challenges)
      const opponentChallenges = pendingChallenges.filter(c => c.opponent_id === userId);
      const prevCount = previousOpponentChallengesCountRef.current;
      const newCount = opponentChallenges.length;
      if (newCount > prevCount) {
        const addedCount = newCount - prevCount;
        setToastWithAction({
          message: `Hai ${addedCount} nuova${addedCount > 1 ? 'e' : ''} sfida${addedCount > 1 ? 'e' : ''} da amico${addedCount > 1 ? 'i' : ''}!`,
          type: 'info',
          action: () => onNavigateToFriendsSubTab('challenges'),
          actionLabel: 'Vedi Sfide'
        });
      }
      previousOpponentChallengesCountRef.current = newCount;
    }, 30000); // 30 seconds
    return () => clearInterval(pollInterval);
  }, [userId, pendingChallenges.length]);

  return {
    friends,
    friendRequests,
    loadingFriends,
    pendingChallenges,
    challengeHistory,
    loadingChallenges,
    toastWithAction,
    dismissToastWithAction: () => setToastWithAction(null),
    reloadFriends,
    reloadChallenges,
  };
}
