import { useEffect, useState } from 'react';
import { useAuthStore } from '../../authStore';
import { getMatchHistory, type MatchHistoryEntry, type MatchHistoryMode, type MatchHistoryResult } from '../../lib/api/match-history';
import { TierBadge } from '../TierBadge';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { PitchSkeleton } from '../ui/loaders/PitchSkeleton';
import { ChevronDown, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

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
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-1.5">
        {([
          { value: null, label: 'Tutte' },
          { value: 'pvp', label: 'PvP' },
          { value: 'ai', label: 'IA' },
        ] as { value: MatchHistoryMode | null; label: string }[]).map((opt) => (
          <Chip key={String(opt.value)} selected={modeFilter === opt.value} onClick={() => changeModeFilter(opt.value)}>
            {opt.label}
          </Chip>
        ))}
        <span className="mx-1 w-px self-stretch bg-white/10" />
        {([
          { value: null, label: 'Tutti' },
          { value: 'win', label: 'Vittorie' },
          { value: 'loss', label: 'Sconfitte' },
        ] as { value: MatchHistoryResult | null; label: string }[]).map((opt) => (
          <Chip key={String(opt.value)} selected={resultFilter === opt.value} onClick={() => changeResultFilter(opt.value)}>
            {opt.label}
          </Chip>
        ))}
      </div>

      {loading ? (
        <PitchSkeleton rows={4} rowHeight={56} />
      ) : entries.length === 0 ? (
        <EmptyState icon={<History className="h-6 w-6" />} title="Nessuna partita trovata" subtitle="Prova a cambiare i filtri." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="overflow-hidden rounded-np-lg bg-turf-1">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="row-hover flex w-full items-center gap-3 py-2.5 pl-2.5 pr-3.5 text-left"
                >
                  <span
                    className={`disp flex h-11 w-11 shrink-0 items-center justify-center rounded-np-md text-lg ${
                      entry.is_win ? 'bg-volt text-ink' : 'bg-turf-3 text-chalk-2'
                    }`}
                  >
                    {entry.is_win ? 'V' : 'S'}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold">vs {entry.opponent_name}</span>
                    <span className="mono truncate text-[11px] text-label">
                      {new Date(entry.played_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase()} ·{' '}
                      {new Date(entry.played_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · {entry.is_pvp ? 'PvP' : 'IA'}
                    </span>
                  </div>
                  <span className="mono text-[15px] font-semibold text-chalk-2">
                    {entry.player_score}–{entry.opponent_score}
                  </span>
                  <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-4 w-4 shrink-0 text-label" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-wrap items-center gap-3.5 px-3.5 pb-3.5 pt-1 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-label">Tu:</span>
                        <TierBadge tier={entry.player_tier} size="sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-label">Avversario:</span>
                        <TierBadge tier={entry.opponent_tier} size="sm" />
                      </div>
                      <div className="text-chalk-2">
                        Difficoltà: <span className="text-chalk">{DIFFICULTY_LABELS[entry.difficulty] || entry.difficulty}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button variant="icon-neutral" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Pagina precedente">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="mono text-xs text-chalk-2">
            Pagina {page + 1} di {totalPages}
          </span>
          <Button variant="icon-neutral" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} aria-label="Pagina successiva">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
