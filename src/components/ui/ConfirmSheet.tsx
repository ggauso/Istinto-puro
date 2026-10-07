import type { ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

export interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  avatarInitial: string;
  title: string;
  description: string;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  onConfirm: () => void;
  cancelLabel?: string;
}

/**
 * Sheet di conferma per azioni distruttive "minori" (es. rimuovere un
 * amico) — niente volt, "Annulla" sempre in fondo vicino al pollice. Più
 * leggero dell'`AlertDialog` destructive: usare quello per azioni davvero
 * irreversibili con conseguenze di gioco (es. abbandonare una partita).
 */
export function ConfirmSheet({
  open,
  onClose,
  avatarInitial,
  title,
  description,
  confirmLabel,
  confirmIcon,
  onConfirm,
  cancelLabel = 'Annulla',
}: ConfirmSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-3.5 px-[18px] pb-[26px] pt-1.5">
        <div className="mt-1.5 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-turf-3 font-bold">
            {avatarInitial}
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[17px] font-bold">{title}</h2>
            <span className="text-[13px] text-chalk-2">{description}</span>
          </div>
        </div>
        <div className="mt-1 flex flex-col gap-2">
          <Button variant="destructive" onClick={onConfirm}>
            {confirmIcon}
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
