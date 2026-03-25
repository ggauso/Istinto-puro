import React, { useRef, useState } from 'react';
import { useAuthStore } from '../authStore';
import { TierBadge } from './TierBadge';
import { calculateTier, getTierProgress } from '../lib/game-utils';
import { ArrowLeft, LogOut, Trophy, Target, Medal, User, Edit2, Save, X, Lock, Eye, EyeOff } from 'lucide-react';
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
      </div>
    </div>
  );
}
