import { useEffect, useState } from 'react';
import {
  getOpenTournaments, createTournament, joinTournament, leaveTournament, cancelTournament,
  getTournamentDetails, getMyTournamentHistory,
  type Tournament, type TournamentDetails, type TournamentParticipant, type TournamentMatch, type TournamentHistoryEntry
} from '../../lib/api/tournaments';

export interface TournamentDetailState {
  tournament: TournamentDetails;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
}

/**
 * Stato della schermata Tornei: lista tornei aperti, storico, dettaglio/
 * bracket del torneo selezionato, handler di creazione/iscrizione/uscita.
 */
export function useTournaments(currentUserId: string | undefined) {
  const [openTournaments, setOpenTournaments] = useState<Tournament[]>([]);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [history, setHistory] = useState<TournamentHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [tournamentDetail, setTournamentDetail] = useState<TournamentDetailState | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reloadOpenTournaments() {
    setLoadingOpen(true);
    const result = await getOpenTournaments();
    if (result.success) setOpenTournaments(result.tournaments);
    setLoadingOpen(false);
  }

  async function reloadHistory() {
    setLoadingHistory(true);
    const result = await getMyTournamentHistory();
    if (result.success) setHistory(result.history);
    setLoadingHistory(false);
  }

  async function loadTournamentDetail(tournamentId: string) {
    setLoadingDetail(true);
    setSelectedTournamentId(tournamentId);
    const result = await getTournamentDetails(tournamentId);
    if (result.success && result.tournament) {
      setTournamentDetail({ tournament: result.tournament, participants: result.participants, matches: result.matches });
    }
    setLoadingDetail(false);
  }

  function closeDetail() {
    setSelectedTournamentId(null);
    setTournamentDetail(null);
  }

  async function handleCreate(
    name: string,
    maxPlayers: number,
    league: string,
    difficulty: number,
    startMode: 'fill' | 'scheduled' = 'fill',
    scheduledAt: string | null = null
  ) {
    setCreating(true);
    setError(null);
    const result = await createTournament(name, maxPlayers, league, difficulty, startMode, scheduledAt);
    if (result.success && result.tournamentId) {
      await reloadOpenTournaments();
      await loadTournamentDetail(result.tournamentId);
    } else {
      setError(result.error || 'Errore nella creazione del torneo');
    }
    setCreating(false);
  }

  async function handleJoin(tournamentId: string) {
    setJoining(true);
    setError(null);
    const result = await joinTournament(tournamentId);
    if (result.success) {
      await reloadOpenTournaments();
      await loadTournamentDetail(tournamentId);
    } else {
      setError(result.error || "Errore nell'iscrizione al torneo");
    }
    setJoining(false);
  }

  async function handleLeave(tournamentId: string) {
    const ok = await leaveTournament(tournamentId);
    if (ok) {
      closeDetail();
      await reloadOpenTournaments();
    }
    return ok;
  }

  async function handleCancel(tournamentId: string) {
    const ok = await cancelTournament(tournamentId);
    if (ok) {
      closeDetail();
      await reloadOpenTournaments();
    }
    return ok;
  }

  useEffect(() => {
    if (!currentUserId) return;
    reloadOpenTournaments();
    reloadHistory();
  }, [currentUserId]);

  return {
    openTournaments, loadingOpen, history, loadingHistory,
    selectedTournamentId, tournamentDetail, loadingDetail,
    creating, joining, error, setError,
    reloadOpenTournaments, reloadHistory, loadTournamentDetail, closeDetail,
    handleCreate, handleJoin, handleLeave, handleCancel,
  };
}
