/**
 * LeaderboardScreen Component
 *
 * Schermata per visualizzare la classifica globale
 */

import { useState, useEffect } from 'react'
import { getLeaderboard, getWeeklyLeaderboard, getMonthlyLeaderboard, getUserRank } from '../lib/rpc-client'
import { TierBadge } from './TierBadge'
import { Tier, formatNumber, sortLeaderboard } from '../lib/game-utils'
import { motion } from 'motion/react'
import { Trophy, Medal, Crown, ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react'

type LeaderboardType = 'all_time' | 'weekly' | 'monthly'

interface LeaderboardScreenProps {
  onBack: () => void;
}

export function LeaderboardScreen({ onBack }: LeaderboardScreenProps) {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<any[]>([])
  const [userRank, setUserRank] = useState<number | null>(null)
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('all_time')
  const [showFilters, setShowFilters] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLeaderboard()
  }, [leaderboardType])

  async function loadLeaderboard() {
    setLoading(true)
    setError(null)

    try {
      let result

      // Seleziona la funzione corretta in base al tipo di classifica
      switch (leaderboardType) {
        case 'weekly':
          result = await getWeeklyLeaderboard(50)
          break
        case 'monthly':
          result = await getMonthlyLeaderboard(50)
          break
        default:
          result = await getLeaderboard(50, null)
      }

      if (result.success) {
        const sorted = sortLeaderboard(result.entries)
        setEntries(sorted)

        // Per la classifica all-time mostriamo il rank
        if (leaderboardType === 'all_time') {
          const rankResult = await getUserRank()
          if (rankResult.success && rankResult.rank) {
            setUserRank(rankResult.rank)
          }
        } else {
          setUserRank(null) // Non mostriamo rank per classifiche temporanee
        }
      } else {
        setError(result.error || 'Errore nel caricamento')
      }
    } catch (err) {
      setError('Impossibile caricare la classifica')
    } finally {
      setLoading(false)
    }
  }

  function getRankStyle(rank: number) {
    switch (rank) {
      case 1: return 'from-yellow-400/20 to-yellow-600/10 border-yellow-500/50'
      case 2: return 'from-gray-300/20 to-gray-500/10 border-gray-400/50'
      case 3: return 'from-amber-600/20 to-amber-800/10 border-amber-600/50'
      default: return 'bg-zinc-900/50 border-zinc-800'
    }
  }

  function getRankBadge(rank: number) {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-400" />
      case 2: return <Medal className="w-5 h-5 text-gray-300" />
      case 3: return <Medal className="w-5 h-5 text-amber-600" />
      default: return <span className="text-zinc-500 font-mono w-6 text-center">{rank}</span>
    }
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Header */}
      <div className="sticky top-0 bg-[#121212]/95 backdrop-blur-sm border-b border-zinc-800 z-10 px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-zinc-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="text-[#FFD700] w-5 h-5" />
            Classifica
          </h1>

          <button
            onClick={loadLeaderboard}
            className="p-2 -mr-2 hover:bg-zinc-800 rounded-full transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* User Rank Banner */}
        {userRank && userRank <= 100 && (
          <div className="max-w-lg mx-auto mt-3 bg-gradient-to-r from-[#FFD700]/20 to-yellow-600/10 border border-[#FFD700]/30 rounded-xl px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-zinc-300">La tua posizione</span>
            <span className="text-lg font-bold text-[#FFD700]">#{userRank}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Time Filter */}
        <div className="flex gap-2 mb-4">
          {[
            { id: 'all_time', label: 'Tutti' },
            { id: 'weekly', label: 'Settimana' },
            { id: 'monthly', label: 'Mese' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLeaderboardType(tab.id as LeaderboardType)}
              className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                leaderboardType === tab.id
                  ? 'bg-[#FFD700] text-black'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && entries.length === 0 ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FFD700]" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadLeaderboard}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg"
            >
              Riprova
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>Nessun utente in classifica</p>
            <p className="text-sm mt-2">Completa delle partite per entrare!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`
                  flex items-center gap-3 p-3 rounded-xl border
                  ${getRankStyle(entry.rank)}
                `}
              >
                {/* Rank */}
                <div className="w-8 flex justify-center">
                  {getRankBadge(entry.rank)}
                </div>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{entry.displayName}</span>
                    {entry.rank <= 3 && (
                      <span className="text-xs">{entry.rank === 1 ? '👑' : '⭐'}</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 flex items-center gap-2">
                    <span>{entry.matchesPlayed} partite</span>
                    <span>•</span>
                    <span>{entry.winRate}% vince</span>
                  </div>
                </div>

                {/* Tier & Score */}
                <div className="flex items-center gap-3">
                  <TierBadge tier={entry.tier} size="sm" showLabel={false} />
                  <div className="text-right">
                    <div className="font-bold text-white">{formatNumber(entry.totalScore)}</div>
                    <div className="text-xs text-zinc-500">pts</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LeaderboardScreen