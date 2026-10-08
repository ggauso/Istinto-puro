import { Zap } from 'lucide-react';
import { AlertDialog } from '../ui/AlertDialog';
import { AlertIconBadge } from '../ui/AlertIconBadge';
import { Button } from '../ui/Button';
import { DifficultySelector, type DifficultyOption } from '../ui/DifficultySelector';
import { LeagueFlag, LEAGUE_NAMES, type LeagueKey } from '../ui/LeagueFlag';

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

const DIFFICULTY_OPTIONS: DifficultyOption<number>[] = [
  { value: 1, label: 'Facile', tone: 'volt' },
  { value: 2, label: 'Medio', tone: 'volt' },
  { value: 3, label: 'Difficile', tone: 'volt' },
];

// Il backend sfide-amico usa codici stringa (storico, non gli id numerici
// API-Football di HomeScreen) — mappati qui solo per riusare `LeagueFlag`.
const LEAGUE_OPTIONS: { code: string; flagKey: LeagueKey; label: string }[] = [
  { code: 'all', flagKey: 'all', label: 'Tutti' },
  { code: 'seria_a', flagKey: 135, label: LEAGUE_NAMES[135] },
  { code: 'premier', flagKey: 39, label: LEAGUE_NAMES[39] },
  { code: 'la_liga', flagKey: 140, label: LEAGUE_NAMES[140] },
  { code: 'bundesliga', flagKey: 78, label: LEAGUE_NAMES[78] },
  { code: 'ligue_1', flagKey: 61, label: LEAGUE_NAMES[61] },
];

export function ChallengeFriendModal({ challengeModal, creatingChallenge, onChange, onCancel, onSubmit }: ChallengeFriendModalProps) {
  return (
    <AlertDialog
      open
      onClose={onCancel}
      icon={<AlertIconBadge icon={<Zap className="h-[26px] w-[26px]" strokeWidth={2.2} />} />}
      title={`Sfida ${challengeModal.friendName}`}
      description="Scegli difficoltà e campionato per la sfida."
      actions={
        <>
          <Button variant="volt" loading={creatingChallenge} onClick={onSubmit}>
            <Zap className="h-4 w-4" />
            Invia sfida
          </Button>
          <Button variant="text-neutral" onClick={onCancel}>
            Annulla
          </Button>
        </>
      }
    >
      <div className="flex w-full flex-col gap-3.5 text-left">
        <div className="flex flex-col gap-2">
          <span className="cond text-[11px] text-label">Difficoltà</span>
          <DifficultySelector options={DIFFICULTY_OPTIONS} value={challengeModal.difficulty} onChange={(v) => onChange({ ...challengeModal, difficulty: v })} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="cond text-[11px] text-label">Campionato</span>
          <div className="rail -mx-5 flex gap-1.5 overflow-x-auto px-5">
            {LEAGUE_OPTIONS.map((opt) => {
              const selected = challengeModal.league === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => onChange({ ...challengeModal, league: opt.code })}
                  className={`chip flex shrink-0 items-center gap-1.5 rounded-np-pill border px-2.5 py-1.5 ${
                    selected ? 'border-volt bg-turf-2' : 'border-white/10 bg-transparent'
                  }`}
                >
                  <LeagueFlag league={opt.flagKey} variant="chip" className="rounded-full" />
                  <span className="text-xs font-semibold">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AlertDialog>
  );
}
