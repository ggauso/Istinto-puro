import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/cn';

export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  /** Badge icona 56×56 già pronto (forma/colore/animazione a carico del chiamante, vedi preset in `alert-presets.tsx`). */
  icon?: ReactNode;
  /** Omesso nei casi con intestazione completamente custom (es. `SuccessAlert`, che usa `children` per tutto il corpo). */
  title?: string;
  description?: ReactNode;
  /** Contenuto extra tra description e bottoni (es. avatar VS, barra di progresso). Se i bottoni sono già dentro `children` (vedi `SuccessAlert`), omettere `actions`. */
  children?: ReactNode;
  actions?: ReactNode;
  /** Se `false`, Esc e tap sull'overlay non chiudono — caso "errore di rete": l'utente deve scegliere esplicitamente. Default `true`. */
  dismissible?: boolean;
  /** Bordo + alone volt per il caso successo. */
  glow?: boolean;
  className?: string;
}

/**
 * Alert centrato (role="alertdialog"): per decisioni non annullabili.
 * Max 1 titolo + 2 righe di testo, bottoni impilati a piena larghezza
 * (l'azione sicura sempre in alto, a carico del chiamante tramite `actions`).
 * Entrata scale(.86)→1 con bounce, 420ms — replica di `Dialogs.dc.html`.
 */
export function AlertDialog({
  open,
  onClose,
  icon,
  title,
  description,
  children,
  actions,
  dismissible = true,
  glow,
  className,
}: AlertDialogProps) {
  useEffect(() => {
    if (!open || !dismissible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, dismissible, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="dim fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={() => dismissible && onClose()}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="alert-dialog-title"
            initial={{ opacity: 0, scale: 0.86, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.86, y: 10 }}
            transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex w-full max-w-sm flex-col items-center gap-3 rounded-[28px] border bg-turf-1 px-5 pb-5 pt-6 text-center',
              glow ? 'border-volt/35' : 'border-white/[.08]',
              className
            )}
            style={{
              boxShadow: glow
                ? '0 0 50px -10px rgba(215,255,58,.35), 0 30px 60px -20px rgba(0,0,0,.9)'
                : '0 30px 60px -20px rgba(0,0,0,.9)',
            }}
          >
            {icon}
            {title && (
              <h2 id="alert-dialog-title" className="disp text-[22px]" style={{ fontStretch: '110%' }}>
                {title}
              </h2>
            )}
            {description && <p className="text-sm leading-[1.45] text-chalk-2">{description}</p>}
            {children}
            {actions && <div className="mt-1.5 flex w-full flex-col gap-2">{actions}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
