import { useState } from 'react';
import { useAuthStore } from '../authStore';
import { calculateTier, TIER_CONFIG } from '../types/game';
import { useFriendsAndChallenges } from './profile/useFriendsAndChallenges';
import { EditProfileSheet } from './profile/EditProfileSheet';
import { ProfileStatsTab } from './profile/ProfileStatsTab';
import { ProfileFriendsTab } from './profile/ProfileFriendsTab';
import { ProfileAchievementsTab } from './profile/ProfileAchievementsTab';
import { ProfileHistoryTab } from './profile/ProfileHistoryTab';
import { ProfileShopTab } from './profile/ProfileShopTab';
import { SegmentedControl } from './ui/SegmentedControl';
import { Toast } from './ui/Toast';
import { Pencil, Coins } from 'lucide-react';
import { BallBounceLoader } from './ui/loaders/BallBounceLoader';

type ProfileTab = 'stats' | 'achievements' | 'history' | 'friends';

interface ProfileScreenProps {
  onBack: () => void;
  initialTab?: ProfileTab;
}

const TABS: { value: ProfileTab; label: string }[] = [
  { value: 'stats', label: 'Stats' },
  { value: 'achievements', label: 'Trofei' },
  { value: 'history', label: 'Storico' },
  { value: 'friends', label: 'Amici' },
];

export function ProfileScreen({ onBack, initialTab = 'stats' }: ProfileScreenProps) {
  const { user, profile } = useAuthStore();

  const [mainTab, setMainTab] = useState<ProfileTab>(initialTab);
  const [friendsTab, setFriendsTab] = useState<'search' | 'friends' | 'requests' | 'challenges'>('search');
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showShop, setShowShop] = useState(false);

  const {
    friends,
    friendRequests,
    loadingFriends,
    pendingChallenges,
    challengeHistory,
    loadingChallenges,
    toastWithAction,
    dismissToastWithAction,
    reloadFriends,
    reloadChallenges,
  } = useFriendsAndChallenges(user?.id, (tab) => {
    setMainTab('friends');
    setFriendsTab(tab);
  });

  if (!user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <BallBounceLoader />
      </div>
    );
  }

  if (showShop) {
    return <ProfileShopTab onBack={() => setShowShop(false)} />;
  }

  const tier = calculateTier(profile.total_score);
  const displayName = profile.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : user.email?.split('@')[0] || 'Giocatore';
  const initials = (profile.nickname || profile.first_name || displayName).slice(0, 2).toUpperCase();

  return (
    <div className="relative flex min-h-screen flex-col gap-4 overflow-hidden bg-ink px-4 pb-[140px] pt-12 text-chalk">
      <header className="flex items-center gap-3.5">
        <span
          className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[24px_24px_24px_6px] p-[3px]"
          style={{ background: 'conic-gradient(from 180deg, var(--color-volt) 0 50%, var(--color-turf-3) 50%)' }}
        >
          <span className="disp flex h-full w-full items-center justify-center rounded-[21px_21px_21px_4px] border-[3px] border-ink bg-turf-2 text-2xl">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full rounded-[21px_21px_21px_4px] object-cover" />
            ) : (
              initials
            )}
          </span>
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="disp truncate text-2xl" style={{ fontStretch: '105%' }}>
            {displayName}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <span className="cond flex h-6 items-center rounded-np-pill px-2.5 text-[11px]" style={{ background: 'color-mix(in srgb, var(--tier-' + tier + '-label) 14%, transparent)', color: `var(--tier-${tier}-label)` }}>
              {TIER_CONFIG[tier].label}
            </span>
            {profile.favorite_team && (
              <span className="cond flex h-6 items-center rounded-np-pill bg-turf-2 px-2.5 text-[11px] text-chalk-2">
                Tifoso {profile.favorite_team}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowShop(true)}
              className="mono flex h-6 items-center gap-1 rounded-np-pill bg-[rgba(242,193,78,.12)] px-2.5 text-[11px] font-bold text-[#FFD36E]"
            >
              <Coins className="h-3 w-3" strokeWidth={2.4} />
              {profile.coins ?? 0}
            </button>
          </div>
          {profile.nickname && <span className="mono text-xs text-label">@{profile.nickname}</span>}
        </div>

        <button
          type="button"
          aria-label="Modifica profilo"
          onClick={() => setShowEditSheet(true)}
          className="btn flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-turf-1"
        >
          <Pencil className="h-[17px] w-[17px]" strokeWidth={2} />
        </button>
      </header>

      <SegmentedControl options={TABS} value={mainTab} onChange={(v) => setMainTab(v as ProfileTab)} />

      {mainTab === 'stats' && <ProfileStatsTab />}
      {mainTab === 'achievements' && <ProfileAchievementsTab />}
      {mainTab === 'history' && <ProfileHistoryTab />}
      {mainTab === 'friends' && (
        <ProfileFriendsTab
          currentUserId={user.id}
          friendsTab={friendsTab}
          setFriendsTab={setFriendsTab}
          friends={friends}
          friendRequests={friendRequests}
          loadingFriends={loadingFriends}
          pendingChallenges={pendingChallenges}
          challengeHistory={challengeHistory}
          loadingChallenges={loadingChallenges}
          reloadFriends={reloadFriends}
          reloadChallenges={reloadChallenges}
        />
      )}

      <EditProfileSheet open={showEditSheet} onClose={() => setShowEditSheet(false)} onSignedOut={onBack} />

      {toastWithAction && (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto">
            <Toast
              tone={toastWithAction.type === 'success' ? 'success' : toastWithAction.type === 'error' ? 'error' : 'info'}
              message={toastWithAction.message}
              actionLabel={toastWithAction.action ? toastWithAction.actionLabel : undefined}
              onAction={() => {
                toastWithAction.action?.();
                dismissToastWithAction();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
