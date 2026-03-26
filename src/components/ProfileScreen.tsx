import React, { useRef, useState, useEffect } from 'react';
import { useAuthStore } from '../authStore';
import { TierBadge } from './TierBadge';
import { calculateTier, getTierProgress, getNextTierScore } from '../lib/game-utils';
import { searchUsers, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend, getFriends, getPendingFriendRequests, getUserStats, getStatsByDifficulty, getStatsByOpponentTier, getMonthlyActivity, getResultDistribution, type UserStats, type StatsByDifficulty, type StatsByOpponentTier, type MonthlyActivity, type ResultDistribution } from '../lib/rpc-client';
import { ArrowLeft, LogOut, Trophy, Target, Medal, User, Edit2, Save, X, Lock, Eye, EyeOff, Search, UserPlus, Check, Trash2, Send, Users, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfileScreenProps {
  onBack: () => void;
}

export function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { user, profile, signOut, updateProfile } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    nickname: profile?.nickname || '',
    favorite_team: profile?.favorite_team || '',
    avatar_url: profile?.avatar_url || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '' });
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const passwordRequestInFlight = useRef(false);

  // Main profile tabs: 'info' | 'stats' | 'friends'
  const [mainTab, setMainTab] = useState<'info' | 'stats' | 'friends'>('info');

  // Friends system state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendsTab, setFriendsTab] = useState<'search' | 'friends' | 'requests'>('search');

  // Stats section
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Advanced stats section (expandable)
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [advancedStats, setAdvancedStats] = useState<{
    byDifficulty: StatsByDifficulty[];
    byOpponentTier: StatsByOpponentTier[];
    monthly: MonthlyActivity[];
    distribution: ResultDistribution[];
  }>({
    byDifficulty: [],
    byOpponentTier: [],
    monthly: [],
    distribution: []
  });
  const [loadingAdvancedStats, setLoadingAdvancedStats] = useState(false);

  const { changePassword } = useAuthStore();

  const handleSignOut = async () => {
    await signOut();
    onBack();
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      console.log('Starting save...', editForm);
      await updateProfile(editForm);
      console.log('Save completed');
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error in handleSave:', error);
      setSaveError(error.message || 'Errore durante il salvataggio del profilo');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordRequestInFlight.current || isSavingPassword || passwordSuccess) return;

    if (!passwordForm.newPassword) {
      setPasswordError('Inserisci la nuova password');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('La nuova password deve avere almeno 6 caratteri');
      return;
    }

    passwordRequestInFlight.current = true;
    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      await changePassword(passwordForm.newPassword);

      // Successo (200): mostra feedback positivo all'utente
      setPasswordSuccess(true);
      setPasswordForm({ oldPassword: '', newPassword: '' });
      
      // Chiudi il pannello dopo 3 secondi
      setTimeout(() => {
        setIsChangingPassword(false);
        setPasswordSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Error changing password:', error);
      setPasswordError(error.message || 'Errore durante il cambio password');
    } finally {
      // Spegne sempre il loading del pulsante, anche con risposta 200
      setIsSavingPassword(false);
      passwordRequestInFlight.current = false;
    }
  };

  // Load friends and requests
  useEffect(() => {
    if (!user) return;
    loadFriendsData();
  }, [user]);

  // Load stats
  useEffect(() => {
    if (!user) return;
    loadStats();
  }, [user]);

  // Load advanced stats when expanded
  useEffect(() => {
    if (!user || !showAdvancedStats) return;
    loadAdvancedStats();
  }, [user, showAdvancedStats]);

  async function loadAdvancedStats() {
    setLoadingAdvancedStats(true);
    try {
      const [byDifficulty, byOpponentTier, monthly, distribution] = await Promise.all([
        getStatsByDifficulty(user.id),
        getStatsByOpponentTier(user.id),
        getMonthlyActivity(user.id),
        getResultDistribution(user.id)
      ]);
      setAdvancedStats({ byDifficulty, byOpponentTier, monthly, distribution });
    } catch (err) {
      console.error('Error loading advanced stats:', err);
    }
    setLoadingAdvancedStats(false);
  }

  async function loadStats() {
    setLoadingStats(true);
    try {
      const userStats = await getUserStats(user.id);
      if (userStats) {
        setStats(userStats);
      } else if (profile) {
        const played = profile.matches_played || 0;
        const won = profile.matches_won || 0;
        setStats({
          matches_played: played,
          matches_won: won,
          matches_lost: profile.matches_lost || 0,
          matches_abandoned: profile.matches_abandoned || 0,
          win_rate: played > 0 ? Math.round((won / played) * 100) : 0,
          average_score: played > 0 ? Math.round((profile.total_score || 0) / played) : 0,
          current_streak: profile.current_streak || 0,
          streak_type: profile.streak_type || 'none',
          longest_win_streak: profile.longest_win_streak || 0,
          longest_loss_streak: profile.longest_loss_streak || 0,
          best_score: profile.best_score || 0
        });
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
    setLoadingStats(false);
  }

  async function loadFriendsData() {
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
      alert(result.error || 'Errore nell\'invio della richiesta');
    }
  }

  async function handleAcceptRequest(requestId: string) {
    const result = await acceptFriendRequest(requestId);
    if (result.success) {
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      loadFriendsData();
    }
  }

  async function handleRejectRequest(requestId: string) {
    const result = await rejectFriendRequest(requestId);
    if (result.success) {
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    }
  }

  async function handleRemoveFriend(friendId: string) {
    if (!confirm('Sei sicuro di voler rimuovere questo amico?')) return;
    const result = await removeFriend(friendId);
    if (result.success) {
      setFriends(prev => prev.filter(f => f.id !== friendId));
    }
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFD700]"></div>
      </div>
    );
  }

  const matchesPlayed = profile.matches_played || 0;
  const matchesWon = profile.matches_won || 0;
  const totalScore = profile.total_score || 0;

  const winRate = matchesPlayed > 0
    ? Math.round((matchesWon / matchesPlayed) * 100)
    : 0;

  // Calcolo tier
  const tier = calculateTier(totalScore);
  const tierProgress = getTierProgress(totalScore);
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

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
        </div>

        {/* INFO TAB - Profilo Utente */}
        {mainTab === 'info' && (
          <>
            {/* Profilo Card */}
            <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1E1E1E] rounded-3xl p-8 shadow-2xl border border-white/5 mb-8 relative"
        >
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold">Modifica Profilo</h2>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({
                      first_name: profile.first_name || '',
                      last_name: profile.last_name || '',
                      nickname: profile.nickname || '',
                      favorite_team: profile.favorite_team || '',
                      avatar_url: profile.avatar_url || ''
                    });
                  }}
                  className="p-2 text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Nickname</label>
                  <input
                    type="text"
                    value={editForm.nickname}
                    onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#FFD700]"
                    placeholder="Nome visualizzato nelle sfide"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Nome</label>
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#FFD700]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Cognome</label>
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#FFD700]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Squadra del Cuore</label>
                  <input
                    type="text"
                    value={editForm.favorite_team}
                    onChange={(e) => setEditForm({ ...editForm, favorite_team: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#FFD700]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">URL Avatar</label>
                  <input
                    type="text"
                    value={editForm.avatar_url}
                    onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#FFD700]"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {saveError && (
                <div className="mt-2 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm text-center">
                  {saveError}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="mt-4 w-full bg-[#FFD700] text-black font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Salva Modifiche
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FFD700] to-orange-500 p-1">
                <div className="w-full h-full bg-[#121212] rounded-full flex items-center justify-center overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-[#FFD700]" />
                  )}
                </div>
              </div>
              
              <div className="text-center md:text-left flex-1">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                  <h1 className="text-3xl font-bold">
                    {profile.first_name ? `${profile.first_name} ${profile.last_name || ''}` : user.email?.split('@')[0]}
                  </h1>
                  <TierBadge tier={tier} size="md" showLabel={true} />
                </div>
                <p className="text-gray-400 mb-2">{user.email}</p>
                {profile.favorite_team && (
                  <span className="inline-block bg-white/10 px-3 py-1 rounded-full text-sm font-medium text-[#FFD700]">
                    Tifoso: {profile.favorite_team}
                  </span>
                )}
              </div>
            </div>
          )}
        </motion.div>

        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-[#FFD700]" />
          Statistiche
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-[#1E1E1E] rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center text-center"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-3">
              <Target className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-4xl font-black mb-1">{matchesPlayed}</span>
            <span className="text-sm text-gray-400 uppercase tracking-wider font-bold">Partite Giocate</span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-[#1E1E1E] rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center text-center"
          >
            <div className="w-12 h-12 bg-[#FFD700]/20 rounded-full flex items-center justify-center mb-3">
              <Medal className="w-6 h-6 text-[#FFD700]" />
            </div>
            <span className="text-4xl font-black mb-1">{matchesWon}</span>
            <span className="text-sm text-gray-400 uppercase tracking-wider font-bold">Vittorie</span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-[#1E1E1E] rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center text-center"
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-3">
              <Trophy className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-4xl font-black mb-1">{winRate}%</span>
            <span className="text-sm text-gray-400 uppercase tracking-wider font-bold">Win Rate</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-[#1E1E1E] rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center text-center"
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-3">
              <Trophy className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-4xl font-black mb-1">{totalScore.toLocaleString('it-IT')}</span>
            <span className="text-sm text-gray-400 uppercase tracking-wider font-bold">Punti Totali</span>
            {tier !== 'diamond' && (
              <div className="mt-3 w-full">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progresso</span>
                  <span>{tierProgress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${tierProgress}%`,
                      backgroundColor: '#FFD700'
                    }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 bg-[#1E1E1E] rounded-3xl p-8 shadow-2xl border border-white/5"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Lock className="w-6 h-6 text-[#FFD700]" />
              Sicurezza
            </h2>
            {!isChangingPassword && (
              <button
                onClick={() => setIsChangingPassword(true)}
                className="text-sm font-medium text-[#FFD700] hover:text-yellow-400 transition-colors"
              >
                Cambia Password
              </button>
            )}
          </div>

          {isChangingPassword && (
            <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Nuova Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-12 py-2 text-white focus:outline-none focus:border-[#FFD700]"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showNewPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {passwordError && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm text-center">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 text-sm text-center">
                  Password aggiornata con successo!
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordForm({ oldPassword: '', newPassword: '' });
                    setPasswordError(null);
                    setPasswordSuccess(false);
                  }}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword || passwordSuccess}
                  className={`flex-1 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
                    passwordSuccess
                      ? 'bg-green-500 text-white'
                      : 'bg-[#FFD700] text-black hover:bg-yellow-400 disabled:opacity-50'
                  }`}
                >
                  {isSavingPassword ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>
                  ) : passwordSuccess ? (
                    '✓ Password Aggiornata!'
                  ) : (
                    'Aggiorna Password'
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
          </>
        )}

        {/* STATS TAB */}
        {mainTab === 'stats' && (
          <div className="space-y-6">
            {/* Basic Stats */}
            <div className="bg-[#1E1E1E] rounded-3xl p-6 shadow-2xl border border-white/5">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Statistiche
              </h2>

              {loadingStats ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  {/* Card Progresso Tier */}
                  <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 rounded-2xl p-5 border border-purple-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                          tier === 'diamond' ? 'bg-purple-900/50' :
                          tier === 'platinum' ? 'bg-cyan-900/50' :
                          tier === 'gold' ? 'bg-yellow-900/50' :
                          tier === 'silver' ? 'bg-gray-600/50' :
                          'bg-amber-900/50'
                        }`}>
                          {tier === 'diamond' ? '💎' : tier === 'platinum' ? '⭐' : tier === 'gold' ? '🏆' : tier === 'silver' ? '🥈' : '🥉'}
                        </div>
                        <div>
                          <div className="text-lg font-bold text-white">Tier {tierLabel}</div>
                          <div className="text-sm text-zinc-400">Punteggio: {totalScore}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-400">{tierProgress}%</div>
                        <div className="text-xs text-zinc-500">al prossimo livello</div>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${tierProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500 mt-2">
                      <span>{totalScore} pt</span>
                      <span>{tier === 'diamond' ? 'MAX' : `${getNextTierScore(tier)} pt`}</span>
                    </div>
                  </div>

                  {/* Card Partite */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-white">{stats.matches_played}</div>
                      <div className="text-sm text-zinc-400 mt-1">Partite</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-green-400">{stats.matches_won}</div>
                      <div className="text-sm text-zinc-400 mt-1">Vinte</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-red-400">{stats.matches_lost}</div>
                      <div className="text-sm text-zinc-400 mt-1">Perse</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-yellow-400">{stats.win_rate}%</div>
                      <div className="text-sm text-zinc-400 mt-1">Win Rate</div>
                    </div>
                  </div>

                  {/* Card Statistiche Dettagliate */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-white">{Math.round(stats.average_score)}</div>
                      <div className="text-xs text-zinc-400 mt-1">Media Punti</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-purple-400">{stats.best_score}</div>
                      <div className="text-xs text-zinc-400 mt-1">Best Score</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-orange-400">{stats.matches_abandoned}</div>
                      <div className="text-xs text-zinc-400 mt-1">Abbandonate</div>
                    </div>
                  </div>

                  {/* Card Streak */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`bg-zinc-800/50 rounded-xl p-4 ${stats.streak_type === 'win' ? 'border border-green-500/50' : stats.streak_type === 'loss' ? 'border border-red-500/50' : ''}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {stats.streak_type === 'win' ? (
                          <span className="text-green-400 text-sm">🔥 Serie Vittorie</span>
                        ) : stats.streak_type === 'loss' ? (
                          <span className="text-red-400 text-sm">❄️ Serie Sconfitte</span>
                        ) : (
                          <span className="text-zinc-400 text-sm">Streak</span>
                        )}
                      </div>
                      <div className="text-3xl font-bold text-white">{stats.current_streak}</div>
                      <div className="text-xs text-zinc-500 mt-1">attuale</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-xl p-4">
                      <div className="text-sm text-zinc-400 mb-3">Record Streak</div>
                      <div className="flex justify-between">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400">🏆</div>
                          <div className="text-lg font-bold text-green-400">{stats.longest_win_streak}</div>
                          <div className="text-xs text-zinc-500">vittorie</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-400">📉</div>
                          <div className="text-lg font-bold text-red-400">{stats.longest_loss_streak}</div>
                          <div className="text-xs text-zinc-500">sconfitte</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-400">
                  <p>Caricamento statistiche...</p>
                </div>
              )}
            </div>

            {/* Advanced Stats Section (Expandable) */}
            <div className="bg-[#1E1E1E] rounded-3xl p-6 shadow-2xl border border-white/5">
              <button
                onClick={() => setShowAdvancedStats(!showAdvancedStats)}
                className="w-full flex items-center justify-between mb-4"
              >
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Target className="w-5 h-5 text-cyan-400" />
                  Statistiche Avanzate
                </h2>
                <motion.div
                  animate={{ rotate: showAdvancedStats ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </motion.div>
              </button>

              {showAdvancedStats && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {loadingAdvancedStats ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Win Rate by Difficulty - Card migliorata */}
                      <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 rounded-2xl p-5 border border-cyan-500/20">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <h3 className="text-base font-semibold text-cyan-300">Win Rate per Difficoltà</h3>
                        </div>
                        <div className="space-y-4">
                          {advancedStats.byDifficulty.length > 0 ? advancedStats.byDifficulty.map((item) => {
                            const difficultyLabel = item.difficulty === 1 ? 'Facile' : item.difficulty === 2 ? 'Medio' : 'Difficile';
                            const difficultyColors: Record<number, string> = {
                              1: 'from-green-500 to-emerald-500',
                              2: 'from-yellow-500 to-orange-500',
                              3: 'from-red-500 to-rose-500'
                            };
                            return (
                              <div key={item.difficulty} className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-zinc-300">{difficultyLabel}</span>
                                  <span className="text-lg font-bold text-white">{item.win_rate}%</span>
                                </div>
                                <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
                                  <div
                                    className={`h-full bg-gradient-to-r ${difficultyColors[item.difficulty] || 'from-zinc-500 to-zinc-400'} rounded-full transition-all duration-500`}
                                    style={{ width: `${item.win_rate}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs text-zinc-500">
                                  <span>{item.matches_won} vittorie</span>
                                  <span>{item.matches_lost} sconfitte</span>
                                </div>
                              </div>
                            );
                          }) : (
                            <div className="text-center py-6 text-zinc-500">
                              <p>Nessuna partita giocata</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Performance vs Opponent Tier - Card migliorata */}
                      <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-2xl p-5 border border-purple-500/20">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                            <Users className="w-4 h-4 text-purple-400" />
                          </div>
                          <h3 className="text-base font-semibold text-purple-300">Performance vs Tier Avversario</h3>
                        </div>
                        <div className="space-y-4">
                          {advancedStats.byOpponentTier.length > 0 ? advancedStats.byOpponentTier.map((item) => {
                            const tierColors: Record<string, string> = {
                              Bronze: 'from-amber-600 to-yellow-500',
                              Silver: 'from-gray-400 to-slate-300',
                              Gold: 'from-yellow-500 to-amber-400',
                              Platinum: 'from-cyan-500 to-teal-400',
                              Diamond: 'from-purple-500 to-pink-400',
                              AI: 'from-red-500 to-orange-400'
                            };
                            const tierIcons: Record<string, string> = {
                              Bronze: '🥉',
                              Silver: '🥈',
                              Gold: '🏆',
                              Platinum: '⭐',
                              Diamond: '💎',
                              AI: '🤖'
                            };
                            return (
                              <div key={item.opponent_tier} className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-zinc-300">
                                    {tierIcons[item.opponent_tier] || '❓'} {item.opponent_tier}
                                  </span>
                                  <span className="text-lg font-bold text-white">{item.win_rate}%</span>
                                </div>
                                <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
                                  <div
                                    className={`h-full bg-gradient-to-r ${tierColors[item.opponent_tier] || 'from-zinc-500 to-zinc-400'} rounded-full transition-all duration-500`}
                                    style={{ width: `${item.win_rate}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs text-zinc-500">
                                  <span>{item.matches_won} vittorie</span>
                                  <span>{item.matches_lost} sconfitte</span>
                                </div>
                              </div>
                            );
                          }) : (
                            <div className="text-center py-6 text-zinc-500">
                              <p>Nessuna partita PvP</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Monthly Activity - Card migliorata */}
                      <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-2xl p-5 border border-green-500/20">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <h3 className="text-base font-semibold text-green-300">Attività Mensile</h3>
                        </div>
                        <div className="flex items-end gap-3 h-40">
                          {advancedStats.monthly.length > 0 ? advancedStats.monthly.slice(-6).map((item, idx) => {
                            const maxMatches = Math.max(...advancedStats.monthly.map(m => m.matches_played), 1);
                            const height = Math.max((item.matches_played / maxMatches) * 100, 10);
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                <div className="w-full flex flex-col items-center justify-end h-32">
                                  <div
                                    className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t-lg hover:from-green-500 hover:to-green-300 transition-all cursor-pointer"
                                    style={{ height: `${height}%` }}
                                    title={`${item.matches_played} partite, ${item.matches_won} vittorie`}
                                  />
                                </div>
                                <span className="text-xs font-medium text-zinc-400">{item.month}</span>
                                <span className="text-xs text-zinc-500">{item.matches_played}</span>
                              </div>
                            );
                          }) : (
                            <div className="flex-1 text-center py-6 text-zinc-500">
                              <p>Nessuna attività recente</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Result Distribution - Card migliorata */}
                      <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 rounded-2xl p-5 border border-orange-500/20">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                            </svg>
                          </div>
                          <h3 className="text-base font-semibold text-orange-300">Distribuzione Risultati</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {advancedStats.distribution.length > 0 ? advancedStats.distribution.map((item) => {
                            const colors: Record<string, string> = {
                              'Vittorie': 'from-green-600 to-emerald-500',
                              'Sconfitte': 'from-red-600 to-rose-500',
                              'Abbandoni': 'from-yellow-600 to-amber-500'
                            };
                            const icons: Record<string, string> = {
                              'Vittorie': '✅',
                              'Sconfitte': '❌',
                              'Abbandoni': '⏸️'
                            };
                            const labels: Record<string, string> = {
                              'Vittorie': 'Vinte',
                              'Sconfitte': 'Perse',
                              'Abbandoni': 'Abb.'
                            };
                            return (
                              <div key={item.result_type} className="text-center">
                                <div className="text-3xl mb-2">{icons[item.result_type] || '❓'}</div>
                                <div className="text-2xl font-bold text-white">{item.percentage}%</div>
                                <div className="text-sm text-zinc-400">{labels[item.result_type] || item.result_type}</div>
                                <div className="w-full bg-zinc-800 rounded-full h-2 mt-3 overflow-hidden">
                                  <div
                                    className={`h-full bg-gradient-to-r ${colors[item.result_type] || 'from-zinc-500 to-zinc-400'} rounded-full`}
                                    style={{ width: `${item.percentage}%` }}
                                  />
                                </div>
                                <div className="text-xs text-zinc-500 mt-1">{item.count} partite</div>
                              </div>
                            );
                          }) : (
                            <div className="col-span-3 text-center py-6 text-zinc-500">
                              <p>Nessuna partita giocata</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* FRIENDS TAB */}
        {mainTab === 'friends' && (
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
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveFriend(friend.id)}
                            className="p-2 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
