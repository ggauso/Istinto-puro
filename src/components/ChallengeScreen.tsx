/**
 * ChallengeScreen Component
 *
 * Pagina per gestire le sfide - sia per chi accetta che per chi crea
 * - URL: /sfida/TOKEN
 * - Se l'utente è il creatore: polling per rilevare accettazione
 * - Se l'utente è un visitatore: può accettare la sfida
 */

import { useChallenge } from './challenge/useChallenge';
import {
  ChallengeLoadingView,
  ChallengeErrorView,
  ChallengeExpiredView,
  ChallengeCreatorPendingView,
  ChallengeCreatorAcceptedView,
  ChallengeVisitorAcceptView,
} from './challenge/ChallengeViews';

interface ChallengeScreenProps {
  token: string;
  onBack: () => void;
  onAcceptChallenge: (roomId: string, opponentUserId: string, opponentNickname: string, opponentTier: string, isHost?: boolean, challengeId?: string, leagueId?: number, difficulty?: number, isFriendChallenge?: boolean) => void;
}

export function ChallengeScreen({ onBack, onAcceptChallenge, token }: ChallengeScreenProps) {
  const { user, challenge, loading, accepting, error, accepted, gameStarting, handleAccept, handleStartGame } =
    useChallenge(token, onAcceptChallenge, onBack);

  if (loading || gameStarting) {
    return <ChallengeLoadingView gameStarting={gameStarting} />;
  }

  if (error) {
    return <ChallengeErrorView message={error} onBack={onBack} />;
  }

  const isCreator = !!(user && challenge && challenge.creatorId && user.id === challenge.creatorId);

  if (challenge?.status === 'declined' || challenge?.status === 'expired') {
    return <ChallengeExpiredView onBack={onBack} />;
  }

  if (isCreator && challenge?.status === 'pending') {
    return <ChallengeCreatorPendingView challenge={challenge} token={token} onBack={onBack} />;
  }

  if (isCreator && challenge?.status === 'accepted' && challenge?.roomId && challenge?.opponentId) {
    return <ChallengeCreatorAcceptedView challenge={challenge} onBack={onBack} onStartGame={handleStartGame} />;
  }

  // Visitor accepting - show accept button (o messaggio se la sfida non è più valida)
  if (!challenge) {
    return <ChallengeErrorView message="Questa sfida non è più disponibile." onBack={onBack} />;
  }

  return (
    <ChallengeVisitorAcceptView
      challenge={challenge}
      hasUser={!!user}
      accepted={accepted}
      accepting={accepting}
      onBack={onBack}
      onAccept={handleAccept}
    />
  );
}

export default ChallengeScreen;
