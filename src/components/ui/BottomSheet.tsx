import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/cn';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Sheet modale che sale dal basso con overlay blur e handle grab bar
 * trascinabile (swipe-down per chiudere). Usato per: Modifica profilo,
 * selezione squadra del cuore, dettaglio achievement.
 */
export function BottomSheet({ open, onClose, children, className }: BottomSheetProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className={cn('shadow-np-sheet w-full max-w-md rounded-t-[32px] bg-turf-1 pb-[env(safe-area-inset-bottom)]', className)}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80) onClose();
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-center pt-3">
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
