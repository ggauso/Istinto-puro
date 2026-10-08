import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store';
import { useAuthStore } from '../authStore';
import { createChallenge, getMyActiveChallenge } from '../lib/api/challenges';
import { calculateTier } from '../types/game';
import { Users, Bot, Bell, Send, X, User, ArrowRight, Coins, Check, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { SegmentedControl } from './ui/SegmentedControl';
import { DifficultySelector, type DifficultyOption } from './ui/DifficultySelector';
import { Field } from './ui/Field';
import { BottomSheet } from './ui/BottomSheet';
import { RadarLoader } from './ui/loaders/RadarLoader';
import { TierBadge } from './TierBadge';
import { LeagueFlag, type LeagueKey } from './ui/LeagueFlag';
import { appPath, appUrl } from '../lib/paths';
import { cn } from '../lib/cn';

const LEAGUES: { id: number | null; name: string }[] = [
  { id: null, name: 'Tutti' },
  { id: 135, name: 'Serie A' },
  { id: 39, name: 'Premier League' },
  { id: 140, name: 'La Liga' },
  { id: 78, name: 'Bundesliga' },
  { id: 61, name: 'Ligue 1' },
];

const DIFFICULTY_OPTIONS: DifficultyOption<number>[] = [
  { value: 1, label: 'Facile', tone: 'volt' },
  { value: 2, label: 'Medio', tone: 'volt' },
  { value: 3, label: 'Difficile', tone: 'volt' },
  { value: 4, label: 'Hard', tone: 'ember' },
];

interface HomeScreenProps {
  onNavigateToAuth: () => void;
  onNavigateToProfile: () => void;
}

export function HomeScreen({ onNavigateToAuth, onNavigateToProfile }: HomeScreenProps) {
  const { findMatch, status, selectedLeague, setSelectedLeague, selectedDifficulty, setSelectedDifficulty, gameMode, setGameMode, resetGame } = useGameStore();
  const { user, profile } = useAuthStore();

  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [pendingChallengeToken, setPendingChallengeToken] = useState<string | null>(null);
  // Store locale: la stessa variabile veniva letta/scritta da `useGameStore()`
  // come `errorMsg`/`setErrorMsg`, campi mai esistiti su `GameState` — il
  // banner non si mostrava mai e `setErrorMsg(...)` avrebbe lanciato
  // un'eccezione reale al primo errore di creazione sfida.
  const [localError, setLocalError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  // Polling per il creatore della sfida - check if someone accepted
  useEffect(() => {
    if (!user || !pendingChallengeToken) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Poll every 5 seconds to check if THIS specific challenge was accepted
    pollingRef.current = window.setInterval(async () => {
      // Don't poll if we don't have a valid pending token
      if (!pendingChallengeToken) return;

      const result = await getMyActiveChallenge();

      // Check if THIS specific challenge (matching our token) was accepted
      // Only redirect if the challenge is recent (within last 5 minutes)
      if (
        result.success &&
        result.challenge &&
        result.challenge.status === 'accepted' &&
        result.challenge.roomId
      ) {
        // Stop polling and redirect
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        // Clear the pending token so polling stops
        setPendingChallengeToken(null);

        // Navigate to the challenge page where the game will start
        window.location.href = appPath(`/sfida/${pendingChallengeToken}`);
      }
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [user, pendingChallengeToken]);

  const handleCreateChallenge = async () => {
    if (!user) {
      onNavigateToAuth();
      return;
    }

    setCreatingChallenge(true);
    const result = await createChallenge();

    if (result.success && result.token) {
      setChallengeToken(result.token);
      setPendingChallengeToken(result.token); // Start polling for this challenge
      setShowChallengeModal(true);
    } else {
      setLocalError(result.error || 'Errore nella creazione della sfida');
    }
    setCreatingChallenge(false);
  };

  const handleCloseChallengeModal = () => {
    setShowChallengeModal(false);
    // Keep pendingChallengeToken to keep polling active
  };

  const isSearching = status === 'searching';
  const challengeLink = challengeToken ? appUrl(`/sfida/${challengeToken}`) : '';
  const displayName = profile?.first_name || user?.email?.split('@')[0] || 'Ospite';
  const selectedLeagueName = LEAGUES.find((l) => l.id === selectedLeague)?.name ?? LEAGUES[0].name;

  return (
    <div className="relative flex min-h-screen flex-col gap-[18px] overflow-hidden bg-ink px-4 pb-[140px] pt-12 text-chalk">
      <svg
        viewBox="0 0 300 300"
        className="pointer-events-none absolute -right-36 top-10 h-[300px] w-[300px] opacity-[.07]"
        fill="none"
        stroke="#F3F5EE"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="150" cy="150" r="140" />
        <circle cx="150" cy="150" r="4" fill="#F3F5EE" />
        <line x1="150" y1="0" x2="150" y2="300" />
      </svg>

      <header className="relative flex items-center justify-between gap-3">
        {user ? (
          <button type="button" onClick={onNavigateToProfile} className="press flex items-center gap-2.5">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0.5"
              style={{ background: 'conic-gradient(var(--color-volt) 0 50%, var(--color-turf-3) 50%)' }}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full rounded-full border-2 border-ink object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center rounded-full border-2 border-ink bg-turf-2 text-sm font-extrabold">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="flex flex-col items-start gap-0.5">
              <span className="text-xs text-chalk-2">Ciao,</span>
              <span className="text-base font-bold">{displayName}</span>
            </span>
          </button>
        ) : (
          <span className="disp text-sm">Istinto Puro</span>
        )}

        {user ? (
          <div className="flex items-center gap-2">
            <span className="mono flex h-9 items-center gap-1.5 rounded-np-pill bg-[rgba(242,193,78,.12)] px-3 text-[13px] font-bold text-[#FFD36E]">
              <Coins className="h-[15px] w-[15px]" strokeWidth={2} />
              {profile?.coins ?? 0}
            </span>
            <button
              type="button"
              aria-label="Notifiche"
              className="press relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-turf-1 text-chalk"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
              <span className="absolute right-[11px] top-[10px] h-2 w-2 rounded-full bg-ember" />
            </button>
          </div>
        ) : (
          <Button variant="volt" size="sm" onClick={onNavigateToAuth}>
            <User className="h-4 w-4" />
            Accedi
          </Button>
        )}
      </header>

      <section className="relative flex flex-col gap-2">
        <span className="cond text-[11px] text-volt">Trivia calcistico 1vs1</span>
        <h1 className="disp text-[40px]">
          Istinto <span className="text-volt">puro</span>
        </h1>
        <p className="max-w-[300px] text-[14px] leading-[1.45] text-chalk-2">
          Trova il giocatore in comune tra due squadre prima che scada il tempo.
        </p>
      </section>

      {localError && (
        <div className="relative flex items-center justify-between gap-3 rounded-np-md border border-ember/35 bg-ember/10 px-4 py-3 text-sm text-ember-light">
          <span>{localError}</span>
          <button type="button" onClick={() => setLocalError(null)} className="mono shrink-0 text-xs underline">
            Chiudi
          </button>
        </div>
      )}

      {isSearching ? (
        <div className="relative flex flex-1 flex-col items-center gap-6 pb-10 pt-6">
          <RadarLoader
            center={<span className="disp text-lg text-ink">{displayName.charAt(0).toUpperCase()}</span>}
          />
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="disp text-2xl">Cerco rivale…</span>
            {profile && <TierBadge tier={calculateTier(profile.total_score)} size="sm" />}
          </div>
          <Button variant="ghost" onClick={() => resetGame()}>
            Annulla ricerca
          </Button>
        </div>
      ) : (
        <>
          <section className="relative flex flex-col gap-2">
            <SegmentedControl
              shape="rounded"
              className="bg-turf-1"
              options={[
                { value: 'pvp', label: 'PvP', icon: <Users className="h-[18px] w-[18px]" strokeWidth={2.2} /> },
                { value: 'ai', label: 'Vs IA', icon: <Bot className="h-[18px] w-[18px]" strokeWidth={2.2} /> },
              ]}
              value={gameMode}
              onChange={(value) => setGameMode(value as 'pvp' | 'ai')}
            />
            <span className="pl-1 text-xs text-label">
              {gameMode === 'pvp' ? 'Un avversario reale, abbinato per tier' : 'Allenati contro il computer, quando vuoi'}
            </span>
          </section>

          <section className="relative flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <span className="cond text-[11px] text-label">Campionato</span>
              <span className="text-xs text-chalk-2">{selectedLeagueName}</span>
            </div>
            <div className="rail -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-0.5">
              {LEAGUES.map((league) => {
                const active = selectedLeague === league.id;
                return (
                  <button
                    key={league.id ?? 'all'}
                    type="button"
                    onClick={() => setSelectedLeague(league.id)}
                    className={cn(
                      'press relative flex h-[92px] w-24 shrink-0 flex-col items-start justify-between rounded-[20px] border-2 p-3',
                      active ? 'border-volt bg-turf-2' : 'border-transparent bg-turf-1'
                    )}
                  >
                    <LeagueFlag league={(league.id ?? 'all') as LeagueKey} variant="tile" />
                    <span className="text-left text-[13px] font-semibold leading-tight">{league.name}</span>
                    {active && (
                      <span className="pop absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-volt">
                        <Check className="h-[11px] w-[11px] text-ink" strokeWidth={3.5} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="relative flex flex-col gap-2.5">
            <span className="cond text-[11px] text-label">Difficoltà</span>
            <DifficultySelector options={DIFFICULTY_OPTIONS} value={selectedDifficulty} onChange={setSelectedDifficulty} />
          </section>

          <div className="flex-1" />

          <div className="relative flex gap-2.5">
            {gameMode === 'pvp' && user && (
              <Button
                variant="icon-neutral"
                onClick={handleCreateChallenge}
                disabled={creatingChallenge}
                aria-label="Sfida un amico"
                className="h-[60px] w-[60px] shrink-0 rounded-[20px] border border-white/12 bg-turf-1 text-chalk"
              >
                {creatingChallenge ? <Loader2 className="h-[22px] w-[22px] animate-spin" /> : <Send className="h-[22px] w-[22px]" strokeWidth={2.2} />}
              </Button>
            )}
            <Button
              variant="volt"
              onClick={findMatch}
              withArrow={<ArrowRight className="h-5 w-5" strokeWidth={2.4} />}
              className="cta-glow h-[60px] flex-1 rounded-[20px] text-[17px]"
            >
              {gameMode === 'ai' ? "Gioca contro l'IA" : 'Cerca avversario'}
            </Button>
          </div>
        </>
      )}

      <BottomSheet open={showChallengeModal && !!challengeToken} onClose={handleCloseChallengeModal}>
        <div className="flex flex-col gap-4 px-6 pb-8 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="disp flex items-center gap-2 text-xl">
              <Send className="h-5 w-5 text-volt" />
              Sfida creata!
            </h2>
            <button type="button" onClick={handleCloseChallengeModal} aria-label="Chiudi" className="text-chalk-2">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-chalk-2">Condividi questo link con un amico per sfidarlo:</p>
          <Field
            readOnly
            value={challengeLink}
            suffix={
              <Button variant="volt" size="sm" onClick={() => navigator.clipboard.writeText(challengeLink)}>
                Copia
              </Button>
            }
          />
          <p className="mono text-center text-xs text-chalk-2">
            Attendi che un avversario accetti. Verrai reindirizzato automaticamente.
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}

export default HomeScreen;
