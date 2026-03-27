import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store';
import { useAuthStore } from '../authStore';
import { completeChallenge } from '../lib/rpc-client';
import { CircularTimer } from './CircularTimer';
import { TierBadge } from './TierBadge';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Flag, User, Bot } from 'lucide-react';

export function GameScreen() {
  const { 
    match, score, timeLeft, status, validatePlayer, tickTimer, 
    fetchMatchAndBroadcast, resetGame, findMatch, gameMode, correctAnswer, correctAnswerSeasons,
    round, playerRoundsWon, opponentRoundsWon, streak, lastScoreAdded, lastRarity, lastCombo, isHost,
    abandonMatch
  } = useGameStore();

  const renderSeasons = (seasons: number[] | undefined) => {
    if (!seasons) return 'N/D';
    const validSeasons = seasons.filter(s => s !== null && s !== undefined);
    return validSeasons.length > 0 ? validSeasons.join(', ') : 'N/D';
  };
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debug: log when match changes
  useEffect(() => {
    console.log('DEBUG match changed:', match);
  }, [match]);

  useEffect(() => {
    if (status === 'playing') {
      const interval = setInterval(() => {
        tickTimer();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, tickTimer]);

  useEffect(() => {
    if (status === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [status]);

  useEffect(() => {
    if (status === 'won' || status === 'opponent_won' || (status === 'lost' && gameMode === 'pvp')) {
      if (isHost) {
        const timer = setTimeout(() => {
          fetchMatchAndBroadcast();
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [status, isHost, gameMode, fetchMatchAndBroadcast]);

  useEffect(() => {
    const isGameOver = status === 'match_won' || status === 'match_lost' || (status === 'lost' && gameMode === 'ai');
    if (isGameOver) {
      // Mark challenge as completed when game ends
      const { currentChallengeId, gameMode: gm } = useGameStore.getState();
      if (currentChallengeId && gm === 'pvp') {
        completeChallenge(currentChallengeId).catch(console.error);
      }

      const timer = setTimeout(() => {
        resetGame();
        // Redirect to home
        window.location.href = '/';
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [status, gameMode, resetGame]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== 'playing') return;

    const isValid = await validatePlayer(input);
    if (isValid) {
      setInput('');
      setError(false);
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  };

  if (!match) {
    let loadingText = 'Preparazione match...';
    if (status === 'joining') loadingText = 'Connessione in corso...';
    else if (status === 'match_won') loadingText = 'Vittoria a tavolino! Ritorno alla home...';
    else if (status === 'match_lost') loadingText = 'Sconfitta. Ritorno alla home...';

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4 font-sans">
        {(status === 'joining' || status === 'starting') && (
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFD700]"></div>
        )}
        <p className="mt-6 text-[#FFD700] font-bold animate-pulse text-xl text-center">
          {loadingText}
        </p>
      </div>
    );
  }

  const totalTime = gameMode === 'ai' ? 15 : 10;
  const isGameOver = status === 'match_won' || status === 'match_lost' || (status === 'lost' && gameMode === 'ai');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4 font-sans">
      <div className="absolute top-4 left-4 flex flex-col">
        <div className="text-2xl font-bold text-[#FFD700]">
          Score: {score}
        </div>
        {streak >= 3 && (
          <div className="text-sm font-bold text-orange-500 flex items-center mt-1">
            🔥 Streak: {streak}
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-50">
        <div className="flex gap-2">
          {!isGameOver ? (
            <button
              onClick={() => setShowAbandonModal(true)}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors bg-black/50 px-3 py-2 rounded-full backdrop-blur-sm border border-red-500/20"
            >
              <Flag className="w-4 h-4" />
              <span className="text-sm font-bold">Abbandona</span>
            </button>
          ) : (
            <button
              onClick={resetGame}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors bg-black/50 px-3 py-2 rounded-full backdrop-blur-sm border border-white/10"
            >
              <Home className="w-4 h-4" />
              <span className="text-sm font-bold">Home</span>
            </button>
          )}
        </div>

        {gameMode === 'pvp' && (
          <div className="flex flex-col items-end mt-2">
            <div className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Round {round}</div>
            <div className="flex items-center space-x-2 mt-1">
              <div className={`w-3 h-3 rounded-full ${playerRoundsWon >= 1 ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
              <div className={`w-3 h-3 rounded-full ${playerRoundsWon >= 2 ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
              <span className="text-zinc-500 mx-2">-</span>
              <div className={`w-3 h-3 rounded-full ${opponentRoundsWon >= 2 ? 'bg-red-500' : 'bg-zinc-700'}`} />
              <div className={`w-3 h-3 rounded-full ${opponentRoundsWon >= 1 ? 'bg-red-500' : 'bg-zinc-700'}`} />
            </div>
            {/* Opponent Info */}
            <div className="flex items-center gap-2 mt-2 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-700">
              <User className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-300">
                {match?.opponent_name || 'Avversario'}
              </span>
              {match?.opponent_tier && (
                <TierBadge tier={match.opponent_tier} size="sm" showLabel={false} />
              )}
            </div>
          </div>
        )}

        {gameMode === 'ai' && (
          <div className="flex flex-col items-end mt-2">
            <div className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Round {round}</div>
            <div className="flex items-center gap-2 mt-2 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-700">
              <Bot className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-300">AI</span>
              <TierBadge tier="bronze" size="sm" showLabel={false} />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center space-y-8 w-full max-w-md">
        <CircularTimer timeLeft={timeLeft} totalTime={totalTime} />

        <div className="flex items-center justify-between w-full px-4">
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex flex-col items-center space-y-2"
          >
            <div className="w-24 h-24 bg-zinc-800 rounded-2xl flex items-center justify-center p-4 shadow-lg border border-zinc-700">
              <img src={match.team1_logo} alt={match.team1_name} className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-medium text-zinc-400">{match.team1_name}</span>
          </motion.div>

          <div className="text-3xl font-black text-zinc-600 italic">VS</div>

          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex flex-col items-center space-y-2"
          >
            <div className="w-24 h-24 bg-zinc-800 rounded-2xl flex items-center justify-center p-4 shadow-lg border border-zinc-700">
              <img src={match.team2_logo} alt={match.team2_name} className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-medium text-zinc-400">{match.team2_name}</span>
          </motion.div>
        </div>

        <form onSubmit={handleSubmit} className="w-full mt-8 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={status !== 'playing'}
            className={"w-full bg-zinc-900 border-2 rounded-xl px-6 py-4 text-xl text-center font-bold text-white outline-none transition-colors " + (error ? 'border-red-500' : 'border-zinc-700 focus:border-[#FFD700]')}
            placeholder="Nome del giocatore..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -bottom-8 left-0 right-0 text-center text-red-500 font-medium text-sm"
            >
              Sbagliato! Riprova.
            </motion.div>
          )}
        </form>

        {status === 'won' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center space-y-2"
          >
            <div className="text-2xl font-black text-emerald-400 uppercase tracking-widest">
              Corretto!
            </div>
            <div className="text-xl font-bold text-[#FFD700]">+{lastScoreAdded} pt</div>
            <div className="flex space-x-4 text-sm text-zinc-400 mt-2">
              <span>Rarità: x{lastRarity}</span>
              <span>Combo: x{lastCombo}</span>
            </div>
            {correctAnswerSeasons && (
              <div className="mt-4 text-sm text-zinc-300 bg-zinc-900/80 px-4 py-3 rounded-xl border border-zinc-700 shadow-lg w-full max-w-sm">
                <div className="flex justify-between gap-4 mb-1">
                  <span className="text-zinc-400">{match.team1_name}:</span>
                  <span className="font-mono text-zinc-200">{renderSeasons(correctAnswerSeasons.team1)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-400">{match.team2_name}:</span>
                  <span className="font-mono text-zinc-200">{renderSeasons(correctAnswerSeasons.team2)}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {status === 'opponent_won' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="text-3xl font-black text-red-500 uppercase tracking-widest text-center">
              Round Perso!<br/><span className="text-xl text-zinc-400">L'avversario è stato più veloce</span>
            </div>
            {correctAnswer && (
              <div className="text-lg text-zinc-300 text-center bg-zinc-900/80 px-6 py-4 rounded-xl border border-zinc-700 shadow-lg mt-2">
                <span className="block mb-1 text-sm uppercase tracking-wider text-zinc-400">Una risposta corretta era:</span>
                <span className="text-[#FFD700] font-bold text-2xl">{correctAnswer}</span>
                {correctAnswerSeasons && (
                  <div className="mt-3 flex flex-col gap-1 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-400">{match.team1_name}:</span>
                      <span className="font-mono text-zinc-200">{renderSeasons(correctAnswerSeasons.team1)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-400">{match.team2_name}:</span>
                      <span className="font-mono text-zinc-200">{renderSeasons(correctAnswerSeasons.team2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {status === 'lost' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="text-3xl font-black text-red-500 uppercase tracking-widest">
              Tempo Scaduto
            </div>
            {correctAnswer && (
              <div className="text-lg text-zinc-300 text-center bg-zinc-900/80 px-6 py-4 rounded-xl border border-zinc-700 shadow-lg">
                <span className="block mb-1 text-sm uppercase tracking-wider text-zinc-400">Una risposta corretta era:</span>
                <span className="text-[#FFD700] font-bold text-2xl">{correctAnswer}</span>
                {correctAnswerSeasons && (
                  <div className="mt-3 flex flex-col gap-1 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-400">{match.team1_name}:</span>
                      <span className="font-mono text-zinc-200">{renderSeasons(correctAnswerSeasons.team1)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-400">{match.team2_name}:</span>
                      <span className="font-mono text-zinc-200">{renderSeasons(correctAnswerSeasons.team2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {gameMode === 'ai' && (
              <button
                onClick={() => { resetGame(); findMatch(); }}
                className="bg-[#FFD700] text-black font-bold py-3 px-8 rounded-full text-lg hover:bg-yellow-400 transition-colors mt-4"
              >
                Riprova
              </button>
            )}
          </motion.div>
        )}

        {status === 'match_won' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="text-4xl font-black text-emerald-400 uppercase tracking-widest text-center">
              Vittoria!
            </div>
            <div className="text-lg font-medium text-emerald-500">Ultimo Round: +{lastScoreAdded} pt (Rarità x{lastRarity}, Combo x{lastCombo})</div>
            <div className="text-2xl font-bold text-[#FFD700] mt-2">Score Totale: {score}</div>
            <button
              onClick={() => { resetGame(); findMatch(); }}
              className="bg-[#FFD700] text-black font-bold py-3 px-8 rounded-full text-lg hover:bg-yellow-400 transition-colors mt-4"
            >
              Cerca Nuova Partita
            </button>
          </motion.div>
        )}

        {status === 'match_lost' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="text-4xl font-black text-red-500 uppercase tracking-widest text-center">
              Sconfitta!
            </div>
            <button
              onClick={() => { resetGame(); findMatch(); }}
              className="bg-[#FFD700] text-black font-bold py-3 px-8 rounded-full text-lg hover:bg-yellow-400 transition-colors mt-4"
            >
              Cerca Nuova Partita
            </button>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showAbandonModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1E1E1E] border border-red-500/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Flag className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Abbandonare?</h2>
              <p className="text-zinc-400 mb-6">
                Sei sicuro di voler abbandonare la partita? 
                {gameMode === 'pvp' ? ' Subirai una penalità di 50 punti.' : ' Perderai i progressi attuali.'}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowAbandonModal(false);
                    abandonMatch();
                    // Redirect to home after abandon
                    setTimeout(() => {
                      window.location.href = '/';
                    }, 1000);
                  }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  Sì, Abbandona
                </button>
                <button
                  onClick={() => setShowAbandonModal(false)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  Annulla
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
