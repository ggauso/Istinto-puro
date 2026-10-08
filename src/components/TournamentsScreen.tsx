import { useState } from 'react';
import { useAuthStore } from '../authStore';
import { useTournaments } from './tournament/useTournaments';
import { TournamentListView, TournamentCreateForm, TournamentDetailView, TournamentHistoryView } from './tournament/TournamentViews';
import { AlertDialog } from './ui/AlertDialog';
import { AlertIconBadge } from './ui/AlertIconBadge';
import { Button } from './ui/Button';
import { SegmentedControl } from './ui/SegmentedControl';
import { BallBounceLoader } from './ui/loaders/BallBounceLoader';
import { ArrowLeft, Trash2 } from 'lucide-react';

interface TournamentsScreenProps {
  onBack: () => void;
}

type MainTab = 'open' | 'history';

export function TournamentsScreen({ onBack }: TournamentsScreenProps) {
  const { user } = useAuthStore();
  const [mainTab, setMainTab] = useState<MainTab>('open');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<{ id: string; name: string } | null>(null);

  const {
    openTournaments, loadingOpen, history, loadingHistory,
    tournamentDetail, loadingDetail,
    creating, joining, error, setError,
    loadTournamentDetail, closeDetail,
    handleCreate, handleJoin, handleLeave, handleCancel,
  } = useTournaments(user?.id);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <BallBounceLoader />
      </div>
    );
  }

  const showSubHeader = showCreateForm || !!tournamentDetail;
  const subHeaderTitle = tournamentDetail ? tournamentDetail.tournament.name : 'Nuovo torneo';

  const handleSubBack = () => {
    if (tournamentDetail) {
      closeDetail();
    } else {
      setShowCreateForm(false);
      setError(null);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col gap-4 overflow-hidden bg-ink px-4 pb-[140px] pt-12 text-chalk">
      <header className="flex items-center gap-3">
        {showSubHeader ? (
          <>
            <button
              type="button"
              onClick={handleSubBack}
              aria-label="Indietro"
              className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-turf-1"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
            <h1 className="disp min-w-0 flex-1 truncate text-[28px]">{subHeaderTitle}</h1>
          </>
        ) : (
          <>
            <h1 className="disp flex-1 text-[34px]">Tornei</h1>
            <SegmentedControl
              options={[
                { value: 'open', label: 'Aperti' },
                { value: 'history', label: 'Storico' },
              ]}
              value={mainTab}
              onChange={(v) => setMainTab(v as MainTab)}
            />
          </>
        )}
      </header>

      {tournamentDetail ? (
        loadingDetail ? (
          <div className="flex justify-center py-12">
            <BallBounceLoader />
          </div>
        ) : (
          <TournamentDetailView
            detail={tournamentDetail}
            currentUserId={user.id}
            joining={joining}
            onJoin={async () => {
              await handleJoin(tournamentDetail.tournament.id);
            }}
            onLeave={async () => {
              await handleLeave(tournamentDetail.tournament.id);
            }}
            onCancel={() => setConfirmCancel({ id: tournamentDetail.tournament.id, name: tournamentDetail.tournament.name })}
          />
        )
      ) : showCreateForm ? (
        <TournamentCreateForm
          creating={creating}
          error={error}
          onSubmit={async (name, maxPlayers, league, difficulty, startMode, scheduledAt) => {
            await handleCreate(name, maxPlayers, league, difficulty, startMode, scheduledAt);
            setShowCreateForm(false);
          }}
        />
      ) : mainTab === 'open' ? (
        <TournamentListView
          tournaments={openTournaments}
          loading={loadingOpen}
          joining={joining}
          currentUserId={user.id}
          onJoin={(id) => handleJoin(id)}
          onOpenDetail={(id) => loadTournamentDetail(id)}
          onCancel={(id) => {
            const t = openTournaments.find((o) => o.id === id);
            setConfirmCancel({ id, name: t?.name || 'questo torneo' });
          }}
          onCreateClick={() => setShowCreateForm(true)}
        />
      ) : (
        <TournamentHistoryView history={history} loading={loadingHistory} />
      )}

      <AlertDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        icon={<AlertIconBadge icon={<Trash2 className="h-[26px] w-[26px]" strokeWidth={2.2} />} wobble />}
        title="Cancellare il torneo?"
        description={confirmCancel ? `"${confirmCancel.name}" verrà cancellato per tutti gli iscritti. L'operazione non è reversibile.` : ''}
        actions={
          <>
            <Button variant="chalk" onClick={() => setConfirmCancel(null)}>
              Annulla
            </Button>
            <Button
              variant="text-ember"
              onClick={async () => {
                if (!confirmCancel) return;
                const id = confirmCancel.id;
                setConfirmCancel(null);
                await handleCancel(id);
              }}
            >
              Cancella torneo
            </Button>
          </>
        }
      />
    </div>
  );
}
