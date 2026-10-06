import { useEffect, useState } from 'react';
import { useAuthStore } from '../../authStore';
import { getMatchHistory, type MatchHistoryEntry, type MatchHistoryMode, type MatchHistoryResult } from '../../lib/api/match-history';
import { TierBadge } from '../TierBadge';
import { Swords, Bot, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PAGE_SIZE = 20;

const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Facile', 2: 'Medio', 3: 'Difficile' };

export function ProfileHistoryTab() {
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<MatchHistoryEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [modeFilter, setModeFilter] = useState<MatchHistoryMode | null>(null);
  const [resultFilter, setResultFilter] = useState<MatchHistoryResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getMatchHistory(user.id, { limit: PAGE_SIZE, offset: page * PAGE_SIZE, mode: modeFilter, result: resultFilter })
      .then(({ entries, totalCount }) => {
        setEntries(entries);
        setTotalCount(totalCount);
      })
      .finally(() => setLoading(false));
  }, [user, page, modeFilter, resultFilter]);

  // Un cambio di filtro invalida la pagina corrente (potrebbe non esistere
  // più nel risultato filtrato) — si riparte sempre dalla prima.
  const changeModeFilter = (value: MatchHistoryMode | null) => {
    setModeFilter(value);
    setPage(0);
  };
  const changeResultFilter = (value: MatchHistoryResult | null) => {
    setResultFilter(value);
    setPage(0);
  };

  if (!user) return null;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-4 py-3">
        <span className="text-zinc-300 text-sm font-medium">Partite giocate</span>
        <span className="text-white font-bold">{totalCount}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterGroup
          label="Modalità"
          value={modeFilter}
          onChange={changeModeFilter}
          options={[
            { value: null, label: 'Tutte' },
            { value: 'pvp', label: 'PvP' },
            { value: 'ai', label: 'IA' },
          ]}
        />
        <FilterGroup
          label="Risultato"
          value={resultFilter}
          onChange={changeResultFilter}
          options={[
            { value: null, label: 'Tutti' },
            { value: 'win', label: 'Vittorie' },
            { value: 'loss', label: 'Sconfitte' },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">
          Nessuna partita trovata con questi filtri.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`rounded-xl border overflow-hidden ${
                  entry.is_win ? 'border-green-500/20 bg-green-900/10' : 'border-red-500/20 bg-red-900/10'
                }`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  {entry.is_pvp ? (
                    <Swords className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  ) : (
                    <Bot className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-sm ${entry.is_win ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.is_win ? 'Vittoria' : 'Sconfitta'}
                      </span>
                      <span className="text-zinc-500 text-xs truncate">vs {entry.opponent_name}</span>
                    </div>
                    <div className="text-zinc-500 text-xs">
                      {new Date(entry.played_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-white font-bold text-sm">{entry.player_score} - {entry.opponent_score}</div>
                  </div>

                  {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 pb-4 border-t border-white/5 pt-3 flex flex-wrap items-center gap-4 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Il tuo tier:</span>
                        <TierBadge tier={entry.player_tier} size="sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Tier avversario:</span>
                        <TierBadge tier={entry.opponent_tier} size="sm" />
                      </div>
                      <div className="text-zinc-400">
                        Difficoltà: <span className="text-white">{DIFFICULTY_LABELS[entry.difficulty] || entry.difficulty}</span>
                      </div>
                      <div className="text-zinc-400">
                        Modalità: <span className="text-white">{entry.is_pvp ? 'PvP' : 'Contro IA'}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-zinc-400 text-sm">Pagina {page + 1} di {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function FilterGroup<T extends string | null>({
  label, value, onChange, options
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-500 text-xs">{label}:</span>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={String(option.value)}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              value === option.value ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
