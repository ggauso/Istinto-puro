/**
 * LeaderboardScreen Component
 *
 * Schermata per visualizzare la classifica globale
 */

import { useState, useEffect } from 'react';
import {
  getLeaderboard,
  getWeeklyLeaderboard,
  getMonthlyLeaderboard,
  getFriendsLeaderboard,
  getHardModeLeaderboard,
  getUserRank,
} from '../lib/api/leaderboard';
import { useAuthStore } from '../authStore';
import { sortLeaderboard } from '../lib/game-utils';
import type { LeaderboardEntry } from '../types/game';
import { Chip } from './ui/Chip';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { PitchSkeleton } from './ui/loaders/PitchSkeleton';
import { RefreshCw, Users, Flame, Trophy } from 'lucide-react';
import { cn } from '../lib/cn';

type LeaderboardType = 'all_time' | 'weekly' | 'monthly' | 'friends' | 'hard';

const FILTERS: { id: LeaderboardType; label: string; hard?: boolean }[] = [
  { id: 'all_time', label: 'Sempre' },
  { id: 'weekly', label: 'Settimana' },
  { id: 'monthly', label: 'Mese' },
  { id: 'friends', label: 'Amici' },
  { id: 'hard', label: 'Hard', hard: true },
];

interface LeaderboardScreenProps {
  onBack: () => void;
}

const PODIUM_RING = {
  gold: 'var(--tier-gold-label)',
  silver: 'var(--tier-silver-label)',
  bronze: 'var(--tier-bronze-label)',
} as const;

// Alcuni account seed/legacy hanno `displayName` vuoto (nickname mai impostato):
// senza fallback la riga/colonna risulterebbe visibilmente rotta (iniziali e
// nome mancanti, solo il punteggio visibile).
function displayNameOf(entry: LeaderboardEntry): string {
  return entry.displayName || 'Giocatore';
}

interface PodiumColumnProps {
  entry: LeaderboardEntry;
  place: 'gold' | 'silver' | 'bronze';
  isCurrentUser: boolean;
}

/** Una colonna del podio (1 dei 3 posti): avatar con anello colorato per posizione (non per tier del giocatore), barra che cresce con l'esatto stagger di `classifica.html`. */
function PodiumColumn({ entry, place, isCurrentUser }: PodiumColumnProps) {
  const ring = PODIUM_RING[place];
  const sizes = {
    gold: { avatar: 60, bar: 128, num: 44 },
    silver: { avatar: 52, bar: 96, num: 36 },
    bronze: { avatar: 52, bar: 72, num: 32 },
  }[place];
  const barClass = { gold: 'podium-gold', silver: 'podium-silver', bronze: 'podium-bronze' }[place];
  const isGold = place === 'gold';

  return (
    <div className={cn('flex flex-col items-center gap-2', isGold && 'justify-self-stretch')}>
      {isGold && (
        <svg width="28" height="22" viewBox="0 0 28 22" fill="var(--tier-gold-label)" className="crown" aria-hidden="true">
          <path d="M2 6l6 6 6-10 6 10 6-6-2 14H4z" />
        </svg>
      )}
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-extrabold',
          isCurrentUser ? 'bg-volt text-ink' : 'bg-turf-3 text-chalk'
        )}
        style={{
          width: sizes.avatar,
          height: sizes.avatar,
          fontSize: sizes.avatar * 0.28,
          boxShadow: `0 0 0 3px var(--color-ink), 0 0 0 5px ${ring}`,
        }}
      >
        {displayNameOf(entry).slice(0, 2).toUpperCase()}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="max-w-[88px] truncate text-[13px] font-semibold">{displayNameOf(entry)}</span>
        <span className="mono text-xs text-chalk-2">{entry.totalScore}</span>
      </div>
      <div
        className={cn('flex w-full flex-col items-center justify-start rounded-[18px_18px_6px_6px] pt-2.5', barClass)}
        style={{ height: sizes.bar, background: isGold ? 'var(--color-volt)' : 'var(--color-turf-2)' }}
      >
        <span
          className="disp"
          style={{ fontSize: sizes.num, color: isGold ? 'var(--color-ink)' : ring }}
        >
          {place === 'gold' ? 1 : place === 'silver' ? 2 : 3}
        </span>
      </div>
    </div>
  );
}

export function LeaderboardScreen({ onBack }: LeaderboardScreenProps) {
  const { user, profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('all_time');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboardType]);

  async function loadLeaderboard() {
    setLoading(true);
    setError(null);

    try {
      let result;

      switch (leaderboardType) {
        case 'weekly':
          result = await getWeeklyLeaderboard(50);
          break;
        case 'monthly':
          result = await getMonthlyLeaderboard(50);
          break;
        case 'friends':
          result = await getFriendsLeaderboard(50);
          break;
        case 'hard':
          result = await getHardModeLeaderboard(50);
          break;
        default:
          result = await getLeaderboard(50, null);
      }

      if (result.success) {
        const sorted = sortLeaderboard(result.entries);
        setEntries(sorted);

        // Per la classifica all-time mostriamo il rank
        if (leaderboardType === 'all_time') {
          const rankResult = await getUserRank();
          if (rankResult.success && rankResult.rank) {
            setUserRank(rankResult.rank);
          }
        } else {
          setUserRank(null); // Non mostriamo rank per classifiche temporanee
        }
      } else {
        setError(result.error || 'Errore nel caricamento');
      }
    } catch (err) {
      setError('Impossibile caricare la classifica');
    } finally {
      setLoading(false);
    }
  }

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const leader = entries[0];
  const gapToLeader = leader && profile ? Math.max(0, leader.totalScore - profile.total_score) : null;

  return (
    <div className="relative flex min-h-screen flex-col gap-4 overflow-hidden bg-ink px-4 pb-[220px] pt-12 text-chalk">
      <header className="flex items-center justify-between">
        <h1 className="disp text-[34px]">Classifica</h1>
        <button
          type="button"
          aria-label="Aggiorna"
          onClick={loadLeaderboard}
          disabled={loading}
          className="btn flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-turf-1"
        >
          <RefreshCw className={cn('ref h-[18px] w-[18px]', loading && 'animate-spin')} strokeWidth={2} />
        </button>
      </header>

      <div className="rail -mx-4 flex gap-1.5 overflow-x-auto px-4">
        {FILTERS.map((filter) => (
          <Chip
            key={filter.id}
            selected={leaderboardType === filter.id}
            tone={filter.hard ? 'ember' : 'volt'}
            onClick={() => setLeaderboardType(filter.id)}
          >
            {filter.hard && <Flame className="mr-1 h-3.5 w-3.5" />}
            {filter.label}
          </Chip>
        ))}
      </div>

      {loading && entries.length === 0 ? (
        <PitchSkeleton rows={5} />
      ) : error ? (
        <div className="py-16 text-center">
          <p className="mb-4 text-sm text-ember-light">{error}</p>
          <Button variant="ghost" onClick={loadLeaderboard}>
            Riprova
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={leaderboardType === 'friends' ? <Users className="h-6 w-6" /> : leaderboardType === 'hard' ? <Flame className="h-6 w-6" /> : <Trophy className="h-6 w-6" />}
          title={
            leaderboardType === 'friends'
              ? 'Nessun amico in classifica'
              : leaderboardType === 'hard'
                ? 'Nessuno in classifica hard'
                : 'Nessun utente in classifica'
          }
          subtitle={
            leaderboardType === 'friends'
              ? 'Aggiungi amici dal tuo profilo per vederli qui!'
              : leaderboardType === 'hard'
                ? 'Gioca in modalità Hard per entrare!'
                : 'Completa delle partite per entrare!'
          }
        />
      ) : (
        <>
          {podium.length === 3 && (
            <section className="grid h-[250px] grid-cols-[1fr_1.1fr_1fr] items-end gap-2">
              <PodiumColumn entry={podium[1]} place="silver" isCurrentUser={podium[1].userId === user?.id} />
              <PodiumColumn entry={podium[0]} place="gold" isCurrentUser={podium[0].userId === user?.id} />
              <PodiumColumn entry={podium[2]} place="bronze" isCurrentUser={podium[2].userId === user?.id} />
            </section>
          )}

          <div className="flex flex-col gap-1.5">
            {(podium.length === 3 ? rest : entries).map((entry, index) => (
              <div
                key={entry.userId}
                className="row-hover row-in flex h-14 items-center gap-3 rounded-np-lg bg-turf-1 px-3.5"
                style={{ animationDelay: `${0.05 + index * 0.04}s` }}
              >
                <span className="mono w-6 text-[13px] text-label">{entry.rank}</span>
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-turf-3 text-xs font-bold">
                  {displayNameOf(entry).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  <span className="truncate text-sm font-semibold">{displayNameOf(entry)}</span>
                  <span className="mono text-[11px] text-label">{entry.matchesPlayed} partite</span>
                </div>
                <span className="mono text-[15px] font-semibold text-chalk-2">{entry.totalScore}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {userRank && userRank <= 100 && (
        <div className="shadow-np-sheet fixed bottom-[104px] left-4 right-4 z-30 flex h-[60px] items-center gap-3 rounded-np-xl bg-turf-2 px-3.5" style={{ boxShadow: '0 0 0 1.5px var(--color-volt), 0 16px 40px -10px rgba(0,0,0,.9)' }}>
          <span className="disp w-[34px] text-xl text-volt">#{userRank}</span>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">La tua posizione</span>
            <span className="mono text-[11px] text-chalk-2">
              {userRank === 1 ? 'Sei primo in classifica' : gapToLeader !== null ? `${gapToLeader} pt dal primo` : ''}
            </span>
          </div>
          <span className="mono text-lg font-semibold">{profile?.total_score ?? 0}</span>
        </div>
      )}
    </div>
  );
}

export default LeaderboardScreen;
