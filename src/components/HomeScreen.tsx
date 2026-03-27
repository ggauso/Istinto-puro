import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store';
import { useAuthStore } from '../authStore';
import { createChallenge, getMyActiveChallenge } from '../lib/rpc-client';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, Loader2, Globe, Users, Bot, User, Send, X, ExternalLink } from 'lucide-react';

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
  onNavigateToLeaderboard: () => void;
}

export function HomeScreen({ onNavigateToAuth, onNavigateToProfile, onNavigateToLeaderboard }: HomeScreenProps) {
  const { findMatch, status, selectedLeague, setSelectedLeague, selectedDifficulty, setSelectedDifficulty, gameMode, setGameMode, errorMsg, setErrorMsg } = useGameStore();
  const { user, profile } = useAuthStore();

  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [pendingChallengeToken, setPendingChallengeToken] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  // Polling per il creatore della sfida - check if someone accepted
  useEffect(() => {
    if (!user || !pendingChallengeToken) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Poll every 5 seconds to check if THIS specific challenge was accepted
    pollingRef.current = window.setInterval(async () => {
      // Don't poll if we don't have a valid pending token
      if (!pendingChallengeToken) return;

      const result = await getMyActiveChallenge();

      // Check if THIS specific challenge (matching our token) was accepted
      // Only redirect if the challenge is recent (within last 5 minutes)
      if (
        result.success &&
        result.challenge &&
        result.challenge.status === 'accepted' &&
        result.challenge.roomId
      ) {
        // Stop polling and redirect
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        // Clear the pending token so polling stops
        setPendingChallengeToken(null);

        // Navigate to the challenge page where the game will start
        window.location.href = `/sfida/${pendingChallengeToken}`;
      }
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [user, pendingChallengeToken]);

  const handleCreateChallenge = async () => {
    if (!user) {
      onNavigateToAuth();
      return;
    }

    setCreatingChallenge(true);
    const result = await createChallenge();

    if (result.success && result.token) {
      setChallengeToken(result.token);
      setPendingChallengeToken(result.token); // Start polling for this challenge
      setShowChallengeModal(true);
    } else {
      setErrorMsg(result.error || 'Errore nella creazione della sfida');
    }
    setCreatingChallenge(false);
  };

  const handleGoToChallenge = () => {
    if (challengeToken) {
      window.location.href = `/sfida/${challengeToken}`;
    }
  };

  const handleCloseChallengeModal = () => {
    setShowChallengeModal(false);
    // Keep pendingChallengeToken to keep polling active
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-6 font-sans relative">
      <div className="absolute top-6 right-6 flex items-center gap-2">
        {user && (
          <button
            onClick={onNavigateToLeaderboard}
            className="flex items-center gap-2 bg-[#1E1E1E] hover:bg-zinc-800 border border-white/10 px-4 py-2 rounded-full transition-colors"
            title="Classifica"
          >
            <Trophy className="w-4 h-4 text-[#FFD700]" />
            <span className="font-medium text-sm">Classifica</span>
          </button>
        )}
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

        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-xl max-w-sm text-center text-sm font-medium">
            {errorMsg}
            <button
              onClick={() => setErrorMsg(null)}
              className="ml-2 underline text-red-400 hover:text-red-300"
            >
              Chiudi
            </button>
          </div>
        )}

        {status === 'searching' ? (
          <div className="mt-8 flex flex-col items-center space-y-4">
            <Loader2 className="animate-spin text-[#FFD700]" size={48} />
            <p className="text-[#FFD700] font-bold animate-pulse text-xl">Ricerca avversario...</p>
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

            {/* Challenge Button - only show for PvP mode */}
            {gameMode === 'pvp' && user && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleCreateChallenge}
                disabled={creatingChallenge || status === 'searching'}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-xl border-2 border-purple-500/50 transition-colors"
              >
                {creatingChallenge ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <Send size={20} />
                )}
                <span>Sfida un amico</span>
              </motion.button>
            )}

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

      {/* Challenge Modal */}
      <AnimatePresence>
        {showChallengeModal && challengeToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseChallengeModal}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-purple-500/30 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Send className="text-purple-400 w-5 h-5" />
                  Sfida Creata!
                </h2>
                <button
                  onClick={handleCloseChallengeModal}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <p className="text-zinc-400 mb-4">
                Condividi questo link con un amico per sfidarlo:
              </p>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={`https://istintopuro.com/sfida/${challengeToken}`}
                  readOnly
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(`https://istintopuro.com/sfida/${challengeToken}`)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold transition-colors"
                >
                  Copia
                </button>
              </div>

              <p className="text-purple-300 text-sm text-center mt-4">
                Attendi che un avversario accetti. Verrai reindirizzato automaticamente.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HomeScreen;