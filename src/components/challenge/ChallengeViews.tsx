import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Trophy, User, Check, Clock, Play, Send, X, ArrowLeft } from 'lucide-react';
import type { ChallengeViewState } from './useChallenge';
import { LEAGUE_TEXT_TO_ID } from '../../lib/api/friend-challenges';
import { LEAGUE_NAMES, type LeagueKey } from '../ui/LeagueFlag';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { EmptyState } from '../ui/EmptyState';
import { BallBounceLoader } from '../ui/loaders/BallBounceLoader';
import { appUrl } from '../../lib/paths';
import { cn } from '../../lib/cn';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Pill "in attesa" + countdown mono live fino a `expiresAt` — sostituisce la sola data statica di scadenza, stesso pattern eyebrow+timer di `home-ricerca-avversario.html` ("Matchmaking · 00:07"). */
function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <div className="flex w-full items-center justify-between">
      <span className="cond flex items-center gap-2 text-[11px] text-volt">
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-volt" />
        In attesa
      </span>
      <span className="mono text-xs text-chalk-2">{remaining > 0 ? `Scade tra ${formatCountdown(remaining)}` : 'Scaduta'}</span>
    </div>
  );
}

const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Facile', 2: 'Medio', 3: 'Difficile' };

/** Solo le sfide tra amici portano `league`/`difficulty` (vedi `useChallenge.ts`); il codice testuale si converte in nome via la stessa mappa già usata altrove per avviare la partita. */
function leagueLabel(code?: string): string | undefined {
  if (!code) return undefined;
  if (code === 'all') return LEAGUE_NAMES.all;
  const id = LEAGUE_TEXT_TO_ID[code];
  return id ? LEAGUE_NAMES[id as LeagueKey] : code;
}

function ChallengeHeader({ icon, title, onBack }: { icon: ReactNode; title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-3 px-4 pt-12">
      <button
        type="button"
        onClick={onBack}
        aria-label="Indietro"
        className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-turf-1"
      >
        <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </button>
      <h1 className="disp flex min-w-0 flex-1 items-center gap-2 truncate text-[22px]">
        {icon}
        {title}
      </h1>
    </header>
  );
}

function InfoRow({ icon, label, value, mono }: { icon: ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="flex items-center gap-2.5 text-sm text-chalk-2">
        {icon}
        {label}
      </span>
      <span className={cn('text-sm font-semibold', mono && 'mono font-normal text-chalk-2')}>{value}</span>
    </div>
  );
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="cond flex h-7 items-center gap-1.5 rounded-np-pill bg-turf-2 px-2.5 text-[11px] text-chalk-2">{children}</span>
  );
}

function MetaChipsRow({ challenge }: { challenge: ChallengeViewState }) {
  const league = leagueLabel(challenge.league);
  const difficulty = challenge.difficulty ? DIFFICULTY_LABELS[challenge.difficulty] : undefined;
  if (!league && !difficulty) return null;
  return (
    <div className="flex gap-1.5">
      {league && <MetaChip>{league}</MetaChip>}
      {difficulty && <MetaChip>{difficulty}</MetaChip>}
    </div>
  );
}

function HeroIcon({ icon, pulse }: { icon: ReactNode; pulse?: boolean }) {
  return (
    <span className={cn('flex h-20 w-20 items-center justify-center rounded-full bg-volt/[.12] text-volt', pulse && 'glow')}>
      {icon}
    </span>
  );
}

export function ChallengeLoadingView({ gameStarting }: { gameStarting: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink p-4 text-chalk">
      <BallBounceLoader />
      <p className="disp text-center text-xl text-volt">{gameStarting ? 'Avvio partita…' : 'Caricamento sfida…'}</p>
    </div>
  );
}

export function ChallengeErrorView({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink p-4 text-chalk">
      <EmptyState
        icon={<X className="h-6 w-6" />}
        title="Sfida non disponibile"
        subtitle={message}
        action={
          <Button variant="volt" onClick={onBack}>
            Torna alla Home
          </Button>
        }
        className="max-w-sm"
      />
    </div>
  );
}

export function ChallengeExpiredView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink p-4 text-chalk">
      <EmptyState
        icon={<Clock className="h-6 w-6" />}
        title="Sfida scaduta"
        subtitle="Questa sfida non è più disponibile."
        action={
          <Button variant="volt" onClick={onBack}>
            Torna alla Home
          </Button>
        }
        className="max-w-sm"
      />
    </div>
  );
}

export function ChallengeCreatorPendingView({ challenge, token, onBack }: { challenge: ChallengeViewState; token: string; onBack: () => void }) {
  const link = appUrl(`/sfida/${token}`);

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-ink pb-10 text-chalk">
      <ChallengeHeader icon={<Send className="h-5 w-5 text-volt" />} title="La tua sfida" onBack={onBack} />

      <div className="flex flex-col gap-6 px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 rounded-np-hero border border-white/[.07] bg-turf-1 px-6 py-8 text-center"
        >
          <ExpiryBadge expiresAt={challenge.expiresAt} />
          <HeroIcon icon={<Clock className="h-9 w-9" strokeWidth={2} />} pulse />
          <span className="disp text-2xl">In attesa di un avversario</span>
          <span className="text-sm text-chalk-2">Condividi il link per sfidare un amico</span>
        </motion.div>

        <div className="flex flex-col divide-y divide-white/[.07] rounded-np-lg bg-turf-1 px-4">
          <InfoRow icon={<User className="h-4 w-4" />} label="Creata da" value={challenge.creatorName} />
          <InfoRow icon={<Clock className="h-4 w-4" />} label="Creata il" value={formatDate(challenge.createdAt)} mono />
        </div>

        <MetaChipsRow challenge={challenge} />

        <div className="flex flex-col gap-2">
          <span className="cond text-[11px] text-label">Condividi questo link</span>
          <Field
            readOnly
            value={link}
            suffix={
              <Button variant="volt" size="sm" onClick={() => navigator.clipboard.writeText(link)}>
                Copia
              </Button>
            }
          />
          <span className="mono text-center text-xs text-chalk-2">
            Attendi che un avversario accetti. Verrai reindirizzato automaticamente.
          </span>
        </div>
      </div>
    </div>
  );
}

export function ChallengeCreatorAcceptedView({
  challenge, onBack, onStartGame,
}: { challenge: ChallengeViewState; onBack: () => void; onStartGame: () => void }) {
  return (
    <div className="flex min-h-screen flex-col gap-6 bg-ink pb-10 text-chalk">
      <ChallengeHeader icon={<Check className="h-5 w-5 text-volt" />} title="Sfida accettata!" onBack={onBack} />

      <div className="flex flex-col gap-6 px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 rounded-np-hero border border-volt/35 bg-turf-1 px-6 py-8 text-center"
          style={{ boxShadow: '0 0 50px -10px rgba(215,255,58,.35)' }}
        >
          <HeroIcon icon={<User className="h-9 w-9" strokeWidth={2} />} />
          <span className="disp text-2xl">{challenge.opponentName} ha accettato!</span>
          <span className="text-sm text-chalk-2">La sfida è iniziata, preparati a giocare</span>
        </motion.div>

        <div className="flex flex-col rounded-np-lg bg-turf-1 px-4">
          <InfoRow icon={<User className="h-4 w-4" />} label="Il tuo avversario" value={challenge.opponentName ?? 'Sfidante'} />
        </div>

        <Button variant="volt" size="md" onClick={onStartGame} className="w-full text-lg">
          <Play className="h-5 w-5" />
          Inizia a giocare
        </Button>
      </div>
    </div>
  );
}

interface ChallengeVisitorAcceptViewProps {
  challenge: ChallengeViewState;
  hasUser: boolean;
  accepted: boolean;
  accepting: boolean;
  onBack: () => void;
  onAccept: () => void;
}

export function ChallengeVisitorAcceptView({ challenge, hasUser, accepted, accepting, onBack, onAccept }: ChallengeVisitorAcceptViewProps) {
  return (
    <div className="flex min-h-screen flex-col gap-6 bg-ink pb-10 text-chalk">
      <ChallengeHeader icon={<Trophy className="h-5 w-5 text-volt" />} title="Sfida" onBack={onBack} />

      <div className="flex flex-col gap-6 px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 rounded-np-hero border border-white/[.07] bg-turf-1 px-6 py-8 text-center"
        >
          {!accepted && <ExpiryBadge expiresAt={challenge.expiresAt} />}
          <HeroIcon icon={<Trophy className="h-9 w-9" strokeWidth={2} />} />
          <span className="disp text-2xl">Sfida da {challenge.creatorName}</span>
          <span className="text-sm text-chalk-2">Accetta e mostra le tue conoscenze calcistiche</span>
        </motion.div>

        <div className="flex flex-col divide-y divide-white/[.07] rounded-np-lg bg-turf-1 px-4">
          <InfoRow icon={<User className="h-4 w-4" />} label="Creata da" value={challenge.creatorName} />
          <InfoRow icon={<Clock className="h-4 w-4" />} label="Creata il" value={formatDate(challenge.createdAt)} mono />
        </div>

        <MetaChipsRow challenge={challenge} />

        {accepted ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-2 rounded-np-lg border border-volt/35 bg-volt/[.1] px-6 py-6 text-center"
          >
            <Check className="h-10 w-10 text-volt" />
            <span className="disp text-xl">Sfida accettata!</span>
            <span className="text-sm text-chalk-2">La partita sta per iniziare…</span>
          </motion.div>
        ) : hasUser ? (
          <Button variant="volt" size="md" loading={accepting} onClick={onAccept} className="w-full text-lg">
            {!accepting && <Check className="h-5 w-5" />}
            Accetta sfida
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-sm text-chalk-2">Devi accedere per accettare la sfida</span>
            <Button variant="chalk" size="md" onClick={onBack} className="w-full text-lg">
              <User className="h-5 w-5" />
              Accedi e accetta
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
