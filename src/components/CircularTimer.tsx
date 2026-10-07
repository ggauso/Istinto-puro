import { motion } from 'motion/react';
import { cn } from '../lib/cn';

interface CircularTimerProps {
  timeLeft: number;
  totalTime: number;
  /** Secondi rimanenti sotto i quali il timer passa a ember e pulsa (default 5, "hot"). */
  hotThreshold?: number;
}

export function CircularTimer({ timeLeft, totalTime, hotThreshold = 5 }: CircularTimerProps) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / totalTime) * circumference;
  const isHot = timeLeft <= hotThreshold;

  return (
    <div className={cn('relative flex h-[132px] w-[132px] items-center justify-center', isHot && 'hot')}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 transform">
        <circle cx="50" cy="50" r={radius} fill="#0B0C0A" stroke="currentColor" strokeWidth="8" className="text-turf-2" />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'linear' }}
          className={cn('transition-colors duration-300', isHot ? 'text-ember' : 'text-volt')}
        />
      </svg>
      <div className={cn('mono absolute text-[44px] font-semibold tabular-nums', isHot ? 'text-ember' : 'text-chalk')}>
        {timeLeft}
      </div>
    </div>
  );
}
