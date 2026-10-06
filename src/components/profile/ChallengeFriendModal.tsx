import { Zap, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export interface ChallengeModalState {
  friendId: string;
  friendName: string;
  friendTier: string;
  difficulty: number;
  league: string;
}

interface ChallengeFriendModalProps {
  challengeModal: ChallengeModalState;
  creatingChallenge: boolean;
  onChange: (next: ChallengeModalState) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

const DIFFICULTIES = [
  { value: 1, label: 'Facile', color: 'bg-green-600' },
  { value: 2, label: 'Medio', color: 'bg-yellow-600' },
  { value: 3, label: 'Difficile', color: 'bg-red-600' }
];

export function ChallengeFriendModal({ challengeModal, creatingChallenge, onChange, onCancel, onSubmit }: ChallengeFriendModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#1E1E1E] border border-yellow-500/30 rounded-3xl p-6 max-w-sm w-full"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Sfida {challengeModal.friendName}</h2>
          <p className="text-zinc-400 mt-2">Configura la tua sfida</p>
        </div>

        {/* Difficulty Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-400 mb-2">Difficoltà</label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((diff) => (
              <button
                key={diff.value}
                onClick={() => onChange({ ...challengeModal, difficulty: diff.value })}
                className={`py-2 rounded-lg font-medium transition-colors ${
                  challengeModal.difficulty === diff.value
                    ? diff.color + ' text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {diff.label}
              </button>
            ))}
          </div>
        </div>

        {/* League Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-400 mb-2">Campionato</label>
          <select
            value={challengeModal.league}
            onChange={(e) => onChange({ ...challengeModal, league: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-yellow-500"
          >
            <option value="all">Tutti i Campionati</option>
            <option value="seria_a">Serie A 🇮🇹</option>
            <option value="premier">Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿</option>
            <option value="la_liga">La Liga 🇪🇸</option>
            <option value="bundesliga">Bundesliga 🇩🇪</option>
            <option value="ligue_1">Ligue 1 🇫🇷</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-bold text-white bg-zinc-700 hover:bg-zinc-600 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={onSubmit}
            disabled={creatingChallenge}
            className="flex-1 py-3 rounded-xl font-bold text-black bg-yellow-500 hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creatingChallenge ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Invia Sfida
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
