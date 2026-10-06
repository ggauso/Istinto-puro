import { useState } from 'react';
import { searchUsers, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend } from '../../lib/api/friends';
import { createFriendChallenge, acceptFriendChallenge, declineFriendChallenge } from '../../lib/api/friend-challenges';
import { formatRelativeTime } from '../../lib/game-utils';
import { ChallengeFriendModal, type ChallengeModalState } from './ChallengeFriendModal';
import { ConfirmDialog } from './ConfirmDialog';
import { Search, UserPlus, Check, X, Trash2, Users, Loader2, Zap, User, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

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

  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

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
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } else {
      showToast(result.error || 'Errore nell\'invio della richiesta', 'error');
    }
  }

  async function handleAcceptRequest(requestId: string) {
    const result = await acceptFriendRequest(requestId);
    if (result.success) {
      reloadFriends();
    }
  }

  async function handleRejectRequest(requestId: string) {
    await rejectFriendRequest(requestId);
    reloadFriends();
  }

  async function handleRemoveFriend(friendId: string, friendName: string) {
    setConfirmModal({
      title: 'Rimuovi Amico',
      message: `Sei sicuro di voler rimuovere ${friendName} dai tuoi amici?`,
      onConfirm: async () => {
        try {
          const result = await removeFriend(friendId);
          if (result.success) {
            await reloadFriends();
            showToast('Amico rimosso con successo', 'success');
          } else {
            showToast(result.error || 'Errore nella rimozione', 'error');
          }
        } catch (err) {
          console.error('Remove friend error:', err);
          showToast('Errore nella rimozione', 'error');
        }
        setConfirmModal(null);
      }
    });
  }

  function handleChallengeFriend(friendId: string, friendName: string, friendTier: string) {
    setChallengeModal({ friendId, friendName, friendTier, difficulty: 1, league: 'seria_a' });
  }

  async function handleCreateFriendChallenge() {
    if (!challengeModal) return;
    setCreatingChallenge(true);

    const result = await createFriendChallenge(challengeModal.friendId, challengeModal.difficulty, challengeModal.league);

    if (result.success) {
      showToast('Sfida inviata! Attendine l\'accettazione.', 'success');
      setChallengeModal(null);
      reloadChallenges();
    } else {
      showToast(result.error || 'Errore nell\'invio della sfida', 'error');
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
      window.location.href = `/sfida/${result.roomId}`;
    } else {
      showToast(result.error || 'Errore nell\'accettazione della sfida', 'error');
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
    <div className="space-y-6">
      <div className="bg-[#1E1E1E] rounded-3xl p-6 shadow-2xl border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Amici
          </h2>
          {friendRequests.length > 0 && (
            <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {friendRequests.length}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFriendsTab('search')}
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
              friendsTab === 'search' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4 inline mr-1" />
            Cerca
          </button>
          <button
            onClick={() => setFriendsTab('friends')}
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
              friendsTab === 'friends' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1" />
            Amici ({friends.length})
          </button>
          <button
            onClick={() => setFriendsTab('requests')}
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors relative ${
              friendsTab === 'requests' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-1" />
            Richieste
            {friendRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {friendRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setFriendsTab('challenges'); reloadChallenges(); }}
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors relative ${
              friendsTab === 'challenges' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 inline mr-1" />
            Sfide
            {pendingChallenges.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {pendingChallenges.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Tab */}
        {friendsTab === 'search' && (
          <div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Cerca utenti per nickname..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="bg-purple-600 px-4 py-2 rounded-xl text-white hover:bg-purple-500 transition-colors disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </div>

            <div className="space-y-2">
              {searchResults.length > 0 ? searchResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-white">{u.nickname || u.email?.split('@')[0]}</div>
                      {u.tier && <span className="text-xs text-zinc-400">Tier: {u.tier}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSendFriendRequest(u.id)}
                    className="p-2 bg-purple-600 rounded-lg text-white hover:bg-purple-500"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              )) : searchQuery && !searching && (
                <p className="text-center text-zinc-500 py-4">Nessun utente trovato</p>
              )}
            </div>
          </div>
        )}

        {/* Friends List Tab */}
        {friendsTab === 'friends' && (
          <div>
            {loadingFriends ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : friends.length > 0 ? (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{friend.nickname || friend.email?.split('@')[0]}</div>
                        {friend.tier && <span className="text-xs text-zinc-400">Tier: {friend.tier}</span>}
                        {/* "lastLogin" riflette in realtà l'ultimo aggiornamento del
                            profilo (profiles.updated_at), toccato ad ogni partita
                            giocata — è un proxy per "ultima attività", non un vero
                            tracking di login (is_online resta sempre false, non
                            implementato: nessuna presence). */}
                        {friend.lastLogin && (
                          <div className="text-xs text-zinc-500 mt-0.5">
                            Attivo {formatRelativeTime(friend.lastLogin)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleChallengeFriend(friend.friendId, friend.nickname || friend.email?.split('@')[0] || 'Amico', friend.tier || 'bronze')}
                        className="p-2 bg-yellow-600 rounded-lg text-white hover:bg-yellow-500 disabled:opacity-50"
                        title="Sfida diretta"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveFriend(friend.friendId, friend.nickname || friend.email?.split('@')[0] || 'Amico')}
                        className="p-2 text-red-400 hover:text-red-300"
                        title="Rimuovi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-zinc-500 py-4">Non hai ancora amici. Cerca utenti per aggiungerne!</p>
            )}
          </div>
        )}

        {/* Friend Requests Tab */}
        {friendsTab === 'requests' && (
          <div>
            {friendRequests.length > 0 ? (
              <div className="space-y-2">
                {friendRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{request.nickname || request.email?.split('@')[0]}</div>
                        <div className="text-xs text-zinc-400">Vuole essere tuo amico</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        className="p-2 bg-green-600 rounded-lg text-white hover:bg-green-500"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        className="p-2 bg-red-600 rounded-lg text-white hover:bg-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-zinc-500 py-4">Nessuna richiesta di amicizia</p>
            )}
          </div>
        )}

        {/* Challenges Tab */}
        {friendsTab === 'challenges' && (
          <div>
            {loadingChallenges ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
              </div>
            ) : pendingChallenges.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">In Attesa</h3>
                {pendingChallenges.map((challenge) => {
                  const isCreator = challenge.creator_id === currentUserId;
                  return (
                    <div key={challenge.id} className="bg-zinc-800/50 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {isCreator ? challenge.opponent_nickname : challenge.creator_nickname}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {challenge.difficulty === 1 ? 'Facile' : challenge.difficulty === 2 ? 'Medio' : 'Difficile'} • {challenge.league.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        {!isCreator && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptFriendChallenge(challenge.id)}
                              className="p-2 bg-green-600 rounded-lg text-white hover:bg-green-500"
                              title="Accetta"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeclineFriendChallenge(challenge.id)}
                              className="p-2 bg-red-600 rounded-lg text-white hover:bg-red-500"
                              title="Rifiuta"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {isCreator && (
                          <span className="text-xs text-yellow-500 font-medium">In attesa...</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-zinc-500 py-4">Nessuna sfida in attesa</p>
            )}

            {/* Challenge History */}
            {challengeHistory.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Giocate</h3>
                {challengeHistory.map((challenge) => {
                  const isWinner = challenge.result === 'creator_won';
                  const isDraw = challenge.result === 'abandoned';
                  return (
                    <div key={challenge.id} className="bg-zinc-800/30 p-3 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                          <User className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div>
                          <div className="font-medium text-white text-sm">{challenge.opponent_nickname}</div>
                          <div className="text-xs text-zinc-500">
                            {challenge.difficulty === 1 ? 'Facile' : challenge.difficulty === 2 ? 'Medio' : 'Difficile'} • {challenge.league.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <div className={`font-bold ${isDraw ? 'text-zinc-400' : isWinner ? 'text-green-400' : 'text-red-400'}`}>
                        {isDraw ? 'Abbandonato' : isWinner ? 'Vittoria' : 'Sconfitta'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmModal && (
        <ConfirmDialog
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {challengeModal && (
        <ChallengeFriendModal
          challengeModal={challengeModal}
          creatingChallenge={creatingChallenge}
          onChange={setChallengeModal}
          onCancel={() => setChallengeModal(null)}
          onSubmit={handleCreateFriendChallenge}
        />
      )}

      {/* Toast Notification (locale a questa tab) */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-purple-600'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
          {toast.type === 'error' && <X className="w-5 h-5" />}
          {toast.type === 'info' && <UserPlus className="w-5 h-5" />}
          <span className="font-medium text-white">{toast.message}</span>
        </motion.div>
      )}
    </div>
  );
}
