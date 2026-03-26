/**
 * ChallengeScreen Component
 *
 * Pagina pubblica per accettare una sfida tramite link
 */

import React, { useState, useEffect } from 'react';
import { getChallengeByToken, acceptChallenge } from '../lib/rpc-client';
import { useAuthStore } from '../authStore';
import { useGameStore } from '../store';
import { motion } from 'motion/react';
import { Trophy, User, Check, X, Loader2, ArrowLeft, Send, Clock } from 'lucide-react';

interface ChallengeScreenProps {
  onBack: () => void;
  onAcceptChallenge: (roomId: string) => void;
  token: string;
}

export function ChallengeScreen({ onBack, onAcceptChallenge, token }: ChallengeScreenProps) {

  const { user } = useAuthStore();
  const { setGameMode, setSelectedDifficulty } = useGameStore();

  const [challenge, setChallenge] = useState<{
    id: string;
    creatorName: string;
    status: string;
    createdAt: string;
    expiresAt: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token non valido');
      setLoading(false);
      return;
    }

    loadChallenge();
  }, [token]);

  async function loadChallenge() {
    setLoading(true);
    const result = await getChallengeByToken(token!);

    if (result.error || !result.id) {
      setError(result.error || 'Sfida non trovata');
    } else {
      setChallenge(result as any);
    }
    setLoading(false);
  }

  async function handleAccept() {
    if (!user) {
      // Redirect to auth, then come back
      onBack(); // This will go to home which shows auth
      return;
    }

    setAccepting(true);
    const result = await acceptChallenge(token!);

    if (result.success && result.roomId) {
      setAccepted(true);
      // Start the game in PvP mode
      setGameMode('pvp');
      // Accept challenge triggers the private game flow
      setTimeout(() => {
        onAcceptChallenge(result.roomId!);
      }, 1500);
    } else {
      setError(result.message);
    }
    setAccepting(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-purple-400 w-12 h-12 mb-4" />
        <p className="text-zinc-400">Caricamento sfida...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-4">
        <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-8 max-w-md text-center">
          <X className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Sfida Non Disponibile</h2>
          <p className="text-zinc-400 mb-6">{error}</p>
          <button
            onClick={onBack}
            className="bg-[#FFD700] text-black font-bold py-3 px-8 rounded-full hover:bg-yellow-400 transition-colors"
          >
            Torna alla Home
          </button>
        </div>
      </div>
    );
  }

  // Check if challenge is already accepted or expired
  if (challenge?.status === 'accepted') {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-4">
        <div className="bg-purple-500/20 border border-purple-500/50 rounded-2xl p-8 max-w-md text-center">
          <Loader2 className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-spin" />
          <h2 className="text-2xl font-bold text-white mb-2">Sfida in Corso</h2>
          <p className="text-zinc-400 mb-6">La partita sta per iniziare...</p>
        </div>
      </div>
    );
  }

  if (challenge?.status === 'declined' || challenge?.status === 'expired') {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-8 max-w-md text-center">
          <X className="w-16 h-16 text-zinc-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Sfida Scaduta</h2>
          <p className="text-zinc-400 mb-6">Questa sfida non è più disponibile.</p>
          <button
            onClick={onBack}
            className="bg-[#FFD700] text-black font-bold py-3 px-8 rounded-full hover:bg-yellow-400 transition-colors"
          >
            Crea Nuova Sfida
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans">
      {/* Header */}
      <div className="sticky top-0 bg-[#121212]/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-zinc-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Send className="text-purple-400 w-5 h-5" />
            Sfida
          </h1>
          <div className="w-9" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-24 h-24 bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-purple-500/30">
            <Trophy className="w-12 h-12 text-purple-400" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2">
            Sfida da {challenge?.creatorName}
          </h2>
          <p className="text-zinc-400">
            Accetta la sfida e mostra le tue conoscenze calcistiche!
          </p>
        </motion.div>

        {/* Challenge Details */}
        <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-zinc-400" />
              <span className="text-zinc-400">Creato da</span>
            </div>
            <span className="font-bold text-white">{challenge?.creatorName}</span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-zinc-400" />
              <span className="text-zinc-400">Creata il</span>
            </div>
            <span className="font-mono text-zinc-300">{formatDate(challenge?.createdAt || '')}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-zinc-400" />
              <span className="text-zinc-400">Scade il</span>
            </div>
            <span className="font-mono text-zinc-300">{formatDate(challenge?.expiresAt || '')}</span>
          </div>
        </div>

        {/* Accept Button */}
        {accepted ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-purple-500/20 border border-purple-500/50 rounded-2xl p-6 text-center"
          >
            <Check className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Sfida Accettata!</h3>
            <p className="text-zinc-400">La partita sta per iniziare...</p>
          </motion.div>
        ) : user ? (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-bold text-xl py-4 px-10 rounded-full shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all"
          >
            {accepting ? (
              <>
                <Loader2 className="animate-spin w-6 h-6" />
                <span>Accettazione...</span>
              </>
            ) : (
              <>
                <Check className="w-6 h-6" />
                <span>Accetta Sfida</span>
              </>
            )}
          </button>
        ) : (
          <div className="text-center">
            <p className="text-zinc-400 mb-4">
              Devi effettuare l'accesso per accettare la sfida
            </p>
            <button
              onClick={onBack}
              className="w-full flex items-center justify-center gap-3 bg-[#FFD700] text-black font-bold text-xl py-4 px-10 rounded-full shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all"
            >
              <User className="w-6 h-6" />
              <span>Accedi e Accetta</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChallengeScreen;