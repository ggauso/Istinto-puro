import React from 'react';
import { useGameStore } from '../store';
import { useAuthStore } from '../authStore';
import { motion } from 'motion/react';
import { Trophy, Play, Loader2, Globe, Users, Bot, User } from 'lucide-react';

const LEAGUES = [
  { id: null, name: 'Tutti i Campionati' },
  { id: 135, name: 'Serie A 🇮🇹' },
  { id: 39, name: 'Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga 🇪🇸' },
  { id: 78, name: 'Bundesliga 🇩🇪' },
  { id: 61, name: 'Ligue 1 🇫🇷' },
];

const DIFFICULTIES = [
  { id: 1, name: 'Facile' },
  { id: 2, name: 'Medio' },
  { id: 3, name: 'Difficile' },
];

interface HomeScreenProps {
  onNavigateToAuth: () => void;
  onNavigateToProfile: () => void;
}

export function HomeScreen({ onNavigateToAuth, onNavigateToProfile }: HomeScreenProps) {
  const { findMatch, status, selectedLeague, setSelectedLeague, selectedDifficulty, setSelectedDifficulty, gameMode, setGameMode, resetGame } = useGameStore();
  const { user, profile } = useAuthStore();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-6 font-sans relative">
      <div className="absolute top-6 right-6">
        {user ? (
          <button 
            onClick={onNavigateToProfile}
            className="flex items-center gap-2 bg-[#1E1E1E] hover:bg-zinc-800 border border-white/10 px-4 py-2 rounded-full transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-[#FFD700] flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-black" />
              )}
            </div>
            <span className="font-medium text-sm">
              {profile?.first_name || user.email?.split('@')[0]}
            </span>
          </button>
        ) : (
          <button 
            onClick={onNavigateToAuth}
            className="flex items-center gap-2 bg-[#FFD700] text-black hover:bg-yellow-400 px-4 py-2 rounded-full font-bold transition-colors"
          >
            <User className="w-4 h-4" />
            <span>Accedi</span>
          </button>
        )}
      </div>

      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center space-y-6"
      >
        <div className="w-32 h-32 bg-zinc-900 rounded-full flex items-center justify-center border-4 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.3)]">
          <Trophy size={64} className="text-[#FFD700]" />
        </div>
        
        <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-yellow-500 uppercase text-center">
          Istinto Puro
        </h1>
        
        <p className="text-zinc-400 text-center max-w-sm text-lg leading-relaxed">
          Il trivia calcistico 1vs1. Trova il giocatore in comune tra le due squadre prima che scada il tempo.
        </p>

        {status === 'searching' ? (
          <div className="mt-8 flex flex-col items-center space-y-4">
            <Loader2 className="animate-spin text-[#FFD700]" size={48} />
            <p className="text-[#FFD700] font-bold animate-pulse text-xl">Ricerca avversario...</p>
            <button
              onClick={resetGame}
              className="mt-4 px-6 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-full font-bold transition-colors border border-red-500/30"
            >
              Annulla Ricerca
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center space-y-6 w-full max-w-xs">
            <div className="w-full flex bg-zinc-900 rounded-xl p-1 border-2 border-zinc-800">
              <button
                onClick={() => setGameMode('pvp')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-colors ${gameMode === 'pvp' ? 'bg-[#FFD700] text-black' : 'text-zinc-400 hover:text-white'}`}
              >
                <Users size={20} />
                PvP
              </button>
              <button
                onClick={() => setGameMode('ai')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-colors ${gameMode === 'ai' ? 'bg-[#FFD700] text-black' : 'text-zinc-400 hover:text-white'}`}
              >
                <Bot size={20} />
                Vs AI
              </button>
            </div>

            <div className="w-full space-y-2">
              <label className="text-zinc-400 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                <Globe size={16} />
                Seleziona Campionato
              </label>
              <select
                value={selectedLeague === null ? '' : selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-zinc-900 border-2 border-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:border-[#FFD700] transition-colors appearance-none text-center font-medium"
              >
                {LEAGUES.map((league) => (
                  <option key={league.id || 'all'} value={league.id || ''}>
                    {league.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full space-y-2">
              <label className="text-zinc-400 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                <Trophy size={16} />
                Difficoltà
              </label>
              <div className="flex gap-2 w-full">
                {DIFFICULTIES.map((diff) => (
                  <button
                    key={diff.id}
                    onClick={() => setSelectedDifficulty(diff.id)}
                    className={`flex-1 py-3 rounded-xl font-bold transition-colors border-2 ${
                      selectedDifficulty === diff.id
                        ? 'bg-[#FFD700] text-black border-[#FFD700]'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                    }`}
                  >
                    {diff.name}
                  </button>
                ))}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={findMatch}
              className="w-full flex items-center justify-center space-x-3 bg-[#FFD700] text-black font-bold text-xl py-4 px-10 rounded-full shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:shadow-[0_0_30px_rgba(255,215,0,0.6)] transition-all"
            >
              <Play size={24} fill="currentColor" />
              <span>{gameMode === 'ai' ? 'Sfida l\'AI' : 'Cerca Avversario'}</span>
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
