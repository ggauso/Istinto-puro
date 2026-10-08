import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store';
import { useAuthStore } from '../authStore';
import { completeChallenge } from '../lib/api/challenges';
import { completeFriendChallenge } from '../lib/api/friend-challenges';
import { completeTournamentMatch } from '../lib/api/tournaments';
import { calculateTier, TIER_CONFIG, type Tier } from '../types/game';
import { CircularTimer } from './CircularTimer';
import { RoundProgressBar } from './ui/RoundProgressBar';
import { Field } from './ui/Field';
import { LEAGUE_NAMES, type LeagueKey } from './ui/LeagueFlag';
import { Button } from './ui/Button';
import { BallBounceLoader } from './ui/loaders/BallBounceLoader';
import { ScoreboardLoader } from './ui/loaders/ScoreboardLoader';
import { AlertDialog } from './ui/AlertDialog';
import { appPath } from '../lib/paths';
import { AlertIconBadge } from './ui/AlertIconBadge';
import { motion } from 'motion/react';
import { Flag, Bot, Flame, Watch, ArrowRight, Home, RotateCcw, X, Check } from 'lucide-react';

// Il match è "al meglio dei 3 round" (vince chi arriva prima a 2 round
// vinti, vedi gameplaySlice/matchmakingSlice: soglia `>= 2`) — non 5 come
// nel mockup di riferimento, che usava un valore d'esempio generico.
const TOTAL_ROUNDS = 3;

const TIER_LABEL_VAR: Record<Tier, string> = {
  bronze: 'var(--tier-bronze-label)',
  silver: 'var(--tier-silver-label)',
  gold: 'var(--tier-gold-label)',
  platinum: 'var(--tier-platinum-label)',
  diamond: 'var(--tier-diamond-label)',
};

function renderSeasons(seasons: number[] | undefined) {
  if (!seasons) return 'N/D';
  const validSeasons = seasons.filter((s) => s !== null && s !== undefined);
  return validSeasons.length > 0 ? validSeasons.join(', ') : 'N/D';
}

interface RoundOutcomeScreenProps {
  eyebrow: string;
  title: string;
  correctAnswer?: string | null;
  team1Name: string;
  team2Name: string;
  seasons?: { team1?: number[]; team2?: number[] };
  playerScore: number;
  opponentScore: number;
  opponentLabel: string;
  team1Logo: string;
  team2Logo: string;
  actions?: React.ReactNode;
}

/**
 * Schermata esito di un singolo round (tempo scaduto / round perso contro
 * l'avversario), replica di `esito-tempo-scaduto.html`: banner ember
 * skewato, titolo "slam", card risposta corretta + storico stagioni, card
 * punteggio. Riusata sia per `status==='lost'` sia per `'opponent_won'`.
 */
function RoundOutcomeScreen({
  eyebrow,
  title,
  correctAnswer,
  team1Name,
  team2Name,
  team1Logo,
  team2Logo,
  seasons,
  playerScore,
  opponentScore,
  opponentLabel,
  actions,
}: RoundOutcomeScreenProps) {
  return (
    <div className="relative flex min-h-screen flex-col gap-5 overflow-hidden bg-ink px-4 pb-6 pt-[72px] text-chalk">
      <div
        className="pointer-events-none absolute -left-16 -right-16 -top-10 h-[380px] origin-top-left bg-ember"
        style={{ transform: 'skewY(-8deg)' }}
      />

      <section className="relative flex flex-col gap-3.5 px-1 text-ink">
        <div className="flex items-center justify-between">
          <span className="cond text-xs">{eyebrow}</span>
          <Watch className="watch h-[34px] w-[34px]" strokeWidth={2.2} />
        </div>
        <h1 className="slam disp text-[clamp(40px,12vw,68px)] leading-[0.9]">{title}</h1>
      </section>

      <section className="r1 shadow-np-e2 relative mt-7 flex flex-col gap-4 rounded-np-hero border border-white/[.08] bg-turf-1 p-[22px]" style={{ boxShadow: '0 30px 60px -20px rgba(0,0,0,.9)' }}>
        {correctAnswer && (
          <div className="flex flex-col gap-1.5">
            <span className="cond text-[11px] text-label">Una risposta corretta era</span>
            <span className="disp text-[34px] text-volt" style={{ fontStretch: '110%' }}>
              {correctAnswer}
            </span>
          </div>
        )}
        {seasons && (
          <div className="relative flex flex-col">
            <div className="absolute bottom-5 left-[17px] top-5 w-px bg-turf-3" />
            <div className="relative flex items-center gap-3.5 py-2">
              <img src={team1Logo} alt="" className="h-[18px] w-[18px] shrink-0 rounded-full bg-turf-3 object-contain" />
              <span className="flex-1 text-[15px] font-semibold">{team1Name}</span>
              <span className="mono text-sm text-chalk-2">{renderSeasons(seasons.team1)}</span>
            </div>
            <div className="relative flex items-center gap-3.5 py-2">
              <img src={team2Logo} alt="" className="h-[18px] w-[18px] shrink-0 rounded-full bg-turf-3 object-contain" />
              <span className="flex-1 text-[15px] font-semibold">{team2Name}</span>
              <span className="mono text-sm text-chalk-2">{renderSeasons(seasons.team2)}</span>
            </div>
          </div>
        )}
      </section>

      <section className="r2 relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-np-lg bg-turf-1 px-[18px] py-4">
        <div className="flex items-center gap-2.5">
          <span className="disp flex h-9 w-9 items-center justify-center rounded-np-sm bg-volt text-xs text-ink">TU</span>
          <span className="text-sm font-semibold">Tu</span>
        </div>
        <span className="mono text-[30px] font-semibold">
          {playerScore}
          <span className="mx-2 text-[#5E655A]">–</span>
          {opponentScore}
        </span>
        <div className="flex items-center justify-end gap-2.5">
          <span className="text-sm font-semibold">{opponentLabel}</span>
          <span className="disp flex h-9 w-9 items-center justify-center rounded-np-sm bg-ember text-xs text-ink">
            {opponentLabel.slice(0, 2).toUpperCase()}
          </span>
        </div>
      </section>

      <div className="flex-1" />

      {actions && <div className="r3 relative flex gap-2.5">{actions}</div>}
    </div>
  );
}

export function GameScreen() {
  const {
    match, score, timeLeft, status, validatePlayer, tickTimer,
    fetchMatchAndBroadcast, resetGame, findMatch, gameMode, correctAnswer, correctAnswerSeasons,
    round, playerRoundsWon, opponentRoundsWon, streak, lastScoreAdded, lastRarity, lastCombo, isHost,
    abandonMatch, selectedDifficulty, selectedLeague
  } = useGameStore();
  const { profile } = useAuthStore();
  const isHardMode = selectedDifficulty === 4;

  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState<string[]>([]);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // I tentativi sbagliati mostrati come chip sono un dettaglio solo di
  // presentazione (nessun dato persistito): si azzerano ad ogni nuovo round.
  useEffect(() => {
    setWrongAttempts([]);
  }, [round]);

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
      // Completa sfida-link / sfida-amico / match-torneo quando la partita finisce
      // (tre campi distinti nello store: una partita PvP può essere al più una
      // di queste tre cose, mai scritti insieme)
      const {
        currentChallengeId, currentFriendChallengeId, currentTournamentMatchId,
        gameMode: gm, isHost: host, playerRoundsWon: pRounds, opponentRoundsWon: oRounds, match: m
      } = useGameStore.getState();
      const { user } = useAuthStore.getState();
      const isWin = status === 'match_won';

      if (currentChallengeId && gm === 'pvp') {
        completeChallenge(currentChallengeId).catch(console.error);
      } else if (currentFriendChallengeId && gm === 'pvp' && user && m?.opponent_id) {
        const winnerId = isWin ? user.id : m.opponent_id;
        const creatorScore = host ? pRounds : oRounds;
        const opponentScore = host ? oRounds : pRounds;
        completeFriendChallenge(currentFriendChallengeId, winnerId, creatorScore, opponentScore).catch(console.error);
      } else if (currentTournamentMatchId && gm === 'pvp' && user && m?.opponent_id) {
        const winnerId = isWin ? user.id : m.opponent_id;
        const player1Score = host ? pRounds : oRounds;
        const player2Score = host ? oRounds : pRounds;
        completeTournamentMatch(currentTournamentMatchId, winnerId, player1Score, player2Score).catch(console.error);
      }

      // Bug pre-esistente trovato durante Milestone 8 (Achievement): questa
      // funzione non era mai chiamata da nessun componente, quindi
      // matches_history non si popolava mai durante il gioco reale (le
      // statistiche avanzate di Milestone 7/12, che leggono da lì, erano
      // sempre vuote in pratica). Corretto qui.
      useGameStore.getState().saveMatchResultToDb(isWin, useGameStore.getState().score).catch(console.error);

      const timer = setTimeout(() => {
        resetGame();
        // Redirect to home
        window.location.href = appPath('/');
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
      setWrongAttempts((prev) => [...prev, input.trim()]);
      setTimeout(() => setError(false), 500);
    }
  };

  if (!match) {
    let loadingText = 'Preparazione match...';
    if (status === 'joining') loadingText = 'Connessione in corso...';
    else if (status === 'match_won') loadingText = 'Vittoria a tavolino! Ritorno alla home...';
    else if (status === 'match_lost') loadingText = 'Sconfitta. Ritorno alla home...';

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink p-4 text-chalk">
        {(status === 'joining' || status === 'starting') && <BallBounceLoader />}
        <p className="disp text-center text-xl text-volt">{loadingText}</p>
      </div>
    );
  }

  const totalTime = isHardMode ? 5 : (gameMode === 'ai' ? 15 : 10);
  const isGameOver = status === 'match_won' || status === 'match_lost' || (status === 'lost' && gameMode === 'ai');

  const playerTier = profile ? calculateTier(profile.total_score) : 'bronze';
  const opponentTier = (gameMode === 'ai' ? 'bronze' : match?.opponent_tier) as Tier | undefined;
  const opponentName = gameMode === 'ai' ? 'IA' : match?.opponent_name || 'Avversario';
  const playerInitial = (profile?.nickname || profile?.first_name || 'Tu').charAt(0).toUpperCase();

  // --- Esito di round (tempo scaduto / round perso contro l'avversario) ---
  if (status === 'lost' || status === 'opponent_won') {
    const title = status === 'lost' ? 'Tempo scaduto' : "Round perso";
    const actions =
      gameMode === 'ai' && status === 'lost' ? (
        <>
          <button
            type="button"
            aria-label="Torna alla home"
            onClick={() => {
              resetGame();
              window.location.href = appPath('/');
            }}
            className="btn flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border border-white/12 bg-turf-1 text-chalk"
          >
            <Home className="h-[22px] w-[22px]" strokeWidth={2} />
          </button>
          <Button variant="volt" className="h-[60px] flex-1 text-[17px]" onClick={() => { resetGame(); findMatch(); }}>
            <RotateCcw className="h-5 w-5" strokeWidth={2.4} />
            Riprova
          </Button>
        </>
      ) : undefined;

    return (
      <RoundOutcomeScreen
        eyebrow={`Round ${round} · ${match.team1_name} vs ${match.team2_name}`}
        title={title}
        correctAnswer={correctAnswer}
        team1Name={match.team1_name}
        team2Name={match.team2_name}
        team1Logo={match.team1_logo}
        team2Logo={match.team2_logo}
        seasons={correctAnswerSeasons}
        playerScore={playerRoundsWon}
        opponentScore={opponentRoundsWon}
        opponentLabel={opponentName}
        actions={actions}
      />
    );
  }

  // --- Esito di match (vittoria/sconfitta finale) ---
  if (status === 'match_won' || status === 'match_lost') {
    const won = status === 'match_won';
    return (
      <div className={`relative flex min-h-screen flex-col gap-5 overflow-hidden px-4 pb-6 pt-[72px] text-ink ${won ? '' : ''}`} style={{ background: 'var(--color-ink)' }}>
        <div
          className="pointer-events-none absolute -left-16 -right-16 -top-10 h-[380px] origin-top-left"
          style={{ transform: 'skewY(-8deg)', background: won ? 'var(--color-volt)' : 'var(--color-ember)' }}
        />
        <section className="relative flex flex-col gap-3.5 px-1 text-ink">
          <span className="cond text-xs">Fine partita</span>
          <h1 className="slam disp text-[clamp(44px,13vw,68px)] leading-[0.9]">{won ? 'Vittoria!' : 'Sconfitta!'}</h1>
        </section>

        <section className="r1 relative mt-7 flex flex-col gap-3 rounded-np-hero border border-white/[.08] bg-turf-1 p-[22px] text-chalk" style={{ boxShadow: '0 30px 60px -20px rgba(0,0,0,.9)' }}>
          <span className="cond text-[11px] text-label">Punteggio finale</span>
          <span className="mono text-[44px] font-semibold text-volt">{score} pt</span>
          <span className="text-sm text-chalk-2">
            Ultimo round: +{lastScoreAdded} pt (rarità x{lastRarity}, combo x{lastCombo})
          </span>
        </section>

        <div className="flex-1" />

        <div className="r3 relative">
          <Button variant="volt" className="h-[60px] w-full text-[17px]" onClick={() => { resetGame(); findMatch(); }}>
            <ArrowRight className="h-5 w-5" strokeWidth={2.4} />
            Cerca nuova partita
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col gap-[18px] overflow-hidden bg-ink px-4 pb-6 pt-12 text-chalk">
      <div
        className="pointer-events-none absolute inset-x-0 top-[300px] h-[320px] opacity-[.06]"
        style={{ background: 'repeating-linear-gradient(90deg, #F3F5EE 0 39px, transparent 39px 78px)' }}
      />

      {isHardMode && (
        <div className="relative mx-auto flex items-center gap-1.5 rounded-np-pill border border-ember/50 bg-ember/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-ember-light">
          <Flame className="h-3.5 w-3.5" />
          Hard
        </div>
      )}

      <header className="relative flex items-center gap-2">
        <div className="flex h-16 flex-1 items-center gap-2.5 rounded-np-hero bg-turf-1 py-0 pl-2 pr-1.5">
          <span className="disp flex h-10 w-10 shrink-0 items-center justify-center rounded-np-sm bg-volt text-[13px] text-ink">
            {playerInitial}
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-semibold">Tu</span>
            <span className="cond text-[11px]" style={{ color: TIER_LABEL_VAR[playerTier] }}>
              {TIER_CONFIG[playerTier].label}
            </span>
          </div>
          <span className="mono pr-2 text-[28px] font-semibold text-volt">{playerRoundsWon}</span>
        </div>

        <div className="flex w-[52px] shrink-0 flex-col items-center gap-1">
          <span className="cond text-[11px] text-label">Round</span>
          <span className="disp text-xl">
            {round}/{TOTAL_ROUNDS}
          </span>
        </div>

        <div className="flex h-16 flex-1 flex-row-reverse items-center gap-2.5 rounded-np-hero bg-turf-1 py-0 pl-1.5 pr-2">
          <span className="disp flex h-10 w-10 shrink-0 items-center justify-center rounded-np-sm bg-ember text-[13px] text-ink">
            {gameMode === 'ai' ? <Bot className="h-5 w-5" strokeWidth={2.2} /> : opponentName.slice(0, 2).toUpperCase()}
          </span>
          <div className="flex flex-1 flex-col items-end gap-0.5">
            <span className="text-[13px] font-semibold">{opponentName}</span>
            {opponentTier && (
              <span className="cond text-[11px]" style={{ color: TIER_LABEL_VAR[opponentTier] }}>
                {TIER_CONFIG[opponentTier].label}
              </span>
            )}
          </div>
          <span className="mono pl-2 text-[28px] font-semibold text-ember-light">{opponentRoundsWon}</span>
        </div>
      </header>

      <RoundProgressBar total={TOTAL_ROUNDS} current={round} />

      <div className="relative flex flex-col items-center gap-1.5 pt-3">
        <CircularTimer timeLeft={timeLeft} totalTime={totalTime} />
        <span className="cond text-[11px] text-label">secondi</span>
      </div>

      <section className="relative flex items-center justify-center gap-4">
        <motion.div
          initial={{ x: -120, rotate: -10, opacity: 0 }}
          animate={{ x: 0, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-1 flex-col items-center gap-3"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-np-lg border border-white/7 bg-turf-1 p-3">
            <img src={match.team1_logo} alt={match.team1_name} className="h-full w-full object-contain" />
          </div>
          <span className="text-[15px] font-semibold">{match.team1_name}</span>
        </motion.div>

        <motion.div
          initial={{ scale: 3, skewX: -14, opacity: 0 }}
          animate={{ scale: 1, skewX: -14, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          className="disp shrink-0 text-[40px] text-volt"
        >
          VS
        </motion.div>

        <motion.div
          initial={{ x: 120, rotate: 10, opacity: 0 }}
          animate={{ x: 0, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-1 flex-col items-center gap-3"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-np-lg border border-white/7 bg-turf-1 p-3">
            <img src={match.team2_logo} alt={match.team2_name} className="h-full w-full object-contain" />
          </div>
          <span className="text-[15px] font-semibold">{match.team2_name}</span>
        </motion.div>
      </section>

      <p className="relative text-center text-sm text-chalk-2">Chi ha giocato in entrambe le squadre?</p>

      <div className="flex-1" />

      {wrongAttempts.length > 0 && (
        <div className="relative flex flex-wrap gap-2">
          {wrongAttempts.map((attempt, i) => (
            <span
              key={i}
              className="flex h-8 items-center gap-1.5 rounded-np-pill bg-ember/10 px-3 text-[13px] text-[#FFB4A3] line-through decoration-ember"
            >
              <X className="h-3 w-3 text-ember" strokeWidth={3} />
              {attempt}
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative">
        <Field
          ref={inputRef}
          shape="answer"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== 'playing'}
          placeholder="Nome del giocatore…"
          aria-label="Nome del giocatore"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          error={error ? 'Sbagliato! Riprova.' : undefined}
          suffix={
            <button
              type="submit"
              aria-label="Invia risposta"
              className="btn flex h-12 w-12 shrink-0 items-center justify-center rounded-np-sm bg-volt text-ink"
            >
              <ArrowRight className="h-5 w-5" strokeWidth={2.4} />
            </button>
          }
        />
      </form>

      <div className="relative flex items-center justify-between">
        <span className="mono text-[11px] text-label">
          {LEAGUE_NAMES[(selectedLeague ?? 'all') as LeagueKey]} · {['Facile', 'Medio', 'Difficile', 'Hard'][selectedDifficulty - 1] || 'Facile'}
        </span>
        <button
          type="button"
          onClick={() => setShowAbandonModal(true)}
          className="btn flex h-11 items-center gap-1.5 rounded-np-pill px-3.5 text-[13px] font-semibold text-ember-light"
        >
          <Flag className="h-3.5 w-3.5" strokeWidth={2.2} />
          Abbandona
        </button>
      </div>

      {status === 'won' && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative flex flex-col items-center gap-2 rounded-np-lg bg-turf-1 p-5 text-center"
        >
          <span className="cond flex items-center gap-1.5 text-volt">
            <Check className="h-4 w-4" strokeWidth={3} />
            Corretto!
          </span>
          <div key={round} className="mono flex items-center gap-1 text-volt">
            <span className="text-xl font-semibold">+</span>
            <ScoreboardLoader value={lastScoreAdded} />
            <span className="text-xl font-semibold">pt</span>
          </div>
          <div className="mono flex gap-4 text-xs text-chalk-2">
            <span>Rarità x{lastRarity}</span>
            <span>Combo x{lastCombo}</span>
          </div>
          {correctAnswerSeasons && (
            <div className="mt-2 w-full max-w-sm rounded-np-md bg-ink px-4 py-3 text-sm">
              <div className="mb-1 flex justify-between gap-4">
                <span className="text-chalk-2">{match.team1_name}:</span>
                <span className="mono">{renderSeasons(correctAnswerSeasons.team1)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-chalk-2">{match.team2_name}:</span>
                <span className="mono">{renderSeasons(correctAnswerSeasons.team2)}</span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <AlertDialog
        open={showAbandonModal}
        onClose={() => setShowAbandonModal(false)}
        icon={<AlertIconBadge icon={<Flag className="h-[26px] w-[26px]" strokeWidth={2.2} />} wobble />}
        title="Abbandoni?"
        description={
          <>
            La partita conterà come abbandonata.
            {gameMode === 'pvp' ? ' Subirai una penalità di 50 punti.' : ' Perderai i progressi attuali.'}
          </>
        }
        actions={
          <>
            <Button variant="volt" onClick={() => setShowAbandonModal(false)}>
              Resta in partita
            </Button>
            <Button
              variant="text-ember"
              onClick={async () => {
                setShowAbandonModal(false);
                // Attende che abandonMatch() abbia inviato il broadcast
                // all'avversario prima di navigare via: farlo subito
                // smonterebbe la pagina (e la connessione realtime) senza
                // garanzia che il messaggio sia già partito.
                await abandonMatch();
                window.location.href = appPath('/');
              }}
            >
              Abbandona
            </Button>
          </>
        }
      />
    </div>
  );
}
