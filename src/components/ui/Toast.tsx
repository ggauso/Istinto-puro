import type { ReactNode } from 'react';
import { Check, Bell, Clock } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  message: ReactNode;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
}

function ExclamationGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B0C0A" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M12 7v6M12 17h.01" />
    </svg>
  );
}

const TONE_STYLES: Record<ToastTone, { container: string; iconBg: string; text: string; defaultIcon: ReactNode }> = {
  success: {
    container: 'bg-chalk text-ink',
    iconBg: 'bg-volt',
    text: '',
    defaultIcon: <Check className="h-4 w-4 text-ink" strokeWidth={3} />,
  },
  error: {
    container: 'bg-[#2A1410] border border-ember/40',
    iconBg: 'bg-ember',
    text: 'text-[#FFD2C7]',
    defaultIcon: <ExclamationGlyph />,
  },
  info: {
    container: 'bg-turf-2 border border-white/10',
    iconBg: 'bg-turf-3',
    text: 'text-chalk',
    defaultIcon: <Bell className="h-4 w-4 text-chalk" strokeWidth={2.4} />,
  },
  warning: {
    container: 'bg-[#2B2210] border border-[#F2C14E]/40',
    iconBg: 'bg-[#F2C14E]',
    text: 'text-[#FFE7A8]',
    defaultIcon: <Clock className="h-4 w-4 text-ink" strokeWidth={2.6} />,
  },
};

/**
 * Toast — in alto sotto la safe area (mai sopra il timer in partita), 3s,
 * uno alla volta. 4 toni con sfondo/bordo/testo distinti (non solo icona
 * colorata), replica di `Dialogs.dc.html`. Animazione bounce-in dall'alto
 * (`.toast`, night-pitch.css).
 */
export function Toast({ message, tone = 'success', actionLabel, onAction, icon, className }: ToastProps) {
  const style = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        'toast shadow-np-sheet flex w-max max-w-[90vw] items-center gap-3 rounded-np-pill py-2.5 pl-2.5 pr-3.5',
        style.container,
        className
      )}
      role="status"
    >
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', style.iconBg)}>
        {icon ?? style.defaultIcon}
      </span>
      <span className={cn('text-sm font-semibold', style.text)}>{message}</span>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className={cn('mono shrink-0 text-xs font-semibold', tone === 'success' ? 'text-[#5E655A] hover:text-ink' : 'opacity-80 hover:opacity-100')}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
