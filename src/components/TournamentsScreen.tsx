import { useState } from 'react';
import { useAuthStore } from '../authStore';
import { useTournaments } from './tournament/useTournaments';
import { TournamentListView, TournamentCreateForm, TournamentDetailView, TournamentHistoryView } from './tournament/TournamentViews';
import { ConfirmDialog } from './profile/ConfirmDialog';
import { ArrowLeft, Trophy, History } from 'lucide-react';

interface TournamentsScreenProps {
  onBack: () => void;
}

export function TournamentsScreen({ onBack }: TournamentsScreenProps) {
  const { user } = useAuthStore();
  const [mainTab, setMainTab] = useState<'open' | 'history'>('open');
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
      <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFD700]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Torna alla Home</span>
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#FFD700]" />
            Tornei
          </h1>
        </header>

        {tournamentDetail ? (
          loadingDetail ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#FFD700]"></div>
            </div>
          ) : (
            <TournamentDetailView
              detail={tournamentDetail}
              currentUserId={user.id}
              joining={joining}
              onJoin={async () => {
                if (tournamentDetail) await handleJoin(tournamentDetail.tournament.id);
              }}
              onLeave={async () => {
                if (tournamentDetail) await handleLeave(tournamentDetail.tournament.id);
              }}
              onCancel={() => {
                if (tournamentDetail) setConfirmCancel({ id: tournamentDetail.tournament.id, name: tournamentDetail.tournament.name });
              }}
              onBack={closeDetail}
            />
          )
        ) : (
          <>
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setMainTab('open')}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  mainTab === 'open' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Trophy className="w-4 h-4 inline mr-2" />
                Disponibili
              </button>
              <button
                onClick={() => setMainTab('history')}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  mainTab === 'history' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <History className="w-4 h-4 inline mr-2" />
                Storico
              </button>
            </div>

            {mainTab === 'open' && (
              showCreateForm ? (
                <TournamentCreateForm
                  creating={creating}
                  error={error}
                  onCancel={() => { setShowCreateForm(false); setError(null); }}
                  onSubmit={async (name, maxPlayers, league, difficulty, startMode, scheduledAt) => {
                    await handleCreate(name, maxPlayers, league, difficulty, startMode, scheduledAt);
                    setShowCreateForm(false);
                  }}
                />
              ) : (
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
              )
            )}

            {mainTab === 'history' && (
              <TournamentHistoryView history={history} loading={loadingHistory} />
            )}
          </>
        )}
      </div>

      {confirmCancel && (
        <ConfirmDialog
          title="Cancellare il torneo?"
          message={`"${confirmCancel.name}" verrà cancellato per tutti gli iscritti. L'operazione non è reversibile.`}
          confirmLabel="Cancella torneo"
          onCancel={() => setConfirmCancel(null)}
          onConfirm={async () => {
            const id = confirmCancel.id;
            setConfirmCancel(null);
            await handleCancel(id);
          }}
        />
      )}
    </div>
  );
}
