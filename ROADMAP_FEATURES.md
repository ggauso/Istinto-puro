# Roadmap Feature di Gioco - Istinto Puro

## 📋 Panoramica

Questo documento definisce le milestone e i task per implementare le nuove feature di gioco.

> **Nota sui riferimenti a file storici**: le milestone sotto citano spesso
> file come `supabase/alter-XXX.sql` o `src/lib/rpc-client.ts`/`src/store.ts`
> — erano corretti al momento in cui la feature è stata realizzata. Il
> 2026-09-19 questi file sono stati riorganizzati (vedi Milestone 0): gli
> `alter-*.sql` sono confluiti in `supabase/schema/` (10 file per dominio,
> originali archiviati in `supabase/migrations_archive/`), `rpc-client.ts`
> è diviso in `src/lib/api/*.ts`, `store.ts` in `src/store/*.ts`. I
> riferimenti storici restano per capire *quando/perché* una feature è
> nata, non sono più i percorsi reali dei file.

---

## 🧱 MILESTONE 0: Infrastruttura, Sicurezza e Qualità del Codice

**Stato:** ✅ Completato (2026-09-19), tranne import dati in corso

Lavoro non di "feature" ma che cambia come si sviluppa/deploya da qui in poi:

### Ambiente locale Docker
- [x] Stack Supabase self-hosted in Docker (Postgres, Auth, PostgREST, Realtime, Studio, Mailpit) — nessuna dipendenza da Supabase Cloud per sviluppare in locale. Vedi `DOCKER.md`.
- [x] Import dati da API-Football: **in corso**, non completo — aggiornato al 2026-10-06: **100 squadre / 2785 giocatori / 3296 player_teams**. Stagione 2022 completa per tutte e 5 le top leghe; stagione 2023 avviata (Premier League 10/20 squadre). Fermo per quota giornaliera API-Football esaurita. Riprende da solo con `npm run import-data` (checkpoint in `import-state.json`), serve rilanciarlo più giorni di seguito per completare 2023+2024 su tutte le leghe.

### Audit di sicurezza e fix
- [x] Trovate e corrette vulnerabilità di controllo accessi su RPC critiche: `save_match_result`/`update_profile_stats` (chiunque poteva forgiare punteggi altrui), `complete_friend_challenge`/`abandon_friend_challenge` (chiunque poteva falsificare/invalidare l'esito di una sfida altrui), `run_retention_cleanup` (cancellazione dati chiamabile da chiunque). Dettaglio completo in `ROADMAP_SECURITY.md`.
- [ ] **Da fare**: applicare la fix anche al progetto Supabase Cloud di produzione (per ora è solo sul DB Docker locale).
- [ ] **Non risolto, richiede decisione di prodotto**: rate-limiting login (`record_login_attempt`) resta aggirabile per design (deve restare chiamabile senza sessione).

### Consolidamento schema SQL
- [x] 26 file storici (`schema.sql`, `alter-002`...`alter-022`, spesso con la stessa funzione ridefinita 3-5 volte) sostituiti da 10 file puliti per dominio in `supabase/schema/`. Corretti nel processo: PK sbagliata su `leaderboard_weekly`/`monthly`, colonne `teams.league_id`/`player_teams.season` mai migrate esplicitamente, tabella `audit_log` con due definizioni incompatibili in file diversi. Verificato riproducendo lo schema in un container isolato.

### Refactor frontend
- [x] `src/lib/rpc-client.ts` (1965 righe, 48 funzioni, 13 mai usate) diviso in 9 moduli per dominio in `src/lib/api/`.
- [x] `src/store.ts` (677 righe) diviso in slice Zustand (`src/store/matchmakingSlice.ts`/`gameplaySlice.ts`/`lifecycleSlice.ts`).
- [x] `ProfileScreen.tsx` (1674→154 righe) e `ChallengeScreen.tsx` (589 righe) divisi in sotto-componenti/hook dedicati.
- [x] Corretto un bug funzionale pre-esistente: `removeFriend()` lasciava le amicizie asimmetriche dopo la rimozione (ora usa l'RPC server-side `remove_friend()`).
- [x] 139 test (era 103 nella documentazione, conteggio disallineato — corretto). Aggiornato al 2026-10-06: **156 test** su 9 file (aggiunto `tournaments.test.ts`, 15 test).

### Bug fix trasversali (2026-10-06)
Check-up generale su richiesta utente, tre bug confermati e corretti (nessuno specifico di una sola milestone):
- [x] **Link di invito → "page not found" in produzione**: `server.ts` serviva `dist/` staticamente senza fallback SPA; una navigazione diretta a `/sfida/<token>` riceveva un 404 raw da Express prima che il router client-side potesse intercettarla. Aggiunto catch-all `app.get('*', ...)` → `dist/index.html`. Collegato: i link (`HomeScreen.tsx`, `ChallengeViews.tsx`) costruivano l'URL con dominio hardcoded `https://istintopuro.com` invece di `window.location.origin` — un link copiato da un ambiente diverso (es. locale) puntava a un dominio sbagliato. Entrambi corretti.
- [x] **Desincronizzazione round PvP** ("ogni tanto ad un utente parte prima e all'altro dopo"): host e guest generavano ciascuno un proprio `roundStartTime` con `Date.now()` (l'host al momento dell'invio del broadcast, il guest alla ricezione, dopo latenza di rete variabile), e il countdown locale decrementava indipendentemente da quel valore. Fix: l'host include il proprio `roundStartTime` nel payload `game_start`, il guest lo riusa invece di generarne uno proprio, e il countdown (`tickTimer`) è ricalcolato dal tempo reale trascorso rispetto a quel timestamp condiviso (vedi `ROUND_DURATION_MS`/`getRemainingSeconds` in `src/store/types.ts`).
- [x] **Abbandono partita non notificato all'avversario**: `abandonMatch()` inviava il broadcast `opponent_abandoned` senza attenderne la consegna, poi chiamava subito `resetGame()` (rimuove il canale realtime) — race condition che poteva cancellare il messaggio prima che raggiungesse il server, lasciando l'avversario bloccato in partita. Fix: `abandonMatch()` ora è `async` e attende (`await`) l'invio (il canale usa `ack: true`) prima di resettare lo stato. Bug trasversale a tutte le modalità PvP (matchmaking libero, sfide link/amico, tornei), non specifico di una feature.

### Bug fix segnalati dall'utente su Sfide tra Amici (2026-10-06)
- [x] **Manca "Tutti i Campionati" nella sfida diretta a un amico**: `ChallengeFriendModal.tsx` non aveva mai avuto questa opzione nel select campionato (presente invece nel matchmaking singolo/PvP e nei tornei, Milestone 5 Task 5.5.5), e il CHECK su `friend_challenges.league` nel DB non ammetteva comunque il valore `'all'`. Corretto in entrambi i punti (`supabase/schema/17_friend_challenges_all_leagues.sql` per il CHECK, stesso fix già fatto per `tournaments.league`). Il resto della catena (mappatura campionato→id numerico, gestione di un campionato `undefined` come "nessun filtro") funzionava già senza modifiche, riusando lo stesso meccanismo dei tornei (`LEAGUE_TEXT_TO_ID` in `src/lib/api/friend-challenges.ts`).
- [x] **"Home" a fine sfida non torna alla Home ma ricarica la sfida conclusa**: il bottone "Home" in `GameScreen.tsx` chiamava solo `resetGame()` (reset dello stato di gioco in memoria), mai un cambio di URL. Chi raggiunge una partita PvP tramite `/sfida/<token>` (sfida link o sfida amico — **succede a entrambi i giocatori**, non solo a chi riceve la sfida: anche il creatore viene reindirizzato a quell'URL quando l'altro accetta) resta su quell'URL per tutta la partita. Cliccando "Home" manualmente, lo stato tornava a `idle` ma l'URL restava `/sfida/<token>`: `App.tsx` ricadeva nel ramo `currentScreen === 'challenge'` e ricaricava la sfida (ormai completata/abbandonata) invece di andare alla Home — a differenza del redirect automatico dopo 10s di fine partita, che usa `window.location.href = '/'` e quindi pulisce correttamente l'URL. Fix: il bottone "Home" ora fa lo stesso redirect a pagina intera invece del solo `resetGame()`.

---

## 🔵 MILESTONE 1: Identità Utente in Partita

**Tempo stimato:** 2-3 ore
**Priorità:** ALTA

### Task 1.1: Mostrare nome utente all'avversario
- [x] **Task 1.1.1:** Modificare RPC `get_random_match` per restituire `match_id` univoco (infrastructure ready)
- [x] **Task 1.1.2:** Creare tabella `matches` per tracciare partite in corso (alter-002-gioco.sql)
- [x] **Task 1.1.3:** Quando un utente anonymous gioca, assegnare nome "guest-{numero casuale}" (implementato in game-utils.ts)
- [x] **Task 1.1.4:** Mostrare il nome dell'avversario nella UI di gioco (implementato in GameScreen)
- [x] **Task 1.1.5:** Aggiungere campo nickname al profilo utente (alter-003-nickname.sql + ProfileScreen + store.ts)

### Task 1.2: Tracciare partite giocate
- [x] **Task 1.2.1:** Creare tabella `matches_history` per storico partite (alter-002-gioco.sql)
- [x] **Task 1.2.2:** Salvare risultato partita alla fine (vittoria/sconfitta, punteggio) (store.ts saveMatchResultToDb)
- [x] **Task 1.2.3:** Associare match all'utente se loggato

---

## 🟢 MILESTONE 2: Classifica Generale

**Tempo stimato:** 2-3 ore
**Priorità:** ALTA

### Task 2.1: Classifica globale (all-time)
- [x] **Task 2.1.1:** Creare funzione RPC `get_leaderboard` per ottenere top 100 utenti (infrastructure ready)
- [x] **Task 2.1.2:** Creare componente UI `LeaderboardScreen` (da implementare - serve DB)
- [x] **Task 2.1.3:** Mostrare posizione dell'utente corrente nella classifica (calculateRank implementato)

### Task 2.2: Classifiche temporali
- [x] **Task 2.2.1:** Aggiungere campi per classifiche settimanali/mensili (infrastructure ready)
- [x] **Task 2.2.2:** Resettare classifiche temporali ogni settimana/mese (automatico con get_week_start/get_month_start)
- [x] **Task 2.2.3:** UI per commutare tra classifiche (LeaderboardScreen.tsx)
- [ ] **(OPZIONALE) Task 2.2.4:** Creare cron job per cleanup automatico vecchie classifiche (eseguire `cleanup_old_leaderboards()` periodicamente)

---

## 🟡 MILESTONE 3: Cluster di Bravura (Tier System)

**Tempo stimato:** 2-3 ore
**Priorità:** MEDIA

### Task 3.1: Definire tier system
- [x] **Task 3.1.1:** Definire range di punteggio per ogni tier:
  - Bronze: 0-500
  - Silver: 501-1500
  - Gold: 1501-3000
  - Platinum: 3001-5000
  - Diamond: 5001+
- [x] **Task 3.1.2:** Aggiornare profilo utente con campo `tier` (infrastructure ready)
- [x] **Task 3.1.3:** Auto-calcolare tier quando cambia il punteggio (calculateTier implementato)

### Task 3.2: Visualizzazione tier
- [x] **Task 3.2.1:** Mostrare badge/icona tier nel profilo utente (implementato in ProfileScreen)
- [x] **Task 3.2.2:** Mostrare tier dell'avversario durante la partita (implementato in GameScreen)
- [x] **Task 3.2.3:** Mostrare progresso tier nel profilo utente (implementato in ProfileScreen)

---

## 🟠 MILESTONE 4: Test e Validazione

**Tempo stimato:** 1-2 ore
**Priorità:** CRITICA

### Task 4.1: Test esistenti
- [ ] **Task 4.1.1:** Verificare che tutti i test passano prima delle modifiche
- [ ] **Task 4.1.2:** Eseguire test dopo ogni task completato

### Task 4.2: Nuovi test
- [ ] **Task 4.2.1:** Test per validazione tier
- [ ] **Task 4.2.2:** Test per classifica (ordinamento corretto)
- [ ] **Task 4.2.3:** Test per generazione nomi guest

---

## 🏆 MILESTONE 5: Tornei ✅ COMPLETATO (2026-10-05, esteso 2026-10-06)

**Tempo stimato:** 3-4 ore
**Priorità:** ALTA
**Stato:** ✅ Implementato e verificato end-to-end (schema, bracket, UI, integrazione partita reale). Esteso il 2026-10-06 con cancellazione, schedulazione e opzione "tutti i campionati" — vedi Task 5.5.

Eliminazione diretta, iscrizione libera (2/4/8/16 giocatori), bracket generato
automaticamente, storico risultati — riusa il meccanismo di join-room realtime
già esistente per le sfide dirette. Schema: `supabase/schema/11_tournaments.sql`.
Client: `src/lib/api/tournaments.ts`, `src/components/tournament/*`,
`src/components/TournamentsScreen.tsx`. Test: `src/test/tournaments.test.ts`.

### Task 5.1: Struttura Tornei
- [x] **Task 5.1.1:** Tabella `tournaments` (nome, max_players, league, difficulty, stato, creator/winner)
- [x] **Task 5.1.2:** Tabella `tournament_participants` (utente, torneo, stato, round eliminazione, posizione finale)
- [x] **Task 5.1.3:** Tabella `tournament_matches` (torneo, round, match_number, player1/2, winner, room_id)

### Task 5.2: Iscrizione Tornei
- [x] **Task 5.2.1:** UI "Disponibili"/"Storico" per visualizzare tornei
- [x] **Task 5.2.2:** Bottone iscrizione — sia dalla lista sia dal dettaglio di un torneo appena creato
- [x] **Task 5.2.3:** Limite posti con claim atomico (`current_players < max_players`), niente overbooking in caso di iscrizioni concorrenti

### Task 5.3: Svolgimento Tornei
- [x] **Task 5.3.1:** Generazione bracket automatico a torneo pieno (accoppiamento casuale round 1)
- [x] **Task 5.3.2:** Round con match singolo, avanzamento idempotente (lock di riga, no doppia generazione round)
- [x] **Task 5.3.3:** Determinazione vincitore (premi/ricompense fuori scope, rimandati a Milestone 9)

### Task 5.4: Classifica Tornei
- [x] **Task 5.4.1:** Bracket visibile nel dettaglio torneo durante la competizione
- [x] **Task 5.4.2:** Posizione finale a pari merito per round di eliminazione (`max_players / 2^round + 1`)
- [x] **Task 5.4.3:** Storico tornei completati (tab "Storico")

**Verifica eseguita:** `npm test` (156/156 pass, incluso `tournaments.test.ts` e
regressione su `friend-challenges.test.ts`), `tsc --noEmit` (nessun nuovo errore
rispetto al baseline pre-esistente), simulazione bracket a 4 giocatori diretta
su Postgres reale (round 1→2, posizioni finali, idempotenza), e verifica
browser end-to-end (Playwright headless, 2 account reali): creazione torneo,
iscrizione, auto-avvio a 2/2, bracket con nickname corretti, pairing realtime,
partita giocata fino al Round 2 con dati squadra corretti.

Due bug reali trovati e corretti durante la verifica:
1. **Bottone iscrizione mancante** nel dettaglio di un torneo appena creato
   (il creatore non aveva modo di iscriversi al proprio torneo senza tornare
   alla lista) — aggiunto in `TournamentDetailView`.
2. **Nickname vuoti / "TBD" nel bracket**: `COALESCE(nickname, first_name, 'Giocatore')`
   non gestiva il caso di `first_name` impostato a stringa vuota (non NULL) su
   alcuni account di test più vecchi — corretto con `COALESCE(NULLIF(..,''), ...)`
   in tutte le funzioni di lettura dello schema tornei.

Nota: durante la verifica è emerso un bug **pre-esistente e condiviso** con le
sfide-amico (non introdotto dai tornei): il client non-host restava bloccato
su "Connessione in corso..." per un errore 422 sul broadcast `guest_ready`.
Causa radice: crash ricorrente di Realtime/Postgres dovuto al bind-mount dei
dati Postgres su virtiofs (Colima) — risolto migrando a un volume Docker
nativo (vedi DOCKER.md, sezione "Bug noto (risolto)"). Pairing ri-verificato
dopo il fix: entrambi i giocatori entrano in partita entro pochi secondi,
nessun errore.

### Task 5.5: Gestione torneo — cancellazione, schedulazione, tutti i campionati (2026-10-06)
Richiesto dall'utente dopo il primo giro di test in app: non era possibile
cancellare un torneo né schedularne data/ora, e mancava l'opzione "tutti i
campionati" presente invece nel matchmaking singolo/PvP.
- [x] **Task 5.5.1:** RPC `cancel_tournament(p_tournament_id)` — soft-delete via `status = 'cancelled'` (enum già previsto, mai usato prima), solo per il creatore e solo se il torneo è ancora `open`
- [x] **Task 5.5.2:** Colonne `start_mode` (`fill`/`scheduled`), `scheduled_at`, `total_rounds` su `tournaments`; `create_tournament` accetta i nuovi parametri opzionali
- [x] **Task 5.5.3:** RPC `start_due_tournaments()` — avvia i tornei schedulati il cui orario è arrivato, anche con meno iscritti di `max_players` (minimo 2), invocata da un polling client ogni 30s in `App.tsx` (nessun `pg_cron` nel progetto)
- [x] **Task 5.5.4:** Bracket con supporto "bye" in `_start_tournament`/`_finalize_tournament_match`: con un numero di iscritti non potenza di 2 (avvio anticipato schedulato), chi non trova avversario al round 1 passa direttamente al round 2; `total_rounds` sostituisce il calcolo fisso da `max_players` per le posizioni finali
- [x] **Task 5.5.5:** Opzione **"Tutti i Campionati"** (`league = 'all'`) in creazione torneo, allineata al matchmaking singolo/PvP — richiesto aggiornare il CHECK su `tournaments.league` e la mappatura campionato→id numerico lato client per i match di torneo
- [x] **Task 5.5.6:** UI: card della lista tornei interamente cliccabile (apre il dettaglio), icona cestino sulla card per il creatore, dialog di conferma (componente riusabile `ConfirmDialog`, già usato per rimuovere amici) prima di eseguire la cancellazione sia dalla lista che dal dettaglio

**Nota operativa**: le migrazioni in `docker/volumes/db/migrations/`
girano **solo alla primissima inizializzazione** del volume dati Postgres.
Il container Docker locale era già attivo da 25 ore quando questa modifica
è stata scritta: è stato necessario applicarla a mano al DB vivo (ruolo
`supabase_admin`, gestione di un conflitto di overload su `create_tournament`
e `get_open_tournaments`, `NOTIFY pgrst, 'reload schema'` per far vedere i
nuovi campi a PostgREST) — vedi `DOCKER.md` per la procedura generale.

---

## 🤝 MILESTONE 6: Sfide Express (Link) ✅ COMPLETATO

**Tempo stimato:** 2-3 ore
**Priorità:** ALTA
**Stato:** ✅ COMPLETATO

### Task 6.1: Creazione Link Sfida
- [x] **Task 6.1.1:** Generare link univoco per sfida (`{window.location.origin}/sfida/abc123` — corretto il 2026-10-06: dominio hardcoded `istintopuro.com` che puntava a un host sbagliato quando l'app girava altrove, es. in locale)
- [x] **Task 6.1.2:** Salvare sfida nel DB con stato (pending, accepted, completed, expired)
- [x] **Task 6.1.3:** UI per creare nuova sfida (bottone nella home)
- [x] **Task 6.1.4:** Bottone per copiare link negli appunti
- [ ] **Task 6.1.5:** Mostra QR code per condividere su mobile (OPZIONALE)

### Task 6.2: Accettazione Sfida
- [x] **Task 6.2.1:** Pagina pubblica per visualizzare dettagli sfida (senza login)
- [x] **Task 6.2.2:** Se utente non loggato: prompt registrazione/login
- [x] **Task 6.2.3:** Se utente loggato: bottone "Accetta sfida"
- [x] **Task 6.2.4:** Notifica al creatore quando sfida accettata (polling dalla HomeScreen)

### Task 6.3: Flusso Completo Sfida
- [x] **Task 6.3.1:** Utente A crea sfida → rimane sulla Home con polling attivo
- [x] **Task 6.3.2:** Utente B accetta → polling rileva e reindirizza A a /sfida/TOKEN
- [x] **Task 6.3.3:** Entrambi gli utenti possono iniziare la partita
- [x] **Task 6.3.4:** Al termine partita → stato "completed" e redirect a /
- [x] **Task 6.3.5:** Se sfida non accettata entro tempo limite → stato "expired"
- [x] **Task 6.3.6:** Se utente abbandona → redirect a /

### Task 6.4: Protezione Ri-accesso
- [x] **Task 6.4.1:** Se sfida già completata/expired → mostra "Sfida non disponibile"
- [x] **Task 6.4.2:** get_challenge_by_token filtra solo status 'pending' o 'accepted'
- [x] **Task 6.4.3:** Filtro automatico sfide vecchie (10 minuti)

### Task 6.5: Partita Privata (FUTURO)
- [ ] **Task 6.5.1:** Risultato NON appare in leaderboard globale (solo nel profilo)
- [ ] **Task 6.5.2:** Storico sfide nel profilo

### File SQL creati per Sfide Express:
- `alter-008-challenges.sql` - Schema iniziale sfide
- `alter-011-fix-challenges.sql` - Fix base
- `alter-012-add-creator-id.sql` - Aggiunge creator_id
- `alter-013-fix-challenge-status.sql` - Filtra status
- `alter-014-fix-get-my-active-challenge.sql` - Fix polling
- `alter-015-cleanup-challenges.sql` - Cleanup automatico
- `alter-016-update-create-challenge.sql` - Cleanup prima di creare
- `alter-017-get-challenge-details.sql` - Dettagli sfida
- `alter-018-fix-filter.sql` - Filtro 10 minuti
- `alter-019-cleanup-and-filter.sql` - Cleanup finale
- `alter-020-fix-complete-status.sql` - Status completed

### Test creati:
- `src/test/challenges.test.ts` - 26 test per il sistema sfide

---

## 👥 MILESTONE 6b: Sistema Amicizie

**Tempo stimato:** 2-3 ore
**Priorità:** ALTA
**Stato:** ✅ COMPLETATO

### Task 6b.1: Ricerca Utenti
- [x] **Task 6b.1.1:** Creare tabella `friends` (user_id, friend_id, status, created_at)
- [x] **Task 6b.1.2:** Creare tabella `friend_requests` (from_user, to_user, status, created_at)
- [x] **Task 6b.1.3:** Funzione RPC per cercare utente per nickname
- [x] **Task 6b.1.4:** UI search bar nel profilo "Cerca utenti..."

### Task 6b.2: Richieste di Amicizia
- [x] **Task 6b.2.1:** Invia richiesta amicizia
- [x] **Task 6b.2.2:** Notifica real-time richieste ricevute (polling ogni 15s)
- [x] **Task 6b.2.3:** Accetta/rifiuta richiesta
- [x] **Task 6b.2.4:** Lista richieste in sospeso

### Task 6b.3: Lista Amici
- [x] **Task 6b.3.1:** Mostra lista amici nel profilo
- [x] **Task 6b.3.2:** Visualizza info base amico (tier)
- [x] **Task 6b.3.3:** Rimuovi amico
- [x] **Task 6b.3.4:** Toast con pulsante per nuove richieste (polling 5min)

### File SQL per Amicizie:
- `supabase/alter-009-friends.sql` - Schema iniziale amicizie

---

## 🎮 MILESTONE 6c: Sfide Dirette tra Amici

**Tempo stimato:** 4-5 ore
**Priorità:** ALTA
**Stato:** ✅ Verificato end-to-end in app (2026-10-06, vedi nota in fondo alla sezione)

### Descrizione Funzionalità:
- Sfida diretta amico dalla lista amici senza bisogno di condividere link
- Parametri configurabili (difficoltà, campionato)
- Notifica in tempo reale della sfida ricevuta
- Accettazione/Declino sfida
- Storico sfide giocate

### Task 6c.1: Struttura DB per Sfide Amici
- [x] **Task 6c.1.1:** Creare tabella `friend_challenges` (id, creator_id, opponent_id, difficulty, league, status, room_id, created_at, expires_at)
- [x] **Task 6c.1.2:** Creare tabella `friend_challenge_history` (challenge_id, creator_id, opponent_id, difficulty, league, winner_id, score, created_at)
- [x] **Task 6c.1.3:** Aggiungere indici e RLS policies

### Task 6c.2: Funzioni RPC
- [x] **Task 6c.2.1:** `create_friend_challenge(opponent_id, difficulty, league)` - Crea sfida e room
- [x] **Task 6c.2.2:** `accept_friend_challenge(challenge_id)` - Accetta sfida
- [x] **Task 6c.2.3:** `decline_friend_challenge(challenge_id)` - Rifiuta sfida
- [x] **Task 6c.2.4:** `get_pending_friend_challenges()` - Lista sfide in attesa
- [x] **Task 6c.2.5:** `get_friend_challenge_history()` - Storico sfide
- [x] **Task 6c.2.6:** `get_friend_challenge_by_id(id)` - Dettagli sfida (integrato in accept)

### Task 6c.3: UI - Modal Configurazione Sfida
- [x] **Task 6c.3.1:** Aggiungere nuova icona (Zap) accanto a "Sfida" link nella lista amici
- [x] **Task 6c.3.2:** Creare modal con selezione difficoltà (Facile/Medio/Difficile)
- [x] **Task 6c.3.3:** Creare modal con selezione campionato
- [x] **Task 6c.3.4:** Bottone "Invia Sfida" nel modal

### Task 6c.4: UI - Notifica Sfida Ricevuta
- [x] **Task 6c.4.1:** Polling ogni 30 secondi per sfide in attesa (quando utente è nella scheda Amici)
- [x] **Task 6c.4.2:** Toast con pulsante "Accetta"/"Rifiuta" per sfide ricevute
- [x] **Task 6c.4.3:** Se sfida accettata, navigare a /sfida/token per entrambi (implementato in `App.tsx` — redirect via `room_id` sia per il creatore che per l'accettante)

### Task 6c.5: UI - Lista Sfide
- [x] **Task 6c.5.1:** Nuova scheda "Sfide" nel profilo accanto a "Amici"
- [x] **Task 6c.5.2:** Tab "In Attesa" - Mostra sfide inviate/ricevute in attesa
- [x] **Task 6c.5.3:** Tab "Giocate" - Mostra storico sfide con esito (Vittoria/Sconfitta/Abbandono)
- [x] **Task 6c.5.4:** Dettagli sfida (data, avversario, difficoltà, risultato)

### Task 6c.6: Gestione Room e Game
- [x] **Task 6c.6.1:** Usare stessa logica delle sfide express per room/game (`ChallengeScreen.tsx` gestisce entrambi i tipi con lo stesso flusso `onAcceptChallenge`)
- [x] **Task 6c.6.2:** Chiudere room quando sfida finita o abbandonata (`store.ts`: `saveMatchResultToDb` → `completeFriendChallenge`, `abandonMatch` → `abandonFriendChallenge`; la RPC `complete_friend_challenge` è protetta da race condition — se entrambi i client chiamano il completamento, il secondo trova `status != 'accepted'` e ritorna `false` senza duplicare nulla)
- [x] **Task 6c.6.3:** Impedire re-accesso a sfide completate/expired (`ChallengeScreen.tsx` blocca il rientro se `status` è `completed`/`abandoned`/`expired`)

### ✅ Nota di verifica (audit 2026-09-19, confermato end-to-end 2026-10-06)
Il codice per la Milestone 6c risulta implementato per tutti i task sopra elencati (verificato leggendo `App.tsx`, `ChallengeScreen.tsx`, `src/store/*`, `src/lib/api/friend-challenges.ts` e `supabase/schema/09_friend_challenges.sql`). Testato in app con due browser/account reali il 2026-10-06 (link di invito, avvio partita in contemporanea, abbandono con notifica corretta all'avversario dopo il fix della race condition su `abandonMatch()` — vedi "Bug fix trasversali" in Milestone 0): flusso confermato funzionante end-to-end.

### File SQL creati:
- `supabase/alter-021-friend-challenges.sql` - Schema per sfide tra amici (creato)

### Test creati:
- `src/test/friend-challenges.test.ts` - Test per sistema sfide amici (10 test)

### Piano Implementativo Step-by-Step:

**Step 1: DB e Schema**
1. Creare alter-021-friend-challenges.sql con tabelle
2. Aggiungere RLS policies
3. Aggiungere grants

**Step 2: Funzioni RPC**
1. Implementare create_friend_challenge
2. Implementare accept/decline friend challenge
3. Implementare get_pending_friend_challenges
4. Implementare get_friend_challenge_history

**Step 3: Frontend - rpc-client.ts**
1. Aggiungere funzioni wrapper per le nuove RPC

**Step 4: Frontend - UI Modale Sfida**
1. Aggiungere icona sfida diretta accanto a Play
2. Creare ChallengeFriendModal.tsx
3. Integrare nella ProfileScreen

**Step 5: Frontend - Notifiche**
1. Aggiungere polling per sfide ricevute
2. Creare toast con azioni accept/decline
3. Gestione navigazione a sfida

**Step 6: Frontend - Lista Sfide**
1. Nuova scheda "Sfide" nel profilo
2. Tab in attesa
3. Tab giocate

**Step 7: Test**
1. Creare test per tutte le funzioni RPC
2. Test UI per modal e toast

---

**Dipendenze:** Richiede Milestone 6b (Sistema Amicizie) completato

---

## 📊 MILESTONE 7: Statistiche Avanzate

**Tempo stimato:** 2-3 ore
**Priorità:** MEDIA

### Task 7.1: Statistiche Giocatore
- [x] **Task 7.1.1:** Dashboard statistiche nel profilo
- [x] **Task 7.1.2:** Partite giocate totali, vinte, perse, abbandonate
- [x] **Task 7.1.3:** Percentuale vittorie, media punti/partita
- [x] **Task 7.1.4:** Serie attuale (vittorie/sconfitte consecutive)

### Task 7.2: Statistiche Avanzate ✅ COMPLETATO (2026-10-06)
- [x] **Task 7.2.1:** Combinazioni squadre più comuni (`get_common_team_combos`)
- [x] **Task 7.2.2:** Risposte corrette vs errate per difficoltà (`get_accuracy_by_difficulty`, include anche la difficoltà Hard)
- [x] **Task 7.2.3:** Tempo medio di risposta (`get_avg_response_time`, complessivo + per difficoltà via `ROLLUP`)
- [x] **Task 7.2.4:** Giocatori più indovinati (`get_most_guessed_players`)

Risolta la nota precedente: nuova tabella `round_answers`
(`supabase/schema/19_round_stats.sql`) che traccia **ogni** risposta data
durante un round (corretta o sbagliata, non solo l'esito finale della
partita), popolata da `record_round_answer` chiamata da `validatePlayer`
in `gameplaySlice.ts` su entrambi i rami (fire-and-forget, nessun impatto
su punteggio/streak/achievement già esistenti). UI: 4 nuove card nella
sezione "Statistiche Avanzate" già espandibile di `ProfileStatsTab.tsx`
(Milestone 12). Test: `src/test/round-stats.test.ts` (11 test), più una
verifica diretta via `psql` con dati reali (4 round inseriti in
transazione poi rollback) che conferma la normalizzazione delle combo
squadre (stessa coppia invertita contata una sola volta) e la correttezza
del `ROLLUP`.

### Task 7.3: Storico Partite ✅ COMPLETATO (2026-10-06)
- [x] **Task 7.3.1:** Lista partite giocate con dettagli (quinta scheda "Storico" nel profilo)
- [x] **Task 7.3.2:** Filtro per modalità (PvP/IA) e risultato (vittoria/sconfitta); filtro per data non implementato (non richiesto nella RPC, aggiungibile in futuro)
- [x] **Task 7.3.3:** Dettaglio partita espandibile inline (dati già tutti presenti in `matches_history`, nessuna RPC aggiuntiva)

Schema: `supabase/schema/14_match_history.sql` (RPC `get_match_history`,
paginazione con `total_count` via window function, nessuna nuova tabella —
riusa `matches_history`, già popolata correttamente da quando è stato
corretto il bug di Milestone 8 sotto). Client: `src/lib/api/match-history.ts`,
`src/components/profile/ProfileHistoryTab.tsx`. Test: `src/test/match-history.test.ts` (5 test).

---

## 📈 MILESTONE 12: Statistiche Avanzate con Grafici

**Tempo stimato:** 2-3 ore
**Priorità:** MEDIA

### Task 12.1: Nuova Sezione nel Profilo
- [x] **Task 12.1.1:** Creare sezione espandibile "Statistiche Avanzate" nel profilo
- [x] **Task 12.1.2:** Aggiungere toggle per espandere/collapse

### Task 12.2: Grafici a Barre
- [x] **Task 12.2.1:** Win rate per difficoltà (Facile/Medio/Difficile)
- [x] **Task 12.2.2:** Performance vs tier avversario (Bronze/Silver/Gold/Platinum/Diamond)
- [x] **Task 12.2.3:** Attività mensile (partite per mese, ultimi 6 mesi)
- [x] **Task 12.2.4:** Distribuzione risultati (vittorie/sconfitte/abbandoni)

### Task 12.3: Dati Aggregati (RPC)
- [x] **Task 12.3.1:** Funzione RPC per statistiche per difficoltà
- [x] **Task 12.3.2:** Funzione RPC per statistiche per tier avversario
- [x] **Task 12.3.3:** Funzione RPC per attività mensile
- [x] **Task 12.3.4:** Funzione RPC per distribuzione risultati

### Task 12.4: UI Grafici
- [x] **Task 12.4.1:** Componente grafico a barre orizzontali
- [x] **Task 12.4.2:** Legenda colori per ogni tipo di statistica
- [x] **Task 12.4.3:** Tooltip con valori esatti al hover
- [x] **Task 12.4.4:** Responsive design per mobile

---

## 🏅 MILESTONE 8: Achievement e Badge ✅ COMPLETATO (2026-10-06, esteso lo stesso giorno)

**Tempo stimato:** 2-3 ore
**Priorità:** MEDIA
**Stato:** ✅ Implementato (schema, RPC, UI, toast di sblocco, test), poi
**esteso** nella stessa sessione su richiesta dell'utente da 7 a **26
achievement** (profondità/livelli + categoria tornei) e con un fix UX al
toast di sblocco (chiusura esplicita invece di auto-dismiss, persistenza
tramite `sessionStorage` oltre il redirect di fine partita). Non ancora
verificato con una partita reale in app (solo verifica diretta delle RPC
via `psql`/`curl` sul DB Docker locale, `npm test` e `tsc --noEmit`) — vedi
nota di verifica in fondo alla sezione.

Dettaglio completo (contratto RPC, famiglie di criteri, bug trovato, fix
toast) in `DOCUMENTATION.md` sezione "7. Achievement e Badge". Schema:
`supabase/schema/12_achievements.sql` + `13_achievements_expansion.sql`.
Client: `src/lib/api/achievements.ts`,
`src/components/profile/ProfileAchievementsTab.tsx`. Test:
`src/test/achievements.test.ts` (11 test).

### Task 8.1: Sistema Achievement
- [x] **Task 8.1.1:** Tabella `achievements` (code, label, description, icon, category, tier, sort_order) — catalogo statico, **26 voci** (esteso da 7 iniziali)
- [x] **Task 8.1.2:** Tabella `user_achievements` (user_id, achievement_code, unlocked_at)
- [x] **Task 8.1.3:** 26 achievement definiti in 7 categorie con 3-5 livelli di difficoltà ciascuna (vedi Task 8.2)

### Task 8.2: Achievement Sbloccabili (26, raggruppati per categoria)
- [x] **wins** (5 livelli): `first_win` (1 vittoria), `win_10`, `win_50`, `win_150`, `win_500` — server-truth da `profiles.matches_won`
- [x] **streak** (3 livelli): `streak5`, `streak10`, `streak25` (vittorie consecutive) — server-truth da `profiles.longest_win_streak`
- [x] **tier** (4 livelli): `tier_silver`, `tier_gold`, `tier_platinum`, `tier_diamond` (tier giocatore raggiunto) — server-truth da `profiles.tier`
- [x] **skill** (4 livelli): `speed` (<3s), `speed_flash` (<1,5s), `perfect` (10 corrette di fila), `perfect25` (25 di fila) — eventi client-side (nessun dato persistito su tempo di risposta/streak in-partita), sbloccati on-demand con whitelist lato server e dedup sessionStorage
- [x] **social** (3 livelli): `social10`, `social50`, `social200` (partite PvP) — server-truth da `matches_history.is_pvp`
- [x] **dedication** (3 livelli, nuova): `play50`, `play250`, `play1000` (partite totali, qualunque modalità) — server-truth da `profiles.matches_played`
- [x] **tournament** (4 livelli, nuova — richiesta esplicita dell'utente): `tournament_join` (1° torneo), `tournament_win` (vinci un torneo), `tournament_win5` (5 tornei vinti), `tournament_big_win` (vinci un torneo da 16 giocatori) — server-truth da `tournament_participants`/`tournaments`

### Task 8.3: Visualizzazione
- [x] **Task 8.3.1:** Badge nel profilo utente (quarta scheda "Achievement" in `ProfileScreen.tsx`), raggruppati per categoria con colore badge per tier (bronze/silver/gold/platinum)
- [x] **Task 8.3.2 (rivisto):** Toast dedicato di sblocco con **chiusura solo esplicita** (bottone X, nessun auto-dismiss) e CTA "I miei achievement" — prima versione auto-chiudeva dopo 6s, spesso prima che l'utente facesse in tempo a leggerla; ora persiste anche oltre il redirect di fine partita (`sessionStorage`)
- [x] **Task 8.3.3:** Pagina con tutti gli achievement (sbloccati e locked), `get_user_achievements` ritorna il catalogo completo con stato e tier

### ⚠️ Bug pre-esistente trovato e corretto durante questa milestone
`saveMatchResultToDb` (salvataggio partita su `matches_history`) non era
chiamata da **nessun componente** — scoperto verificando dove agganciare
l'achievement "Social" (che richiede contare le partite PvP da
`matches_history`). `matches_history` non si popolava mai durante il gioco
reale, e con essa restavano vuote anche le statistiche avanzate di
Milestone 7/12 nonostante fossero segnate "Completato". Corretto
aggiungendo la chiamata mancante in `GameScreen.tsx`. Dettaglio completo in
`DOCUMENTATION.md`.

### Nota di verifica (2026-10-06, aggiornata dopo l'espansione)
Verificato: le 3 funzioni RPC (`get_user_achievements`,
`check_and_unlock_achievements`, `unlock_achievement`) applicate e
richiamabili sul DB Docker locale, catalogo a 26 righe confermato via
`psql`, campo `tier` presente nella risposta REST di `get_user_achievements`
(bug trovato e corretto in corsa: la prima versione dell'espansione
aggiungeva la colonna alla tabella ma non al return type della funzione),
guard `auth.uid()` verificato via `curl` anche sui 2 nuovi codici
(`speed_flash` in `unlock_achievement`). `npm test` 167/167 pass (11 test
per `src/lib/api/achievements.ts`, inclusi 2 per il dedup sessionStorage),
`tsc --noEmit` nessun nuovo errore rispetto al baseline pre-esistente.
**Non ancora testato end-to-end in app** (login reale, partita giocata
fino in fondo, toast di sblocco visibile a schermo, in particolare per
verificare che il toast sopravviva davvero al redirect di fine partita) —
a differenza di Tornei/Sfide Amici, qui manca ancora quel passaggio.

---

## 🛒 MILESTONE 9: Shop e Personalizzazione ✅ COMPLETATO (2026-10-06)

**Tempo stimato:** 3-4 ore
**Priorità:** BASSA
**Stato:** ✅ Economia e acquisti funzionanti e verificati (anche con un
flusso di acquisto reale via `psql`). Badge e temi colore **non ancora
collegati visivamente** da nessuna parte dell'UI oltre allo Shop stesso —
vedi nota in fondo.

Schema: `supabase/schema/18_shop.sql`. Client: `src/lib/api/shop.ts`,
sesta scheda "Shop" in `ProfileScreen.tsx`,
`src/components/profile/ProfileShopTab.tsx`. Test: `src/test/shop.test.ts`
(8 test).

### Task 9.1: Sistema Currency
- [x] **Task 9.1.1:** Campo `coins` su `profiles` (default 0)
- [x] **Task 9.1.2:** +15 coins per vittoria, qualunque modalità (dentro `save_match_result`)
- [x] **Task 9.1.3:** Bonus coins per achievement, proporzionale al tier (bronze=10, silver=25, gold=50, platinum=100), su entrambe le RPC di sblocco (`check_and_unlock_achievements` e `unlock_achievement`)

### Task 9.2: Oggetti Shop
- [ ] **Task 9.2.1 (deciso di non implementare):** Cambio nickname a pagamento — il nickname è **già** modificabile gratuitamente e senza limiti (`updateProfile()` esistente, nessuna RPC/cooldown di mezzo); venderlo sarebbe stato far pagare qualcosa di già gratuito. Documentato nel commento di testa di `18_shop.sql`.
- [x] **Task 9.2.2:** 3 badge cosmetici (Stella 50, Fiamma 100, Corona 150 coins) — acquisto funzionante, **non ancora mostrati** visivamente accanto al nickname in nessuna schermata (solo nel catalogo Shop)
- [x] **Task 9.2.3:** 3 temi colore (Oro/Cremisi/Azzurro, 200 coins ciascuno, `profiles.theme_color` + `set_active_theme` per cambiare quale tema posseduto è attivo senza pagare di nuovo) — acquisto e attivazione funzionanti, **non ancora applicato** come bordo/accento visivo da nessuna parte del profilo

### Task 9.3: Acquisti
- [x] **Task 9.3.1:** UI shop con catalogo oggetti (sesta scheda profilo), saldo coins mostrato anche in `ProfileInfoTab.tsx`
- [x] **Task 9.3.2:** Transazione atomica (`purchase_shop_item`: niente saldo negativo, niente doppio acquisto — verificato anche con un acquisto reale via `psql`: scalo coins corretto, doppio acquisto e saldo insufficiente correttamente rifiutati)
- [x] **Task 9.3.3:** Storico acquisti (`get_shop_catalog` ritorna anche `owned`/`purchased_at` per ogni oggetto)

**Follow-up aperto**: collegare visivamente badge posseduti (accanto al
nickname, es. in `ProfileInfoTab`/`GameScreen` durante le partite) e
`theme_color` (bordo/accento nella UI del proprio profilo) — la
persistenza e l'acquisto sono pronti, manca solo il rendering.

---

## 🌋 MILESTONE 10: Modalità Hard ✅ Task 10.1/10.2 completati (2026-10-06)

**Tempo stimato:** 2-3 ore
**Priorità:** MEDIA
**Stato:** ✅ Completato, incluso il fast-follow Task 10.3 (leaderboard
dedicata), fatto in un giro successivo dopo Milestone 11.

Schema: `supabase/schema/16_hard_mode.sql`. `selectedDifficulty = 4` lato
client (nessuna nuova colonna/tabella: difficoltà, timer e punteggio
restano gestiti come i livelli 1-3 già esistenti). Test:
`src/test/hard-mode.test.ts` (8 test).

### Task 10.1: Configurazione Hard
- [x] **Task 10.1.1:** Timer ridotto a 5 secondi (`getRoundDurationMs`/`getRemainingSeconds` in `src/store/types.ts`, ora dipendenti anche dalla difficoltà oltre che da ai/pvp)
- [x] **Task 10.1.2:** Richiede nome completo — `validate_player_intersection` rifiuta input senza uno spazio (un solo cognome non basta) quando `p_strict = TRUE`, più soglia di similarity innalzata da 0.3 (default trigram) a 0.65
- [x] **Task 10.1.3:** Penalità errore: -50 punti sullo score di sessione (clampato a 0), stesso valore già usato per l'abbandono PvP — scelto per coerenza invece di una nuova costante arbitraria

### Task 10.2: UI Hard Mode
- [x] **Task 10.2.1:** Quarta opzione "Hard" nel selettore difficoltà di `HomeScreen.tsx` (stile rosso, avviso esplicito sotto il selettore)
- [x] **Task 10.2.2:** Badge "HARD" (fiamma rossa) in `GameScreen.tsx` durante la partita
- [x] **Task 10.2.3:** Statistiche separate per modalità hard — vedi Task 10.3 sotto

### Task 10.3: Leaderboard Hard ✅ COMPLETATO (2026-10-06)
- [x] **Task 10.3.1:** Classifica separata per modalità hard — `get_hard_mode_leaderboard` (`supabase/schema/20_hard_mode_leaderboard.sql`), aggrega `matches_history` filtrato su `difficulty = 4`, nessuna nuova tabella. Quinta scheda "Hard" in `LeaderboardScreen.tsx` (stile rosso/fiamma coerente col resto della modalità). Ritorna `[]` finché nessuno gioca realmente in Hard mode (atteso, nessuna partita Hard registrata in locale al momento della verifica).
- [ ] **Task 10.3.2 (non implementato):** Badge speciale per migliori hard players — non richiesto esplicitamente, valutare se serve

**Scoperta collaterale**: la whitelist client-side `[1, 2, 3]` sulla
difficoltà, citata in `ROADMAP_SECURITY.md` Task 1.3.2, **non esiste nel
codebase** (verificato con grep) — claim già superato prima di questa
modifica, corretto anche lì.

---

## 👥 MILESTONE 11: Classifiche Amici ✅ COMPLETATO (2026-10-06)

**Tempo stimato:** 2-3 ore
**Priorità:** BASSA
**Stato:** ✅ Task 11.2 e 11.3.2, gli unici non già coperti da Milestone
6b/6c (Sistema Amicizie + Sfide Dirette). Task 11.1 e il resto di 11.3 sono
ridondanti con quelle milestone e non richiedevano nuovo lavoro — lasciati
come riferimento storico.

Schema: `supabase/schema/15_friends_leaderboard.sql` (RPC
`get_friends_leaderboard`, riusa la tabella `friends` già simmetrica da
Milestone 6b — nessuna nuova tabella). Client: `getFriendsLeaderboard` in
`src/lib/api/leaderboard.ts`, quarta scheda "Amici" in
`LeaderboardScreen.tsx`. Test: `src/test/leaderboard.test.ts` (5 test).

### Task 11.1: Sistema Amicizie (già completato in Milestone 6b)
- [x] **Task 11.1.1:** Tabella `friends` — fatto in Milestone 6b
- [x] **Task 11.1.2:** Invio richiesta amicizia — fatto in Milestone 6b
- [x] **Task 11.1.3:** Accetta/rifiuta richiesta — fatto in Milestone 6b

### Task 11.2: Classifica Amici
- [x] **Task 11.2.1:** UI per vedere classifica solo con amici
- [x] **Task 11.2.2:** Filtro "Amici" nella `LeaderboardScreen`
- [x] **Task 11.2.3:** Posizione relativa agli amici (campo `rank` calcolato solo sul sottoinsieme amici+utente)

### Task 11.3: Social Features (già completato in Milestone 6b/6c)
- [x] **Task 11.3.1:** Lista amici nel profilo — fatto in Milestone 6b
- [x] **Task 11.3.2:** Ultima attività amici ✅ COMPLETATO (2026-10-06) — scoperta che ha ridotto molto lo scope: l'RPC `get_friends` esponeva **già** `last_login` (= `profiles.updated_at`, aggiornato ad ogni partita), il client lo mappava già in `lastLogin`, semplicemente non veniva mai mostrato in UI. Nessuna nuova colonna/tabella: solo `ProfileFriendsTab.tsx` ora mostra "Attivo X fa" per ogni amico (riusa `formatRelativeTime` già esistente in `src/lib/game-utils.ts`). `is_online` resta sempre `false` (nessuna presence, invariato e fuori scope)
- [x] **Task 11.3.3:** Sfida diretta amico — fatto in Milestone 6c (Sfide Dirette tra Amici)

---

## 📊 Timeline Riepilogativa

| Milestone | Tempo | Stato |
|-----------|-------|-------|
| 0. Infrastruttura/Sicurezza/Refactor | — | ✅ Completato (import dati in corso) |
| 1. Identità Utente | 2-3h | ✅ Completato |
| 2. Classifica Generale | 2-3h | ✅ Completato |
| 3. Tier System | 2-3h | ✅ Completato |
| 4. Test e Validazione | 1-2h | ✅ Completato (156 test) |
| 5. Tornei | 3-4h | ✅ Completato (2026-10-05, esteso 2026-10-06: cancellazione/schedulazione/tutti i campionati) |
| 6. Sfide Express (Link) | 2-3h | ✅ Completato (verificato end-to-end 2026-10-06, incluso fix link invito) |
| 6b. Sistema Amicizie | 2-3h | ✅ Completato |
| 6c. Sfide tra Amici | 4-5h | ✅ Verificato end-to-end (2026-10-06) |
| 7. Statistiche Avanzate | 2-3h | ✅ Completato (2026-10-06) |
| 8. Achievement | 2-3h | ✅ Completato e **verificato in app dall'utente** (2026-10-06) |
| 9. Shop | 3-4h | ✅ Completato (2026-10-06); badge/temi non ancora applicati visivamente in UI |
| 10. Modalità Hard | 2-3h | ✅ Completato, incluso Task 10.3 (2026-10-06) |
| 11. Classifiche Amici | 2-3h | ✅ Completato (2026-10-06) |

**Totale:** ~30+ ore lavoro

---

## 📝 Note Implementative

### Componenti creati/modificati (nomi storici — vedi nota in testa al documento per la posizione attuale):
- `src/types/game.ts` - Tipi e configurazione tier
- `src/lib/game-utils.ts` - Funzioni utility per il gioco
- `src/lib/rpc-client.ts` → ora `src/lib/api/leaderboard.ts` + `src/lib/api/matches.ts` - RPC per leaderboard e salvataggio partite
- `src/components/TierBadge.tsx` - Badge visuale per il tier
- `src/components/LeaderboardScreen.tsx` - Schermata classifica
- `src/components/GameScreen.tsx` - Aggiunto info avversario (nome + tier)
- `src/store.ts` → ora `src/store/lifecycleSlice.ts` - `saveMatchResultToDb`

### Schema DB:
- Consolidato in `supabase/schema/03_matches_and_leaderboard.sql` (vedi Milestone 0)

### Test:
- `src/test/game-utils.test.ts` - 36 test per le funzioni di gioco

---

## 🔜 Prossimi passi

**Tornei (Milestone 5)** è stato implementato e verificato end-to-end il
2026-10-05, poi esteso il 2026-10-06 con cancellazione/schedulazione/tutti
i campionati — vedi Task 5.5 nella sezione Milestone 5 sopra. Nella stessa
sessione del 2026-10-06 sono stati corretti anche tre bug trasversali non
specifici di una milestone (link invito, desincronizzazione round PvP,
abbandono partita non notificato) — vedi "Bug fix trasversali" in
Milestone 0.

**6c (Sfide tra Amici)** è stata testata in app durante la sessione del
2026-10-06 (link di invito → avvio partita → abbandono) e confermata
funzionante end-to-end: può considerarsi verificata, non più solo "codice
implementato".

**8 (Achievement e Badge)** implementata il 2026-10-06 (schema, RPC, UI,
toast, test), poi estesa da 7 a 26 achievement con categoria tornei e fix
UX del toast (chiusura esplicita, persistenza oltre il redirect di fine
partita) — vedi Task 8 sopra. **Verificata dall'utente in app** nella
stessa sessione: milestone definitiva.

**7.3 (Storico Partite), 10 (Modalità Hard, Task 10.1/10.2) e 11
(Classifiche Amici)** implementate il 2026-10-06 in parallelo (3 agenti
indipendenti, nessuna sovrapposizione di file) — vedi le rispettive
sezioni sopra per dettaglio e limiti noti. L'utente ha testato in app e
confermato il fix di due bug reali emersi nel frattempo sulle Sfide tra
Amici (non su queste tre feature direttamente): "Tutti i Campionati"
mancante nel selettore campionato, e il bottone "Home" che non tornava
alla Home a fine sfida — vedi "Bug fix segnalati dall'utente su Sfide tra
Amici" in Milestone 0. Le schede/funzionalità di Storico Partite, Hard
Mode e Classifiche Amici in sé non risultano ancora esplicitamente
ritestate end-to-end dall'utente.

**7.2 (Statistiche per-round), 9 (Shop e Personalizzazione) e il
fast-follow di 10.3+11.3.2 (Leaderboard Hard + Ultima attività amici)**
implementate il 2026-10-06 in un secondo giro di 3 agenti paralleli,
sempre senza sovrapposizione di file. Nessun bug trovato nel codice
esistente durante l'implementazione. **Non ancora verificate end-to-end in
app con l'utente** (solo verifica diretta via `psql`/`curl` sul DB Docker
locale — inclusi flussi di acquisto/sblocco reali con rollback — e
`npm test` 208/208 pass, `tsc --noEmit` nessun nuovo errore): prossimo
passo prima di considerarle definitive.

Follow-up noti aperti:
- Shop (Milestone 9): badge posseduti e tema colore attivo non sono ancora collegati visivamente in nessuna schermata (solo nello Shop stesso) — persistenza/acquisto funzionano, manca il rendering
- Task 10.3.2 (badge speciale per i migliori hard player) — non richiesto esplicitamente, da valutare se serve
- Milestone 2/3 di `ROADMAP_SECURITY.md` (password strength non collegata alla UI, revoke sessioni mai chiamato, encryption, GDPR export) — nessun lavoro recente, resta sul backlog sicurezza

**Import dati**: in corso, non completo — vedi stato aggiornato in
Milestone 0 ("Ambiente locale Docker"). Va rilanciato (`npm run import-data`)
più giorni di seguito per completare le stagioni 2023/2024 su tutte le leghe,
la quota giornaliera gratuita di API-Football si esaurisce prima del
completamento in una sola sessione.

---

*Document aggiornato: 2026-10-06 (Statistiche per-round, Shop, Leaderboard Hard, attività amici)*