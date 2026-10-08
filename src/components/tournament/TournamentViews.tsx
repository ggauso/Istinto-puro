import { useState, type FormEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Trophy, Crown, Plus, Trash2, Clock, LogOut, ChevronDown, Check, CalendarClock } from 'lucide-react';
import type { TournamentDetailState } from './useTournaments';
import type { Tournament, TournamentHistoryEntry, TournamentMatch } from '../../lib/api/tournaments';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { DifficultySelector, type DifficultyOption } from '../ui/DifficultySelector';
import { LeagueFlag, LEAGUE_NAMES, type LeagueKey } from '../ui/LeagueFlag';
import { BottomSheet } from '../ui/BottomSheet';
import { EmptyState } from '../ui/EmptyState';
import { ListRow, RowAvatar } from '../ui/ListRow';
import { TierBadge } from '../TierBadge';
import { PitchSkeleton } from '../ui/loaders/PitchSkeleton';
import { cn } from '../../lib/cn';

// Bridge stringa↔LeagueKey: il backend tornei usa codici testuali
// (seria_a/premier/...), distinti dagli id numerici API-Football usati da
// LeagueFlag — stesso pattern già stabilito in ChallengeFriendModal.
const LEAGUE_OPTIONS: { code: string; flagKey: LeagueKey; label: string }[] = [
  { code: 'all', flagKey: 'all', label: 'Tutti i campionati' },
  { code: 'seria_a', flagKey: 135, label: LEAGUE_NAMES[135] },
  { code: 'premier', flagKey: 39, label: LEAGUE_NAMES[39] },
  { code: 'la_liga', flagKey: 140, label: LEAGUE_NAMES[140] },
  { code: 'bundesliga', flagKey: 78, label: LEAGUE_NAMES[78] },
  { code: 'ligue_1', flagKey: 61, label: LEAGUE_NAMES[61] },
];
function leagueOption(code: string) {
  return LEAGUE_OPTIONS.find((o) => o.code === code) ?? LEAGUE_OPTIONS[1];
}

// Solo 3 livelli esistono davvero per i tornei (a differenza dei 4 di
// HomeScreen) — "Difficile" diventa ember solo da selezionato, coerente con
// `crea-torneo.html`.
const DIFFICULTY_OPTIONS: DifficultyOption<number>[] = [
  { value: 1, label: 'Facile', tone: 'volt' },
  { value: 2, label: 'Medio', tone: 'volt' },
  { value: 3, label: 'Difficile', tone: 'ember' },
];
const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Facile', 2: 'Medio', 3: 'Difficile' };

function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Pallino-slot dimensionato per numero di giocatori — stessa regola di `crea-torneo.html` (28/22/16px). */
function seatSlotSize(maxPlayers: number): number {
  return maxPlayers === 16 ? 16 : maxPlayers === 8 ? 22 : 28;
}

/** Tag informativo non interattivo (lega/difficoltà/modalità avvio) — 28px, più basso del `Chip` filtro (40px). */
function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="cond flex h-7 items-center gap-1.5 rounded-np-pill bg-turf-2 px-2.5 text-[11px] text-chalk-2">
      {children}
    </span>
  );
}

/** Fila di pallini posto occupato/libero (volt pieno / dashed) con overflow oltre i primi 5. */
function SeatSlots({ current, max }: { current: number; max: number }) {
  const visible = Math.min(max, 5);
  const overflow = max - visible;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: visible }, (_, i) => (
        <span
          key={i}
          className="shrink-0 rounded-full"
          style={
            i < current
              ? { width: 18, height: 18, background: 'var(--color-volt)' }
              : { width: 18, height: 18, border: '1.5px dashed rgba(243,245,238,.25)' }
          }
        />
      ))}
      {overflow > 0 && <span className="mono text-[11px] text-label">+{overflow}</span>}
    </div>
  );
}

// =====================================================================
// Lista tornei disponibili
// =====================================================================
function TournamentCard({
  tournament, index, isCreator, onOpenDetail, onCancel, onJoin, joining,
}: {
  tournament: Tournament;
  index: number;
  isCreator: boolean;
  onOpenDetail: () => void;
  onCancel: () => void;
  onJoin: () => void;
  joining: boolean;
}) {
  const league = leagueOption(tournament.league);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onOpenDetail}
      className="lift flex cursor-pointer flex-col gap-3.5 rounded-np-lg border border-white/[.07] bg-turf-1 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[16px] font-bold">{tournament.name}</span>
          <span className="text-xs text-chalk-2">creato da {tournament.creator_nickname}</span>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {tournament.start_mode === 'scheduled' && tournament.scheduled_at ? (
            <span className="cond flex h-[26px] items-center gap-1.5 rounded-np-pill bg-turf-2 px-2.5 text-[11px] text-chalk">
              <Clock className="h-3 w-3" />
              <span className="mono tracking-normal">{formatScheduledAt(tournament.scheduled_at)}</span>
            </span>
          ) : (
            <span className="cond flex h-[26px] items-center gap-1.5 rounded-np-pill bg-volt/[.12] px-2.5 text-[11px] text-volt">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-volt" />
              Aperto
            </span>
          )}
          {isCreator && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              aria-label="Cancella torneo"
              className="press -m-1 p-1 text-label hover:text-ember-light"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <MetaChip>
          <LeagueFlag league={league.flagKey} variant="chip" className="rounded-full" />
          {league.label}
        </MetaChip>
        <MetaChip>{DIFFICULTY_LABELS[tournament.difficulty] ?? tournament.difficulty}</MetaChip>
        <MetaChip>{tournament.start_mode === 'scheduled' ? 'Data e ora' : 'Al riempimento'}</MetaChip>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <SeatSlots current={tournament.current_players} max={tournament.max_players} />
          <span className="mono text-[13px] text-chalk-2">
            {tournament.current_players}/{tournament.max_players}
          </span>
        </div>
        <Button
          variant="chalk"
          size="sm"
          loading={joining}
          onClick={(e) => {
            e.stopPropagation();
            onJoin();
          }}
        >
          Iscriviti
        </Button>
      </div>
    </motion.article>
  );
}

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
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onCreateClick}
        className="btn relative flex h-[150px] items-center justify-between overflow-hidden rounded-np-hero bg-volt p-5 text-left text-ink"
      >
        <span className="relative z-10 flex flex-col gap-2.5">
          <span className="disp text-[30px]">
            Crea
            <br />
            torneo
          </span>
          <span className="text-[13px] font-semibold">2 · 4 · 8 · 16 giocatori</span>
        </span>
        <svg
          width="120"
          height="110"
          viewBox="0 0 120 110"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          aria-hidden="true"
          className="pointer-events-none absolute right-[76px] top-5 opacity-[.22]"
        >
          <path className="br" d="M0 10h24v20H0M0 50h24V30" />
          <path className="br" d="M0 70h24v20H0M24 80V70" />
          <path className="br br2" d="M24 20h22v60H24M46 50h22" />
          <path className="br br3" d="M68 50h22" />
        </svg>
        <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-volt">
          <Plus className="plus h-6 w-6" strokeWidth={2.6} />
        </span>
      </button>

      <div className="cond flex items-center justify-between text-xs text-label">
        <span>Iscrizioni aperte</span>
        <span className="mono">{tournaments.length}</span>
      </div>

      {loading ? (
        <PitchSkeleton rows={3} rowHeight={150} />
      ) : tournaments.length > 0 ? (
        <div className="flex flex-col gap-3">
          {tournaments.map((t, i) => (
            <TournamentCard
              key={t.id}
              tournament={t}
              index={i}
              isCreator={t.creator_id === currentUserId}
              onOpenDetail={() => onOpenDetail(t.id)}
              onCancel={() => onCancel(t.id)}
              onJoin={() => onJoin(t.id)}
              joining={joining}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="Nessun torneo aperto"
          subtitle="Creane uno per iniziare a giocare con gli amici."
        />
      )}
    </div>
  );
}

// =====================================================================
// Form creazione torneo
// =====================================================================
export function TournamentCreateForm({
  creating, error, onSubmit,
}: {
  creating: boolean;
  error: string | null;
  onSubmit: (
    name: string, maxPlayers: number, league: string, difficulty: number,
    startMode: 'fill' | 'scheduled', scheduledAt: string | null
  ) => void;
}) {
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [leagueCode, setLeagueCode] = useState('seria_a');
  const [showLeagueSheet, setShowLeagueSheet] = useState(false);
  const [startMode, setStartMode] = useState<'fill' | 'scheduled'>('fill');
  const [scheduledAt, setScheduledAt] = useState('');
  const [difficulty, setDifficulty] = useState(1);

  // Valore minimo per il datetime-local: tra 5 minuti da ora, nel fuso
  // orario locale del browser (toISOString userebbe UTC, sfasando il campo).
  const minScheduledAt = (() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  const rounds = Math.log2(maxPlayers);
  const roundsLabel = rounds === 1 ? '1 turno · finale secca' : `${rounds} turni a eliminazione`;
  const slotSize = seatSlotSize(maxPlayers);
  const league = leagueOption(leagueCode);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const iso = startMode === 'scheduled' && scheduledAt ? new Date(scheduledAt).toISOString() : null;
    if (startMode === 'scheduled' && !iso) return;
    onSubmit(trimmed, maxPlayers, leagueCode, difficulty, startMode, iso);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4.5">
      <Field
        shape="answer"
        placeholder="Nome · es. Torneo del venerdì"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        required
      />

      <section className="flex flex-col gap-3.5 rounded-np-lg bg-turf-1 p-4">
        <div className="flex items-baseline justify-between">
          <span className="cond text-[11px] text-label">Giocatori</span>
          <span className="mono text-xs text-chalk-2">{roundsLabel}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[2, 4, 8, 16].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMaxPlayers(n)}
              className={cn(
                'chip disp flex h-13 items-center justify-center rounded-np-md text-[22px]',
                maxPlayers === n ? 'bg-volt text-ink' : 'bg-turf-2 text-chalk-2'
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex min-h-7 flex-wrap items-center gap-1.5">
          {Array.from({ length: maxPlayers }, (_, i) => (
            <span
              key={i}
              className="slot-pop shrink-0 rounded-full border-[1.5px] border-dashed border-volt/50"
              style={{ width: slotSize, height: slotSize, animationDelay: `${i * 0.03}s` }}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="cond text-[11px] text-label">Campionato</span>
        <button
          type="button"
          onClick={() => setShowLeagueSheet(true)}
          className="press flex h-14 items-center gap-3 rounded-np-md border-[1.5px] border-white/[.08] bg-turf-1 px-4 text-left"
        >
          <LeagueFlag league={league.flagKey} variant="tile" />
          <span className="flex-1 text-[16px] font-semibold">{league.label}</span>
          <ChevronDown className="h-[18px] w-[18px] text-chalk-2" />
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <span className="cond text-[11px] text-label">Avvio</span>
        <div className="grid grid-cols-2 gap-1.5 rounded-np-md bg-turf-1 p-[5px]">
          <button
            type="button"
            onClick={() => setStartMode('fill')}
            className={cn(
              'chip flex h-11 items-center justify-center rounded-[14px] text-sm font-semibold',
              startMode === 'fill' ? 'bg-chalk text-ink' : 'bg-transparent text-chalk-2'
            )}
          >
            Al riempimento
          </button>
          <button
            type="button"
            onClick={() => setStartMode('scheduled')}
            className={cn(
              'chip flex h-11 items-center justify-center rounded-[14px] text-sm font-semibold',
              startMode === 'scheduled' ? 'bg-chalk text-ink' : 'bg-transparent text-chalk-2'
            )}
          >
            Data e ora
          </button>
        </div>
        {startMode === 'scheduled' && (
          <div className="reveal-down flex flex-col gap-1.5">
            <Field
              type="datetime-local"
              icon={<CalendarClock className="h-[18px] w-[18px] text-volt" />}
              value={scheduledAt}
              min={minScheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="mono"
            />
            <span className="text-xs leading-[1.45] text-chalk-2">
              Con almeno 2 iscritti all'orario previsto il torneo parte comunque.
            </span>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <span className="cond text-[11px] text-label">Difficoltà</span>
        <DifficultySelector options={DIFFICULTY_OPTIONS} value={difficulty} onChange={(v) => setDifficulty(v)} />
      </section>

      {error && (
        <div className="rounded-np-md border border-ember/40 bg-ember/10 p-3 text-center text-sm text-ember-light">
          {error}
        </div>
      )}

      <div className="flex-1" />

      <Button type="submit" variant="volt" loading={creating} className="w-full">
        <Trophy className="h-5 w-5" />
        Crea torneo
      </Button>

      <BottomSheet open={showLeagueSheet} onClose={() => setShowLeagueSheet(false)}>
        <div className="flex flex-col gap-1 px-4 pb-6 pt-2">
          <h3 className="cond px-2 pb-2 text-[11px] text-label">Scegli campionato</h3>
          {LEAGUE_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => {
                setLeagueCode(opt.code);
                setShowLeagueSheet(false);
              }}
              className={cn(
                'row-hover flex h-13 items-center gap-3 rounded-np-md px-3 text-left',
                leagueCode === opt.code && 'bg-turf-2'
              )}
            >
              <LeagueFlag league={opt.flagKey} variant="tile" />
              <span className="flex-1 text-[15px] font-semibold">{opt.label}</span>
              {leagueCode === opt.code && <Check className="h-4 w-4 text-volt" />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </form>
  );
}

// =====================================================================
// Bracket (albero round/match)
// =====================================================================
export function TournamentBracketView({ matches, currentUserId }: { matches: TournamentMatch[]; currentUserId: string | undefined }) {
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);

  return (
    <div className="rail -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {rounds.map((round) => (
        <div key={round} className="flex w-44 shrink-0 flex-col gap-2.5">
          <span className="cond text-center text-[11px] text-label">
            {round === rounds[rounds.length - 1] ? 'Finale' : `Round ${round}`}
          </span>
          {matches
            .filter((m) => m.round === round)
            .sort((a, b) => a.match_number - b.match_number)
            .map((m) => {
              const involvesMe = m.player1_id === currentUserId || m.player2_id === currentUserId;
              return (
                <div
                  key={m.id}
                  className={cn(
                    'flex flex-col gap-1 rounded-np-md border p-2.5 text-sm',
                    involvesMe ? 'border-volt/50 bg-volt/[.08]' : 'border-white/[.07] bg-turf-1'
                  )}
                >
                  <div className={cn('flex items-center justify-between', m.winner_id === m.player1_id ? 'font-bold text-volt' : 'text-chalk-2')}>
                    <span className="truncate">{m.player1_nickname || 'TBD'}</span>
                    {m.status === 'completed' && <span className="mono">{m.player1_score}</span>}
                  </div>
                  <div className="h-px bg-white/[.07]" />
                  <div className={cn('flex items-center justify-between', m.winner_id === m.player2_id ? 'font-bold text-volt' : 'text-chalk-2')}>
                    <span className="truncate">{m.player2_nickname || 'TBD'}</span>
                    {m.status === 'completed' && <span className="mono">{m.player2_score}</span>}
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
const STATUS_LABELS: Record<string, string> = {
  open: 'Iscrizioni aperte',
  in_progress: 'In corso',
  completed: 'Completato',
  cancelled: 'Annullato',
};

export function TournamentDetailView({
  detail, currentUserId, joining, onJoin, onLeave, onCancel,
}: {
  detail: TournamentDetailState;
  currentUserId: string | undefined;
  joining: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onCancel: () => void;
}) {
  const { tournament, participants, matches } = detail;
  const isParticipant = participants.some((p) => p.user_id === currentUserId);
  const isCreator = tournament.creator_id === currentUserId;
  const league = leagueOption(tournament.league);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3.5 rounded-np-lg border border-white/[.07] bg-turf-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="disp flex-1 text-[22px]" style={{ fontStretch: '110%' }}>
            {tournament.name}
          </h2>
          <span
            className={cn(
              'cond flex h-7 shrink-0 items-center rounded-np-pill px-2.5 text-[11px]',
              tournament.status === 'open' ? 'bg-volt/[.12] text-volt' : 'bg-turf-2 text-chalk-2'
            )}
          >
            {STATUS_LABELS[tournament.status] ?? tournament.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <MetaChip>
            <LeagueFlag league={league.flagKey} variant="chip" className="rounded-full" />
            {league.label}
          </MetaChip>
          <MetaChip>{DIFFICULTY_LABELS[tournament.difficulty] ?? tournament.difficulty}</MetaChip>
          <MetaChip>{tournament.max_players} giocatori</MetaChip>
        </div>

        {tournament.status === 'open' && tournament.start_mode === 'scheduled' && tournament.scheduled_at && (
          <div className="mono flex items-center gap-1.5 text-xs text-chalk-2">
            <Clock className="h-3.5 w-3.5" />
            Parte il {formatScheduledAt(tournament.scheduled_at)} (o prima, se si riempie)
          </div>
        )}

        {tournament.status === 'open' && (
          <div className="flex flex-wrap gap-2 pt-1">
            {isCreator && (
              <Button variant="text-ember" size="sm" onClick={onCancel}>
                <Trash2 className="h-4 w-4" />
                Cancella torneo
              </Button>
            )}
            {isParticipant ? (
              <Button variant="ghost" size="sm" onClick={onLeave}>
                <LogOut className="h-4 w-4" />
                Abbandona iscrizione
              </Button>
            ) : (
              <Button variant="volt" size="sm" loading={joining} onClick={onJoin}>
                Iscriviti
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="cond text-[11px] text-label">
          Iscritti ({participants.length}/{tournament.max_players})
        </span>
        <div className="flex flex-col gap-1.5">
          {participants.map((p) => (
            <ListRow
              key={p.user_id}
              leading={<TierBadge tier={p.tier} showLabel={false} size="sm" />}
              title={p.nickname}
              trailing={
                p.status === 'winner' ? (
                  <Crown className="h-4 w-4 text-volt" />
                ) : p.status === 'eliminated' && p.final_position ? (
                  <span className="mono text-xs text-label">#{p.final_position}</span>
                ) : undefined
              }
            />
          ))}
        </div>
      </div>

      {matches.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="cond text-[11px] text-label">Bracket</span>
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
    return <PitchSkeleton rows={4} rowHeight={64} />;
  }

  if (history.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="h-6 w-6" />}
        title="Nessun torneo ancora completato"
        subtitle="Partecipa a un torneo per vederlo qui."
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {history.map((h) => (
        <ListRow
          key={h.tournament_id}
          leading={
            <RowAvatar tone={h.final_position === 1 ? 'volt' : 'neutral'} shape="circle">
              <Trophy className="h-5 w-5" />
            </RowAvatar>
          }
          title={h.name}
          subtitle={`${h.max_players} giocatori`}
          trailing={
            h.final_position === 1 ? (
              <span className="mono text-sm font-bold text-volt">1°</span>
            ) : (
              <span className="mono text-sm font-bold text-chalk-2">#{h.final_position ?? '–'}</span>
            )
          }
        />
      ))}
    </div>
  );
}
