import { useEffect, useRef, useState } from 'react';
import { getChallengeByToken, acceptChallenge } from '../../lib/api/challenges';
import { acceptFriendChallenge, getFriendChallengeByRoomId, LEAGUE_TEXT_TO_ID } from '../../lib/api/friend-challenges';
import { useAuthStore } from '../../authStore';
import { useGameStore } from '../../store';

export interface ChallengeViewState {
  id: string;
  creatorId: string;
  creatorName: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  roomId: string | null;
  opponentId: string | null;
  opponentName: string | null;
  opponentTier: string | null;
  difficulty?: number;
  league?: string;
}

type OnAcceptChallenge = (roomId: string, opponentUserId: string, opponentNickname: string, opponentTier: string, isHost?: boolean, challengeId?: string, leagueId?: number, difficulty?: number, isFriendChallenge?: boolean) => void;

/**
 * Carica e gestisce una sfida (espressa via link pubblico, o tra amici) identificata da `token`.
 * Un token che inizia con "friend_" è una sfida tra amici (route condivisa: /sfida/TOKEN).
 */
export function useChallenge(token: string, onAcceptChallenge: OnAcceptChallenge, onBack: () => void) {
  const { user, loading: authLoading } = useAuthStore();
  const { setGameMode } = useGameStore();

  const [challenge, setChallenge] = useState<ChallengeViewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [isFriendChallenge, setIsFriendChallenge] = useState(false);
  const [friendChallengeId, setFriendChallengeId] = useState<string | null>(null);
  const [gameStarting, setGameStarting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token non valido');
      setLoading(false);
      return;
    }

    // Attendiamo che l'autenticazione sia inizializzata prima di caricare la
    // sfida: per le sfide tra amici, isHost viene calcolato da `user.id` qui
    // sotto, e questa pagina viene raggiunta quasi sempre con un reload
    // completo del browser (window.location.href), dove `user` parte nullo
    // finché useAuthStore.initialize() non finisce. Caricare la sfida prima
    // porta a calcolare isHost=false per entrambi i giocatori (bug di pairing).
    if (authLoading) return;

    loadChallenge();
    // NOTE: Il polling è nella HomeScreen - qui mostriamo solo lo stato attuale
    // L'utente viene reindirizzato qui quando qualcuno accetta la sfida
  }, [token, authLoading]);

  async function loadChallenge() {
    setLoading(true);

    // Check if this is a friend challenge (token starts with "friend_")
    if (token.startsWith('friend_')) {
      const friendResult = await getFriendChallengeByRoomId(token);

      if (!friendResult.success || !friendResult.challenge) {
        setError('Sfida non trovata o scaduta.');
        setLoading(false);
        return;
      }

      const fc = friendResult.challenge;

      setIsFriendChallenge(true);
      setFriendChallengeId(fc.id);

      // Friend challenge is already finished - don't allow re-entry
      if (fc.status === 'completed' || fc.status === 'abandoned' || fc.status === 'expired') {
        setChallenge({
          id: fc.id,
          creatorId: fc.creator_id,
          creatorName: fc.creator_nickname,
          status: fc.status,
          createdAt: fc.created_at,
          expiresAt: fc.created_at,
          roomId: null,
          opponentId: null,
          opponentName: null,
          opponentTier: null
        });
        setLoading(false);
        return;
      }

      // Friend challenge is 'accepted' - start the game for both
      if (fc.status === 'accepted') {
        const isHost = user?.id === fc.creator_id;
        const opponentUserId = isHost ? fc.opponent_id : fc.creator_id;
        const opponentNickname = isHost ? fc.opponent_nickname : fc.creator_nickname;
        const opponentTier = isHost ? fc.opponent_tier : fc.creator_tier;

        const leagueId = fc.league ? LEAGUE_TEXT_TO_ID[fc.league] : null;

        // Mark game as starting and DON'T set loading to false to avoid flash
        setGameStarting(true);

        setGameMode('pvp');
        useGameStore.setState({ status: 'searching' });
        onAcceptChallenge(fc.room_id, opponentUserId, opponentNickname, opponentTier, isHost, fc.id, leagueId || undefined, fc.difficulty, true);
        // Don't return here - let the component stay in loading state until navigation happens
      }

      // Friend challenge is 'pending' - show waiting screen for creator, accept for opponent
      setChallenge({
        id: fc.id,
        creatorId: fc.creator_id,
        creatorName: fc.creator_nickname,
        status: fc.status,
        createdAt: fc.created_at,
        expiresAt: fc.created_at,
        roomId: fc.room_id,
        opponentId: fc.opponent_id,
        opponentName: fc.opponent_nickname,
        opponentTier: fc.opponent_tier,
        difficulty: fc.difficulty,
        league: fc.league
      });
      setLoading(false);
      return;
    }

    // Express challenge (old format)
    const result = await getChallengeByToken(token);

    // Challenge not found (completed/expired OR never existed) - show error
    if (result.error || !result.id) {
      setError('Questa sfida non è più disponibile. La partita è già terminata o il link è scaduto.');
      setLoading(false);
      return;
    }

    // Challenge is already finished - don't allow re-entry
    if (result.status === 'expired' || result.status === 'completed') {
      setChallenge({
        id: result.id,
        creatorId: result.creatorId!,
        creatorName: result.creatorName!,
        status: result.status,
        createdAt: result.createdAt!,
        expiresAt: result.expiresAt!,
        roomId: null,
        opponentId: null,
        opponentName: null,
        opponentTier: null
      });
      setLoading(false);
      return;
    }

    // Challenge is 'accepted' - user can start the game
    if (result.status === 'accepted') {
      setChallenge({
        id: result.id,
        creatorId: result.creatorId!,
        creatorName: result.creatorName!,
        status: 'accepted',
        createdAt: result.createdAt!,
        expiresAt: result.expiresAt!,
        roomId: result.roomId,
        opponentId: result.opponentId,
        opponentName: result.opponentName,
        opponentTier: result.opponentTier
      });
    } else {
      // Status is 'pending' - show waiting screen
      setChallenge({
        id: result.id,
        creatorId: result.creatorId!,
        creatorName: result.creatorName!,
        status: result.status!,
        createdAt: result.createdAt!,
        expiresAt: result.expiresAt!,
        roomId: null,
        opponentId: null,
        opponentName: null,
        opponentTier: null
      });
    }
    setLoading(false);
  }

  async function handleAccept() {
    if (!user) {
      onBack();
      return;
    }

    setAccepting(true);

    // Handle friend challenge acceptance differently
    if (isFriendChallenge && friendChallengeId) {
      const result = await acceptFriendChallenge(friendChallengeId);

      if (result && result.success) {
        setAccepted(true);
        setGameMode('pvp');
        // Redirect to the same URL - the loadChallenge will detect status is 'accepted' and start game
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(result?.error || 'Errore nell\'accettazione della sfida');
      }
      setAccepting(false);
      return;
    }

    // Express challenge acceptance
    const result = await acceptChallenge(token);

    if (result.success && result.roomId) {
      setAccepted(true);
      setGameMode('pvp');
      setTimeout(() => {
        onAcceptChallenge(
          result.roomId!,
          result.creatorId || '',
          result.creatorNickname || 'Sfidante',
          result.creatorTier || 'bronze',
          false, // isHost = false for challenger
          result.challengeId || undefined
        );
      }, 1500);
    } else {
      setError(result.message);
    }
    setAccepting(false);
  }

  function handleStartGame() {
    if (!challenge || !challenge.roomId || !challenge.opponentId) return;

    setGameMode('pvp');
    onAcceptChallenge(
      challenge.roomId,
      challenge.opponentId,
      challenge.opponentName || 'Sfidante',
      challenge.opponentTier || 'bronze',
      true, // isHost = true for creator
      challenge.id
    );
  }

  return {
    user,
    challenge,
    loading,
    accepting,
    error,
    accepted,
    gameStarting,
    handleAccept,
    handleStartGame,
  };
}
