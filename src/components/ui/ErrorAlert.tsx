import type { ReactNode } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import { AlertDialog } from './AlertDialog';
import { AlertIconBadge } from './AlertIconBadge';
import { Button } from './Button';

export interface ErrorAlertProps {
  open: boolean;
  title?: string;
  /** Testo mono sotto il messaggio di riconnessione (es. "Il timer del round è in pausa"). */
  meta?: ReactNode;
  onRetry: () => void;
  retryLabel?: string;
  onExit: () => void;
  exitLabel?: string;
}

/**
 * Alert di errore (es. connessione persa): icona statica (nessun wobble,
 * non è un'azione distruttiva da confermare), spinner + puntini di
 * riconnessione animati. **Non si chiude da sola** via Esc/tap-fuori — in
 * `Dialogs.dc.html` l'errore di rete è l'unica eccezione alla regola
 * "tap fuori = annulla": l'utente deve scegliere esplicitamente.
 * Bottone primario `chalk` (non volt: "non è un successo").
 */
export function ErrorAlert({
  open,
  title = 'Connessione persa',
  meta = 'Il timer del round è in pausa',
  onRetry,
  retryLabel = 'Riprova ora',
  onExit,
  exitLabel = 'Esci dalla partita',
}: ErrorAlertProps) {
  return (
    <AlertDialog
      open={open}
      onClose={() => {}}
      dismissible={false}
      icon={<AlertIconBadge icon={<WifiOff className="h-[26px] w-[26px]" strokeWidth={2.2} />} />}
      title={title}
      description={
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-volt" strokeWidth={3} />
          Riconnessione
          <span className="dot1">.</span>
          <span className="dot2 -ml-2">.</span>
          <span className="dot3 -ml-2">.</span>
        </span>
      }
      actions={
        <>
          {meta && <span className="mono mb-1 text-xs text-label">{meta}</span>}
          <Button variant="chalk" onClick={onRetry}>
            {retryLabel}
          </Button>
          <Button variant="text-neutral" onClick={onExit}>
            {exitLabel}
          </Button>
        </>
      }
    />
  );
}
