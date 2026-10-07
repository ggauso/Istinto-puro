import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { LeagueFlag, LEAGUE_NAMES, type LeagueKey } from './LeagueFlag';

export interface CountdownSheetProps {
  open: boolean;
  /** Richiamata sia dal bottone "Rifiuta" sia dallo swipe-down/scadenza (il countdown a 0 rifiuta automaticamente). */
  onReject: () => void;
  onAccept: () => void;
  challengerName: string;
  challengerInitial: string;
  league: LeagueKey;
  difficultyLabel: string;
  /** Durata del countdown in secondi. Default 10 (come da `Dialogs.dc.html`). */
  seconds?: number;
}

const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Sheet "sfida ricevuta": anello di scadenza che passa a ember sotto i 3s
 * rimanenti, con un anello esterno decorativo che pulsa in loop
 * indipendente (`.pulse-ring`, puramente estetico, non legato al countdown
 * reale). Swipe giù o scadenza = rifiuta (stesso handler del bottone).
 */
export function CountdownSheet({
  open,
  onReject,
  onAccept,
  challengerName,
  challengerInitial,
  league,
  difficultyLabel,
  seconds = 10,
}: CountdownSheetProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (!open) return;
    setRemaining(seconds);
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          onReject();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seconds]);

  const isHot = remaining <= 3;
  const color = isHot ? 'var(--color-ember)' : 'var(--color-volt)';
  const offset = CIRCUMFERENCE - (remaining / seconds) * CIRCUMFERENCE;

  return (
    <BottomSheet open={open} onClose={onReject}>
      <div className="flex flex-col items-center gap-3.5 px-[18px] pb-[26px] pt-3 text-center">
        <div className="relative mt-1.5 h-[84px] w-[84px]">
          <svg width="84" height="84" viewBox="0 0 84 84" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="42" cy="42" r={RADIUS} fill="none" stroke="var(--color-turf-3)" strokeWidth="4" />
            <motion.circle
              cx="42"
              cy="42"
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </svg>
          <span className="pulse-ring absolute inset-3 rounded-full border-2 border-volt" />
          <span className="absolute inset-3 flex items-center justify-center rounded-full bg-turf-3 text-lg font-extrabold">
            {challengerInitial}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-bold">{challengerName} ti sfida</h2>
          <span className="text-[13px] text-chalk-2">
            Scade tra <span className="mono font-semibold" style={{ color }}>{remaining}s</span>
          </span>
        </div>

        <div className="flex gap-1.5">
          <span className="flex h-[30px] items-center gap-1.5 rounded-np-pill bg-turf-2 py-0 pl-1 pr-2.5">
            <LeagueFlag league={league} variant="chip" className="rounded-full" />
            <span className="cond text-[11px] text-chalk-2">{LEAGUE_NAMES[league]}</span>
          </span>
          <span className="cond flex h-[30px] items-center rounded-np-pill bg-turf-2 px-3 text-[11px] text-chalk-2">
            {difficultyLabel}
          </span>
        </div>

        <div className="mt-1 grid w-full grid-cols-[1fr_1.4fr] gap-2">
          <Button variant="ghost" onClick={onReject}>
            Rifiuta
          </Button>
          <Button variant="volt" onClick={onAccept}>
            <Zap className="h-4 w-4" strokeWidth={2.4} />
            Accetta
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
