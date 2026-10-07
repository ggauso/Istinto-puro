import { useEffect, useState } from 'react';
import { AlertDialog } from './AlertDialog';
import { Button } from './Button';

export interface SuccessAlertProps {
  open: boolean;
  onClose: () => void;
  /** Richiamata quando il countdown arriva a 0 (match pronto a partire). */
  onComplete?: () => void;
  playerLabel: string;
  playerInitial: string;
  opponentLabel: string;
  opponentInitial: string;
  /** Durata del countdown "Si parte tra…", in secondi. Default 3. */
  seconds?: number;
}

/**
 * Alert di successo "avversario trovato": nessuna conferma richiesta, si
 * chiude da sola allo scadere del countdown (barra che si svuota in
 * `seconds` secondi, stesso intervallo del countdown numerico). Bordo +
 * alone volt (`glow`). "Annulla" resta disponibile per chi vuole tornare
 * indietro prima dello scadere.
 */
export function SuccessAlert({
  open,
  onClose,
  onComplete,
  playerLabel,
  playerInitial,
  opponentLabel,
  opponentInitial,
  seconds = 3,
}: SuccessAlertProps) {
  const [countdown, setCountdown] = useState(seconds);

  useEffect(() => {
    if (!open) return;
    setCountdown(seconds);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          onComplete?.();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seconds]);

  return (
    <AlertDialog open={open} onClose={onClose} glow>
      <span className="cond -mt-3 text-xs text-volt">Avversario trovato</span>
      <div className="flex items-center gap-4 py-1">
        <div className="slide-l flex flex-col items-center gap-1.5">
          <span className="disp flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-volt text-lg text-ink">
            {playerInitial}
          </span>
          <span className="text-xs font-semibold">{playerLabel}</span>
        </div>
        <span className="slam disp text-[30px] text-volt">VS</span>
        <div className="slide-r flex flex-col items-center gap-1.5">
          <span className="disp flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-ember text-lg text-ink">
            {opponentInitial}
          </span>
          <span className="text-xs font-semibold">{opponentLabel}</span>
        </div>
      </div>
      <h2 className="text-[15px] font-semibold text-chalk-2">
        Si parte tra <span className="mono text-chalk">{countdown}</span>
      </h2>
      <div className="h-1 w-full overflow-hidden rounded-np-pill bg-turf-3">
        <div key={String(open)} className="bar-deplete h-full bg-volt" />
      </div>
      <Button variant="text-neutral" className="w-full" onClick={onClose}>
        Annulla
      </Button>
    </AlertDialog>
  );
}
