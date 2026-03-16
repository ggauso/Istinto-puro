import React from 'react';
import { useAuthStore } from '../authStore';
import { ArrowLeft, LogOut, Trophy, Target, Medal, User } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfileScreenProps {
  onBack: () => void;
}

export function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { user, profile, signOut } = useAuthStore();

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

  const matchesPlayed = profile.matches_played || 0;
  const matchesWon = profile.matches_won || 0;
  const totalScore = profile.total_score || 0;

  const winRate = matchesPlayed > 0 
    ? Math.round((matchesWon / matchesPlayed) * 100) 
    : 0;

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
          className="bg-[#1E1E1E] rounded-3xl p-8 shadow-2xl border border-white/5 mb-8"
        >
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
              <h1 className="text-3xl font-bold mb-1">
                {profile.first_name ? `${profile.first_name} ${profile.last_name || ''}` : user.email?.split('@')[0]}
              </h1>
              <p className="text-gray-400 mb-2">{user.email}</p>
              {profile.favorite_team && (
                <span className="inline-block bg-white/10 px-3 py-1 rounded-full text-sm font-medium text-[#FFD700]">
                  Tifoso: {profile.favorite_team}
                </span>
              )}
            </div>
          </div>
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
            <span className="text-4xl font-black mb-1">{totalScore}</span>
            <span className="text-sm text-gray-400 uppercase tracking-wider font-bold">Punti Totali</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
