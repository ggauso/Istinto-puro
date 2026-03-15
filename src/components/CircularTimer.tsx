import React from 'react';
import { motion } from 'motion/react';

interface CircularTimerProps {
  timeLeft: number;
  totalTime: number;
}

export function CircularTimer({ timeLeft, totalTime }: CircularTimerProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / totalTime) * circumference;

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-zinc-800"
        />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "linear" }}
          className="text-[#FFD700]"
        />
      </svg>
      <div className="absolute text-4xl font-bold text-white font-mono">
        {timeLeft}
      </div>
    </div>
  );
}
