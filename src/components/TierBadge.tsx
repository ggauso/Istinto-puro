/**
 * TierBadge Component
 *
 * Badge che mostra il tier dell'utente con icona e colore
 */

import { Tier, getTierInfo, TierInfo } from '../lib/game-utils'

interface TierBadgeProps {
  tier: Tier | string
  showLabel?: boolean
  showProgress?: boolean
  currentScore?: number
  size?: 'sm' | 'md' | 'lg'
}

export function TierBadge({
  tier,
  showLabel = true,
  showProgress = false,
  currentScore,
  size = 'md'
}: TierBadgeProps) {
  // Converti stringa in tier se necessario
  const tierKey = (tier || 'bronze') as Tier
  const tierInfo: TierInfo = getTierInfo(tierKey)

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  }

  const iconSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  }

  // Calcola progressione se richiesta
  const progress = showProgress && currentScore !== undefined
    ? Math.round(((currentScore - tierInfo.minScore) / (tierInfo.maxScore - tierInfo.minScore)) * 100)
    : null

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`
          inline-flex items-center gap-2 rounded-full font-bold
          ${sizeClasses[size]}
        `}
        style={{
          backgroundColor: `${tierInfo.color}20`,
          color: tierInfo.color,
          border: `2px solid ${tierInfo.color}`
        }}
      >
        <span className={iconSizes[size]}>{tierInfo.icon}</span>
        {showLabel && <span>{tierInfo.label}</span>}
      </div>

      {showProgress && progress !== null && tierInfo.maxScore !== Infinity && (
        <div className="w-full max-w-[100px]">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{tierInfo.minScore}</span>
            <span>{tierInfo.maxScore}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: tierInfo.color
              }}
            />
          </div>
          <div className="text-xs text-center mt-1 text-gray-500">
            {progress}% al prossimo tier
          </div>
        </div>
      )}
    </div>
  )
}

export default TierBadge