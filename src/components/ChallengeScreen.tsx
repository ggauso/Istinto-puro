/**
 * ChallengeScreen Component
 *
 * Pagina per gestire le sfide - sia per chi accetta che per chi crea
 * - URL: /sfida/TOKEN
 * - Se l'utente è il creatore: polling per rilevare accettazione
 * - Se l'utente è un visitatore: può accettare la sfida
 */

import React, { useState, useEffect, useRef } from 'react';
import { getChallengeByToken, acceptChallenge, completeChallenge } from '../lib/rpc-client';
import { useAuthStore } from '../authStore';
import { useGameStore } from '../store';
import { motion } from 'motion/react';
import { Trophy, User, Check, X, Loader2, ArrowLeft, Send, Clock, Play } from 'lucide-react';

interface ChallengeScreenProps {
  token: string;
  onBack: () => void;
  onAcceptChallenge: (roomId: string, opponentUserId: string, opponentNickname: string, opponentTier: string, isHost?: boolean, challengeId?: string) => void;
}

export function ChallengeScreen({ onBack, onAcceptChallenge, token }: ChallengeScreenProps) {
  const { user } = useAuthStore();
  const { setGameMode } = useGameStore();

  const [challenge, setChallenge] = useState<{
    id: string;
    creatorId: string;
    creatorName: string;
    status: string;
    createdAt: string;
    expiresAt: string;
    roomId: string | null;
    opponentId: string | null;
    opponentName: string | null;
    opponentTier: string | null;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token non valido');
      setLoading(false);
      return;
    }

    loadChallenge();
  }, [token]);

  // NOTE: Il polling è nella HomeScreen - qui mostriamo solo lo stato attuale
  // L'utente viene reindirizzato qui quando qualcuno accetta la sfida

  async function loadChallenge() {
    setLoading(true);
    const result = await getChallengeByToken(token);

    // Challenge not found (completed/expired OR never existed) - show error
    if (result.error || !result.id) {
      setError('Questa sfida non è più disponibile. La partita è già terminata o il link è scaduto.');
      setLoading(false);
      return;
    }

    // Challenge is already finished - don't allow re-entry
    if (result.status === 'expired' || result.status === 'completed') {
      setChallenge({
        id: result.id,
        creatorId: result.creatorId,
        creatorName: result.creatorName,
        status: result.status,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
        roomId: null,
        opponentId: null,
        opponentName: null,
        opponentTier: null
      });
      setLoading(false);
      return;
    }

    // Challenge is 'accepted' - user can start the game
    if (result.status === 'accepted') {
      setChallenge({
        id: result.id,
        creatorId: result.creatorId,
        creatorName: result.creatorName,
        status: 'accepted',
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
        roomId: result.roomId,
        opponentId: result.opponentId,
        opponentName: result.opponentName,
        opponentTier: result.opponentTier
      });
    } else {
      // Status is 'pending' - show waiting screen
      setChallenge({
        id: result.id,
        creatorId: result.creatorId,
        creatorName: result.creatorName,
        status: result.status,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
        roomId: null,
        opponentId: null,
        opponentName: null,
        opponentTier: null
      });
    }
    setLoading(false);
  }

  async function handleAccept() {
    if (!user) {
      onBack();
      return;
    }

    setAccepting(true);
    const result = await acceptChallenge(token);

    if (result.success && result.roomId) {
      setAccepted(true);
      setGameMode('pvp');
      setTimeout(() => {
        onAcceptChallenge(
          result.roomId!,
          result.creatorId || '',
          result.creatorNickname || 'Sfidante',
          result.creatorTier || 'bronze',
          false, // isHost = false for challenger
          result.challengeId || undefined
        );
      }, 1500);
    } else {
      setError(result.message);
    }
    setAccepting(false);
  }

  function handleStartGame() {
    if (!challenge || !challenge.roomId || !challenge.opponentId) return;

    setGameMode('pvp');
    onAcceptChallenge(
      challenge.roomId,
      challenge.opponentId,
      challenge.opponentName || 'Sfidante',
      challenge.opponentTier || 'bronze',
      true, // isHost = true for creator
      challenge.id
    );
  }

  function handleDismissChallenge() {
    // Clear local state - the challenge will expire naturally
    setChallenge(null);
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

  // Check if user is the creator
  const isCreator = user && challenge && challenge.creatorId && user.id === challenge.creatorId;

  // Challenge expired or declined
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
            Torna alla Home
          </button>
        </div>
      </div>
    );
  }

  // Creator viewing - waiting for opponent
  if (isCreator && challenge?.status === 'pending') {
    return (
      <div className="min-h-screen bg-[#121212] text-white font-sans">
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
              La tua Sfida
            </h1>
            <div className="w-9" />
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="w-24 h-24 bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-purple-500/30">
              <Clock className="w-12 h-12 text-purple-400 animate-pulse" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2">
              In attesa di un avversario
            </h2>
            <p className="text-zinc-400">
              Condividi il link per sfidare un amico!
            </p>
          </motion.div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-zinc-400" />
                <span className="text-zinc-400">Creata da</span>
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

          {/* Share link section */}
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-4 mb-6">
            <p className="text-purple-300 text-sm font-medium mb-3">Condividi questo link:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={`https://istintopuro.com/sfida/${token}`}
                readOnly
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <button
                onClick={() => navigator.clipboard.writeText(`https://istintopuro.com/sfida/${token}`)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold transition-colors"
              >
                Copia
              </button>
            </div>
          </div>

          <button
            onClick={onBack}
            className="w-full text-center text-zinc-500 hover:text-zinc-400 underline py-2"
          >
            Torna alla Home
          </button>
        </div>
      </div>
    );
  }

  // Creator viewing - opponent accepted!
  if (isCreator && challenge?.status === 'accepted' && challenge?.roomId && challenge?.opponentId) {
    return (
      <div className="min-h-screen bg-[#121212] text-white font-sans">
        <div className="sticky top-0 bg-[#121212]/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-4">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <button
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Check className="text-green-400 w-5 h-5" />
              Sfida Accettata!
            </h1>
            <div className="w-9" />
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="w-24 h-24 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-green-500/30">
              <User className="w-12 h-12 text-green-400" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2">
              {challenge.opponentName} ha accettato!
            </h2>
            <p className="text-zinc-400">
              La sfida è iniziata, preparati a giocare!
            </p>
          </motion.div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-zinc-400" />
                <span className="text-zinc-400">Il tuo avversario</span>
              </div>
              <span className="font-bold text-green-400">{challenge.opponentName}</span>
            </div>
          </div>

          <button
            onClick={handleStartGame}
            className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 text-white font-bold text-xl py-4 px-10 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all"
          >
            <Play className="w-6 h-6" />
            <span>Inizia a Giocare</span>
          </button>
        </div>
      </div>
    );
  }

  // Visitor accepting - show accept button
  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans">
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
              <span className="text-zinc-400">Creato il</span>
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