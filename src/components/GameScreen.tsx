import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store';
import { CircularTimer } from './CircularTimer';
import { motion } from 'motion/react';

export function GameScreen() {
  const { match, score, timeLeft, status, validatePlayer, tickTimer, fetchMatchAndBroadcast, resetGame, findMatch, gameMode, correctAnswer } = useGameStore();
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== 'playing') return;

    const isValid = await validatePlayer(input);
    if (isValid) {
      setInput('');
      setError(false);
      // Wait a bit, then fetch next match
      setTimeout(() => {
        fetchMatchAndBroadcast();
      }, 1500);
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  };

  if (!match) return null;

  const totalTime = gameMode === 'ai' ? 15 : 10;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4 font-sans">
      <div className="absolute top-4 left-4 text-2xl font-bold text-[#FFD700]">
        Score: {score}
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
            className="text-2xl font-black text-emerald-400 uppercase tracking-widest"
          >
            Corretto!
          </motion.div>
        )}

        {status === 'opponent_won' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="text-3xl font-black text-red-500 uppercase tracking-widest text-center">
              Hai Perso!<br/><span className="text-xl text-zinc-400">L'avversario è stato più veloce</span>
            </div>
            <button
              onClick={() => { resetGame(); findMatch(); }}
              className="bg-[#FFD700] text-black font-bold py-3 px-8 rounded-full text-lg hover:bg-yellow-400 transition-colors"
            >
              Cerca Nuova Partita
            </button>
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
            {gameMode === 'ai' && correctAnswer && (
              <div className="text-lg text-zinc-300 text-center bg-zinc-900/80 px-6 py-4 rounded-xl border border-zinc-700 shadow-lg">
                <span className="block mb-1 text-sm uppercase tracking-wider text-zinc-400">Una risposta corretta era:</span>
                <span className="text-[#FFD700] font-bold text-2xl">{correctAnswer}</span>
              </div>
            )}
            <button
              onClick={() => { resetGame(); findMatch(); }}
              className="bg-[#FFD700] text-black font-bold py-3 px-8 rounded-full text-lg hover:bg-yellow-400 transition-colors mt-4"
            >
              Cerca Nuova Partita
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
