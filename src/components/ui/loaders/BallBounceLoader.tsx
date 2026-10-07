import { cn } from '../../../lib/cn';

export interface BallBounceLoaderProps {
  label?: string;
  size?: number;
  className?: string;
}

/**
 * Loader "Palleggio": pallone che rimbalza + ombra. Sostituisce gli spinner
 * generici (`Loader2`/`animate-spin`) per attese brevi generiche.
 */
export function BallBounceLoader({ label, size = 32, className }: BallBounceLoaderProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="flex flex-col items-center" style={{ height: size * 1.9 }}>
        <span
          className="ball-bounce rounded-full bg-chalk"
          style={{ width: size, height: size, background: 'radial-gradient(circle at 35% 30%, #fff, #c9ced6 70%)' }}
          aria-hidden="true"
        />
        <span className="ball-shadow mt-1 rounded-full bg-black" style={{ width: size * 0.9, height: size * 0.22 }} aria-hidden="true" />
      </div>
      {label && <span className="cond text-xs text-label">{label}</span>}
    </div>
  );
}
