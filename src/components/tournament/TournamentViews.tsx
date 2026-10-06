import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Trophy, Users, Loader2, Swords, Crown, X, LogOut, Plus, Trash2, Clock } from 'lucide-react';
import type { TournamentDetailState } from './useTournaments';
import type { Tournament, TournamentHistoryEntry, TournamentParticipant, TournamentMatch } from '../../lib/api/tournaments';

const LEAGUE_LABELS: Record<string, string> = {
  all: 'Tutti i Campionati 🌍',
  seria_a: 'Serie A 🇮🇹',
  premier: 'Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  la_liga: 'La Liga 🇪🇸',
  bundesliga: 'Bundesliga 🇩🇪',
  ligue_1: 'Ligue 1 🇫🇷',
};

const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Facile', 2: 'Medio', 3: 'Difficile' };

function TierIcon({ tier }: { tier: string }) {
  const icons: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🏆', platinum: '⭐', diamond: '💎' };
  return <span>{icons[tier] || '🥉'}</span>;
}

function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// =====================================================================
// Lista tornei disponibili
// =====================================================================
export function TournamentListView({
  tournaments, loading, joining, currentUserId, onJoin, onOpenDetail, onCancel, onCreateClick,
}: {
  tournaments: Tournament[];
  loading: boolean;
  joining: boolean;
  currentUserId: string | undefined;
  onJoin: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onCancel: (id: string) => void;
  onCreateClick: () => void;
}) {
  return (
    <div className="space-y-4">
      <button
        onClick={onCreateClick}
        className="w-full flex items-center justify-center gap-2 bg-[#FFD700] text-black font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Crea Torneo
      </button>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : tournaments.length > 0 ? (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onOpenDetail(t.id)}
              className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 cursor-pointer hover:border-purple-500/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-bold text-white">{t.name}</div>
                  <div className="text-xs text-zinc-400">by {t.creator_nickname}</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-right text-sm">
                    <div className="text-zinc-300">{LEAGUE_LABELS[t.league] || t.league}</div>
                    <div className="text-zinc-500">{DIFFICULTY_LABELS[t.difficulty] || t.difficulty}</div>
                  </div>
                  {t.creator_id === currentUserId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onCancel(t.id); }}
                      title="Cancella torneo"
                      className="text-zinc-500 hover:text-red-400 transition-colors p-1 -m-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {t.start_mode === 'scheduled' && t.scheduled_at && (
                <div className="flex items-center gap-1 text-xs text-purple-300 mb-2">
                  <Clock className="w-3.5 h-3.5" />
                  Parte il {formatScheduledAt(t.scheduled_at)}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Users className="w-4 h-4" />
                  {t.current_players}/{t.max_players} giocatori
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onJoin(t.id); }}
                  disabled={joining}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Iscriviti'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-center text-zinc-500 py-8">Nessun torneo aperto al momento. Creane uno!</p>
      )}
    </div>
  );
}

// =====================================================================
// Form creazione torneo
// =====================================================================
export function TournamentCreateForm({
  creating, error, onSubmit, onCancel,
}: {
  creating: boolean;
  error: string | null;
  onSubmit: (
    name: string, maxPlayers: number, league: string, difficulty: number,
    startMode: 'fill' | 'scheduled', scheduledAt: string | null
  ) => void;
  onCancel: () => void;
}) {
  const [startMode, setStartMode] = useState<'fill' | 'scheduled'>('fill');

  // Valore minimo per il datetime-local: tra 5 minuti da ora, nel fuso
  // orario locale del browser (toISOString userebbe UTC, sfasando il campo).
  const minScheduledAt = (() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = (form.get('name') as string)?.trim();
    if (!name) return;
    const mode = (form.get('startMode') as 'fill' | 'scheduled') || 'fill';
    const scheduledAtLocal = form.get('scheduledAt') as string;
    const scheduledAt = mode === 'scheduled' && scheduledAtLocal ? new Date(scheduledAtLocal).toISOString() : null;
    if (mode === 'scheduled' && !scheduledAt) return;
    onSubmit(
      name,
      Number(form.get('maxPlayers')),
      form.get('league') as string,
      Number(form.get('difficulty')),
      mode,
      scheduledAt
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-800/50 rounded-xl p-5 border border-purple-500/30 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Swords className="w-5 h-5 text-purple-400" />
          Nuovo Torneo
        </h3>
        <button onClick={onCancel} className="text-zinc-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Nome</label>
          <input
            name="name"
            type="text"
            required
            maxLength={60}
            placeholder="Es. Torneo del venerdì"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Giocatori</label>
          <div className="grid grid-cols-4 gap-2">
            {[2, 4, 8, 16].map((n) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name="maxPlayers" value={n} defaultChecked={n === 4} className="peer sr-only" />
                <div className="text-center py-2 rounded-lg bg-zinc-700 text-zinc-300 peer-checked:bg-purple-600 peer-checked:text-white transition-colors">
                  {n}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Campionato</label>
          <select name="league" defaultValue="seria_a" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500">
            {Object.entries(LEAGUE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Avvio torneo</label>
          <div className="grid grid-cols-2 gap-2">
            <label className="cursor-pointer">
              <input
                type="radio" name="startMode" value="fill" checked={startMode === 'fill'}
                onChange={() => setStartMode('fill')} className="peer sr-only"
              />
              <div className="text-center py-2 rounded-lg bg-zinc-700 text-zinc-300 peer-checked:bg-purple-600 peer-checked:text-white transition-colors text-sm">
                Al riempimento
              </div>
            </label>
            <label className="cursor-pointer">
              <input
                type="radio" name="startMode" value="scheduled" checked={startMode === 'scheduled'}
                onChange={() => setStartMode('scheduled')} className="peer sr-only"
              />
              <div className="text-center py-2 rounded-lg bg-zinc-700 text-zinc-300 peer-checked:bg-purple-600 peer-checked:text-white transition-colors text-sm">
                Data e ora
              </div>
            </label>
          </div>
        </div>

        {startMode === 'scheduled' && (
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Data e ora di inizio</label>
            <input
              name="scheduledAt"
              type="datetime-local"
              required
              min={minScheduledAt}
              defaultValue={minScheduledAt}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Se al momento schedulato ci sono almeno 2 iscritti, il torneo parte comunque, anche se non al completo.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Difficoltà</label>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((d) => (
              <label key={d} className="cursor-pointer">
                <input type="radio" name="difficulty" value={d} defaultChecked={d === 1} className="peer sr-only" />
                <div className="text-center py-2 rounded-lg bg-zinc-700 text-zinc-300 peer-checked:bg-purple-600 peer-checked:text-white transition-colors text-sm">
                  {DIFFICULTY_LABELS[d]}
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={creating}
          className="w-full flex items-center justify-center gap-2 bg-[#FFD700] text-black font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Crea Torneo'}
        </button>
      </form>
    </motion.div>
  );
}

// =====================================================================
// Bracket (albero round/match)
// =====================================================================
export function TournamentBracketView({ matches, currentUserId }: { matches: TournamentMatch[]; currentUserId: string | undefined }) {
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map((round) => (
        <div key={round} className="flex-shrink-0 w-48 space-y-3">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">
            {round === rounds[rounds.length - 1] ? 'Finale' : `Round ${round}`}
          </div>
          {matches.filter((m) => m.round === round).sort((a, b) => a.match_number - b.match_number).map((m) => {
            const involvesMe = m.player1_id === currentUserId || m.player2_id === currentUserId;
            return (
              <div
                key={m.id}
                className={`rounded-lg p-3 border text-sm ${involvesMe ? 'border-purple-400 bg-purple-900/20' : 'border-zinc-700 bg-zinc-800/50'}`}
              >
                <div className={`flex items-center justify-between py-1 ${m.winner_id === m.player1_id ? 'text-emerald-400 font-bold' : 'text-zinc-300'}`}>
                  <span className="truncate">{m.player1_nickname || 'TBD'}</span>
                  {m.status === 'completed' && <span>{m.player1_score}</span>}
                </div>
                <div className="h-px bg-zinc-700 my-1" />
                <div className={`flex items-center justify-between py-1 ${m.winner_id === m.player2_id ? 'text-emerald-400 font-bold' : 'text-zinc-300'}`}>
                  <span className="truncate">{m.player2_nickname || 'TBD'}</span>
                  {m.status === 'completed' && <span>{m.player2_score}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// Dettaglio torneo: info, iscritti, bracket
// =====================================================================
export function TournamentDetailView({
  detail, currentUserId, joining, onJoin, onLeave, onCancel, onBack,
}: {
  detail: TournamentDetailState;
  currentUserId: string | undefined;
  joining: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onCancel: () => void;
  onBack: () => void;
}) {
  const { tournament, participants, matches } = detail;
  const isParticipant = participants.some((p) => p.user_id === currentUserId);
  const isCreator = tournament.creator_id === currentUserId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-zinc-400 hover:text-white text-sm">← Indietro</button>
        <div className="flex items-center gap-3">
          {tournament.status === 'open' && isCreator && (
            <button onClick={onCancel} className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm">
              <Trash2 className="w-4 h-4" /> Cancella torneo
            </button>
          )}
          {tournament.status === 'open' && isParticipant && (
            <button onClick={onLeave} className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm">
              <LogOut className="w-4 h-4" /> Abbandona iscrizione
            </button>
          )}
          {tournament.status === 'open' && !isParticipant && (
            <button
              onClick={onJoin}
              disabled={joining}
              className="flex items-center gap-1 bg-[#FFD700] text-black font-bold px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
            >
              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Iscriviti'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
        <h3 className="text-xl font-bold text-white mb-1">{tournament.name}</h3>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span>{LEAGUE_LABELS[tournament.league] || tournament.league}</span>
          <span>•</span>
          <span>{DIFFICULTY_LABELS[tournament.difficulty] || tournament.difficulty}</span>
          <span>•</span>
          <span className="capitalize">{tournament.status.replace('_', ' ')}</span>
        </div>
        {tournament.status === 'open' && tournament.start_mode === 'scheduled' && tournament.scheduled_at && (
          <div className="flex items-center gap-1 text-xs text-purple-300 mt-2">
            <Clock className="w-3.5 h-3.5" />
            Parte il {formatScheduledAt(tournament.scheduled_at)} (o prima, se si riempie)
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
          Iscritti ({participants.length}/{tournament.max_players})
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {participants.map((p) => (
            <div key={p.user_id} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2 text-sm">
              <TierIcon tier={p.tier} />
              <span className="text-zinc-200 truncate flex-1">{p.nickname}</span>
              {p.status === 'winner' && <Crown className="w-4 h-4 text-[#FFD700]" />}
              {p.status === 'eliminated' && p.final_position && (
                <span className="text-xs text-zinc-500">#{p.final_position}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {matches.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Bracket</h4>
          <TournamentBracketView matches={matches} currentUserId={currentUserId} />
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Storico tornei
// =====================================================================
export function TournamentHistoryView({ history, loading }: { history: TournamentHistoryEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (history.length === 0) {
    return <p className="text-center text-zinc-500 py-8">Nessun torneo ancora completato.</p>;
  }

  return (
    <div className="space-y-2">
      {history.map((h) => (
        <div key={h.tournament_id} className="flex items-center justify-between bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
          <div>
            <div className="font-medium text-white">{h.name}</div>
            <div className="text-xs text-zinc-500">{h.max_players} giocatori</div>
          </div>
          <div className="flex items-center gap-2">
            {h.final_position === 1 ? (
              <span className="flex items-center gap-1 text-[#FFD700] font-bold"><Trophy className="w-4 h-4" /> 1°</span>
            ) : (
              <span className="text-zinc-400 font-bold">#{h.final_position}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
