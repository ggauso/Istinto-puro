import { useState } from 'react';
import { searchUsers, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend } from '../../lib/api/friends';
import { createFriendChallenge, acceptFriendChallenge, declineFriendChallenge } from '../../lib/api/friend-challenges';
import { formatRelativeTime } from '../../lib/game-utils';
import { ChallengeFriendModal, type ChallengeModalState } from './ChallengeFriendModal';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';
import { RowAvatar } from '../ui/ListRow';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmSheet } from '../ui/ConfirmSheet';
import { Toast } from '../ui/Toast';
import { appPath } from '../../lib/paths';
import { PitchSkeleton } from '../ui/loaders/PitchSkeleton';
import { Search, UserPlus, Check, X, Trash2, Users, Zap } from 'lucide-react';

interface ProfileFriendsTabProps {
  currentUserId: string | undefined;
  friendsTab: 'search' | 'friends' | 'requests' | 'challenges';
  setFriendsTab: (tab: 'search' | 'friends' | 'requests' | 'challenges') => void;
  friends: any[];
  friendRequests: any[];
  loadingFriends: boolean;
  pendingChallenges: any[];
  challengeHistory: any[];
  loadingChallenges: boolean;
  reloadFriends: () => void;
  reloadChallenges: () => void;
}

const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Facile', 2: 'Medio', 3: 'Difficile' };

export function ProfileFriendsTab({
  currentUserId,
  friendsTab,
  setFriendsTab,
  friends,
  friendRequests,
  loadingFriends,
  pendingChallenges,
  challengeHistory,
  loadingChallenges,
  reloadFriends,
  reloadChallenges,
}: ProfileFriendsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [challengeModal, setChallengeModal] = useState<ChallengeModalState | null>(null);
  const [creatingChallenge, setCreatingChallenge] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<{ friendId: string; name: string } | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const result = await searchUsers(searchQuery);
    if (result.success) setSearchResults(result.users);
    setSearching(false);
  }

  async function handleSendFriendRequest(userId: string) {
    const result = await sendFriendRequest(userId);
    if (result.success) {
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
    } else {
      showToast(result.error || "Errore nell'invio della richiesta", 'error');
    }
  }

  async function handleAcceptRequest(requestId: string) {
    const result = await acceptFriendRequest(requestId);
    if (result.success) reloadFriends();
  }

  async function handleRejectRequest(requestId: string) {
    await rejectFriendRequest(requestId);
    reloadFriends();
  }

  async function confirmRemoveFriend() {
    if (!confirmTarget) return;
    try {
      const result = await removeFriend(confirmTarget.friendId);
      if (result.success) {
        await reloadFriends();
        showToast('Amico rimosso con successo', 'success');
      } else {
        showToast(result.error || 'Errore nella rimozione', 'error');
      }
    } catch {
      showToast('Errore nella rimozione', 'error');
    }
    setConfirmTarget(null);
  }

  function handleChallengeFriend(friendId: string, friendName: string, friendTier: string) {
    setChallengeModal({ friendId, friendName, friendTier, difficulty: 1, league: 'seria_a' });
  }

  async function handleCreateFriendChallenge() {
    if (!challengeModal) return;
    setCreatingChallenge(true);
    const result = await createFriendChallenge(challengeModal.friendId, challengeModal.difficulty, challengeModal.league);
    if (result.success) {
      showToast("Sfida inviata! Attendine l'accettazione.", 'success');
      setChallengeModal(null);
      reloadChallenges();
    } else {
      showToast(result.error || "Errore nell'invio della sfida", 'error');
    }
    setCreatingChallenge(false);
  }

  async function handleAcceptFriendChallenge(challengeId: string) {
    const result = await acceptFriendChallenge(challengeId);
    if (result.success && result.roomId) {
      showToast('Sfida accettata! La partita sta per iniziare...', 'success');
      // Naviga alla sfida come fa il toast globale in App.tsx - senza questo
      // redirect l'utente resta bloccato sulla scheda profilo e la partita
      // non parte mai per lui (l'avversario/creatore non ha modo di saperlo).
      window.location.href = appPath(`/sfida/${result.roomId}`);
    } else {
      showToast(result.error || "Errore nell'accettazione della sfida", 'error');
    }
  }

  async function handleDeclineFriendChallenge(challengeId: string) {
    const result = await declineFriendChallenge(challengeId);
    if (result.success) {
      showToast('Sfida rifiutata', 'info');
      reloadChallenges();
    } else {
      showToast(result.error || 'Errore nel rifiuto della sfida', 'error');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        value={friendsTab}
        onChange={(v) => {
          setFriendsTab(v as typeof friendsTab);
          if (v === 'challenges') reloadChallenges();
        }}
        options={[
          { value: 'search', label: 'Cerca' },
          { value: 'friends', label: 'Amici', badge: friends.length > 0 ? friends.length : undefined },
          { value: 'requests', label: 'Richieste', badge: friendRequests.length > 0 ? friendRequests.length : undefined },
          { value: 'challenges', label: 'Sfide', badge: pendingChallenges.length > 0 ? pendingChallenges.length : undefined },
        ]}
      />

      {friendsTab === 'search' && (
        <div className="flex flex-col gap-3.5">
          <Field
            icon={<Search className="h-[18px] w-[18px]" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Cerca per nickname"
            containerClassName="h-14"
            suffix={
              <Button variant="icon-volt" onClick={handleSearch} loading={searching} aria-label="Cerca">
                <Search className="h-4 w-4" />
              </Button>
            }
          />
          {searchResults.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {searchResults.map((u) => (
                <div key={u.id} className="row-hover flex items-center gap-3 rounded-np-lg bg-turf-1 px-3 py-2.5">
                  <RowAvatar shape="circle" tone="neutral">
                    {(u.nickname || u.email?.split('@')[0] || '?').slice(0, 2).toUpperCase()}
                  </RowAvatar>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold">{u.nickname || u.email?.split('@')[0]}</span>
                    {u.tier && <span className="text-xs text-label">{u.tier}</span>}
                  </div>
                  <Button variant="icon-volt" onClick={() => handleSendFriendRequest(u.id)} aria-label="Invia richiesta">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : searchQuery && !searching ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="Nessun utente trovato" />
          ) : (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Trova i tuoi rivali"
              subtitle="Cerca un nickname e invia la richiesta d'amicizia."
            />
          )}
        </div>
      )}

      {friendsTab === 'friends' &&
        (loadingFriends ? (
          <PitchSkeleton rows={4} rowHeight={68} />
        ) : friends.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {friends.map((friend) => {
              const name = friend.nickname || friend.email?.split('@')[0] || 'Amico';
              return (
                <div key={friend.id} className="flex items-center gap-3 rounded-np-lg bg-turf-1 p-2.5">
                  <div className="relative shrink-0">
                    <RowAvatar shape="circle" tone="neutral">
                      {name.slice(0, 2).toUpperCase()}
                    </RowAvatar>
                    {/* `isOnline` è sempre `false` oggi (nessuna presence reale
                        implementata): il pallino compare solo se un giorno
                        diventa vero, non è finto. */}
                    {friend.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-turf-1 bg-volt" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold">{name}</span>
                    <span className="text-xs text-chalk-2">
                      {friend.tier && <span style={{ color: 'var(--tier-' + friend.tier + '-label)' }}>{friend.tier}</span>}
                      {friend.tier && friend.lastLogin && ' · '}
                      {friend.lastLogin && `attivo ${formatRelativeTime(friend.lastLogin)}`}
                    </span>
                  </div>
                  <Button variant="icon-ember" onClick={() => setConfirmTarget({ friendId: friend.friendId, name })} aria-label="Rimuovi amico">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="volt" size="sm" onClick={() => handleChallengeFriend(friend.friendId, name, friend.tier || 'bronze')}>
                    <Zap className="h-3.5 w-3.5" />
                    Sfida
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Users className="h-6 w-6" />} title="Non hai ancora amici" subtitle="Cerca utenti per aggiungerne!" />
        ))}

      {friendsTab === 'requests' &&
        (friendRequests.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {friendRequests.map((request) => {
              const name = request.nickname || request.email?.split('@')[0] || 'Utente';
              return (
                <div key={request.id} className="flex items-center gap-3 rounded-np-lg bg-turf-1 p-2.5">
                  <RowAvatar shape="circle" tone="volt">
                    {name.slice(0, 2).toUpperCase()}
                  </RowAvatar>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold">{name}</span>
                    <span className="text-xs text-chalk-2">Vuole essere tuo amico</span>
                  </div>
                  <Button variant="icon-neutral" onClick={() => handleRejectRequest(request.id)} aria-label="Rifiuta">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button variant="icon-volt" onClick={() => handleAcceptRequest(request.id)} aria-label="Accetta">
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<UserPlus className="h-6 w-6" />} title="Nessuna richiesta" subtitle="Le richieste d'amicizia arriveranno qui." />
        ))}

      {friendsTab === 'challenges' && (
        <div className="flex flex-col gap-4">
          {loadingChallenges ? (
            <PitchSkeleton rows={3} rowHeight={68} />
          ) : pendingChallenges.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {pendingChallenges.map((challenge) => {
                const isCreator = challenge.creator_id === currentUserId;
                const name = isCreator ? challenge.opponent_nickname : challenge.creator_nickname;
                return (
                  <div key={challenge.id} className="flex items-center gap-3 rounded-np-lg bg-turf-1 p-3">
                    <RowAvatar shape="circle" tone="ember">
                      {(name || '?').slice(0, 2).toUpperCase()}
                    </RowAvatar>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="text-sm font-semibold">{name}</span>
                      <span className="mono text-[11px] text-label">
                        {DIFFICULTY_LABELS[challenge.difficulty] || challenge.difficulty} · {challenge.league.toUpperCase()}
                      </span>
                    </div>
                    {isCreator ? (
                      <span className="cond text-xs text-[#FFD36E]">In attesa...</span>
                    ) : (
                      <>
                        <Button variant="icon-neutral" onClick={() => handleDeclineFriendChallenge(challenge.id)} aria-label="Rifiuta">
                          <X className="h-4 w-4" />
                        </Button>
                        <Button variant="icon-volt" onClick={() => handleAcceptFriendChallenge(challenge.id)} aria-label="Accetta">
                          <Check className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-np-lg border-[1.5px] border-dashed border-white/[.12] p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-np-sm bg-volt/10 text-volt">
                <Zap className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">Nessuna sfida in attesa</span>
                <span className="text-xs text-chalk-2">Lancia tu la prossima</span>
              </div>
            </div>
          )}

          {challengeHistory.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="cond text-xs text-label">Giocate</span>
                <span className="mono text-[11px] text-label">{challengeHistory.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {challengeHistory.map((challenge) => {
                  const isWinner = challenge.result === 'creator_won';
                  const isDraw = challenge.result === 'abandoned';
                  return (
                    <div key={challenge.id} className="flex items-center gap-3 rounded-np-lg bg-turf-1 px-3.5 py-2.5">
                      <RowAvatar shape="circle" tone="neutral">
                        {(challenge.opponent_nickname || '?').slice(0, 2).toUpperCase()}
                      </RowAvatar>
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-sm font-semibold">{challenge.opponent_nickname}</span>
                        <span className="mono text-[11px] text-label">
                          {DIFFICULTY_LABELS[challenge.difficulty] || challenge.difficulty} · {challenge.league.toUpperCase()}
                        </span>
                      </div>
                      <span className="cond text-xs" style={{ color: isDraw ? 'var(--color-label)' : isWinner ? 'var(--color-volt)' : 'var(--color-ember-light)' }}>
                        {isDraw ? 'Abbandonata' : isWinner ? 'Vittoria' : 'Sconfitta'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmSheet
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        avatarInitial={(confirmTarget?.name || '?').slice(0, 2).toUpperCase()}
        title={`Rimuovere ${confirmTarget?.name}?`}
        description="Le sfide giocate restano nello storico."
        confirmLabel="Rimuovi amico"
        confirmIcon={<Trash2 className="h-4 w-4" />}
        onConfirm={confirmRemoveFriend}
      />

      {challengeModal && (
        <ChallengeFriendModal
          challengeModal={challengeModal}
          creatingChallenge={creatingChallenge}
          onChange={setChallengeModal}
          onCancel={() => setChallengeModal(null)}
          onSubmit={handleCreateFriendChallenge}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto">
            <Toast tone={toast.type === 'success' ? 'success' : toast.type === 'error' ? 'error' : 'info'} message={toast.message} />
          </div>
        </div>
      )}
    </div>
  );
}
