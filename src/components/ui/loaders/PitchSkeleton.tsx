import { cn } from '../../../lib/cn';

export interface PitchSkeletonProps {
  rows?: number;
  rowHeight?: number;
  className?: string;
}

/**
 * Loader "Skeleton prato": righe "tosate" diagonali animate, per stati di
 * caricamento liste (Classifica, Storico, Amici, Tornei) al posto di
 * spinner generici o contenuto vuoto improvviso.
 */
export function PitchSkeleton({ rows = 4, rowHeight = 64, className }: PitchSkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-label="Caricamento…">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="pitch-skeleton rounded-np-lg bg-turf-1" style={{ height: rowHeight }} />
      ))}
    </div>
  );
}
