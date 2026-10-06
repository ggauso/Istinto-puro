import { useState } from 'react';
import { useAuthStore } from '../authStore';
import { useFriendsAndChallenges } from './profile/useFriendsAndChallenges';
import { ProfileInfoTab } from './profile/ProfileInfoTab';
import { ProfileStatsTab } from './profile/ProfileStatsTab';
import { ProfileFriendsTab } from './profile/ProfileFriendsTab';
import { ProfileAchievementsTab } from './profile/ProfileAchievementsTab';
import { ProfileHistoryTab } from './profile/ProfileHistoryTab';
import { ProfileShopTab } from './profile/ProfileShopTab';
import { ArrowLeft, LogOut, User, Trophy, Users, Award, History, ShoppingBag, UserPlus, CheckCircle, X } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfileScreenProps {
  onBack: () => void;
  initialTab?: 'info' | 'stats' | 'friends' | 'achievements' | 'history' | 'shop';
}

export function ProfileScreen({ onBack, initialTab = 'info' }: ProfileScreenProps) {
  const { user, profile, signOut } = useAuthStore();

  // Main profile tabs: 'info' | 'stats' | 'friends' | 'achievements' | 'history' | 'shop'
  const [mainTab, setMainTab] = useState<'info' | 'stats' | 'friends' | 'achievements' | 'history' | 'shop'>(initialTab);
  // Friends sub-tab, sollevato qui per permettere alla notifica cross-tab
  // (nuove richieste/sfide) di navigare direttamente alla sotto-scheda giusta.
  const [friendsTab, setFriendsTab] = useState<'search' | 'friends' | 'requests' | 'challenges'>('search');

  const {
    friends,
    friendRequests,
    loadingFriends,
    pendingChallenges,
    challengeHistory,
    loadingChallenges,
    toastWithAction,
    dismissToastWithAction,
    reloadFriends,
    reloadChallenges,
  } = useFriendsAndChallenges(user?.id, (tab) => {
    setMainTab('friends');
    setFriendsTab(tab);
  });

  const handleSignOut = async () => {
    await signOut();
    onBack();
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFD700]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Torna alla Home</span>
          </button>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Esci</span>
          </button>
        </header>

        {/* Main Navigation Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMainTab('info')}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              mainTab === 'info' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4 inline mr-2" />
            Info
          </button>
          <button
            onClick={() => setMainTab('stats')}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              mainTab === 'stats' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4 inline mr-2" />
            Statistiche
          </button>
          <button
            onClick={() => setMainTab('friends')}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              mainTab === 'friends' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Amici
          </button>
          <button
            onClick={() => setMainTab('achievements')}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              mainTab === 'achievements' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4 inline mr-2" />
            Achievement
          </button>
          <button
            onClick={() => setMainTab('history')}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              mainTab === 'history' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Storico
          </button>
          <button
            onClick={() => setMainTab('shop')}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              mainTab === 'shop' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4 inline mr-2" />
            Shop
          </button>
        </div>

        {mainTab === 'info' && <ProfileInfoTab />}
        {mainTab === 'stats' && <ProfileStatsTab />}
        {mainTab === 'achievements' && <ProfileAchievementsTab />}
        {mainTab === 'history' && <ProfileHistoryTab />}
        {mainTab === 'shop' && <ProfileShopTab />}
        {mainTab === 'friends' && (
          <ProfileFriendsTab
            currentUserId={user.id}
            friendsTab={friendsTab}
            setFriendsTab={setFriendsTab}
            friends={friends}
            friendRequests={friendRequests}
            loadingFriends={loadingFriends}
            pendingChallenges={pendingChallenges}
            challengeHistory={challengeHistory}
            loadingChallenges={loadingChallenges}
            reloadFriends={reloadFriends}
            reloadChallenges={reloadChallenges}
          />
        )}

        {/* Toast di notifica cross-tab (nuove richieste/sfide), visibile su qualunque scheda */}
        {toastWithAction && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 ${
              toastWithAction.type === 'success' ? 'bg-green-600' :
              toastWithAction.type === 'error' ? 'bg-red-600' :
              'bg-purple-600'
            }`}
          >
            {toastWithAction.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {toastWithAction.type === 'error' && <X className="w-5 h-5" />}
            {toastWithAction.type === 'info' && <UserPlus className="w-5 h-5" />}
            <span className="font-medium text-white">{toastWithAction.message}</span>
            {toastWithAction.action && (
              <button
                onClick={() => {
                  toastWithAction.action?.();
                  dismissToastWithAction();
                }}
                className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium text-white transition-colors"
              >
                {toastWithAction.actionLabel}
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
