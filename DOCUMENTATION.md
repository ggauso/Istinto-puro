# Documentazione Tecnica - Istinto Puro

## Panoramica

Istinto Puro è un gioco di quiz calcistico multiplayer dove i giocatori devono indovinare il nome dei giocatori a partire dalle loro squadre di appartenenza e dalle stagioni in cui hanno giocato.

---

## Architettura

### Stack Tecnologico

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Realtime + Auth)
- **Styling**: Tailwind CSS + Framer Motion
- **State Management**: Zustand

### Struttura del Progetto

> Aggiornata al 2026-10-06 (aggiunta Milestone 5 Tornei, vedi Note sotto).
> Il refactor del 2026-09-19 (storico `rpc-client.ts` monolitico da 1965
> righe e `store.ts` da 677 righe divisi per dominio; `ProfileScreen.tsx`/
> `ChallengeScreen.tsx` in sotto-componenti) resta invariato.

```
src/
├── components/
│   ├── AuthScreen.tsx        # Login/Register
│   ├── GameScreen.tsx        # Schermata di gioco
│   ├── HomeScreen.tsx        # Home, selezione modalità/lega/difficoltà
│   ├── LeaderboardScreen.tsx # Classifiche
│   ├── ProfileScreen.tsx     # Orchestratore profilo (thin, ~150 righe)
│   ├── ChallengeScreen.tsx   # Orchestratore sfide (thin)
│   ├── TournamentsScreen.tsx # Orchestratore tornei (thin)
│   ├── profile/              # Sotto-componenti + hook di ProfileScreen
│   │   ├── ProfileInfoTab.tsx
│   │   ├── ProfileStatsTab.tsx
│   │   ├── ProfileFriendsTab.tsx
│   │   ├── ProfileAchievementsTab.tsx
│   │   ├── ProfileHistoryTab.tsx
│   │   ├── ProfileShopTab.tsx
│   │   ├── ChallengeFriendModal.tsx
│   │   ├── ConfirmDialog.tsx  # Dialog di conferma riusabile (rimuovi amico, cancella torneo, ...)
│   │   └── useFriendsAndChallenges.ts
│   ├── challenge/             # Sotto-componenti + hook di ChallengeScreen
│   │   ├── ChallengeViews.tsx
│   │   └── useChallenge.ts
│   └── tournament/            # Sotto-componenti + hook di TournamentsScreen
│       ├── TournamentViews.tsx       # Lista, form creazione, dettaglio/bracket, storico
│       ├── useTournaments.ts         # Stato lista/dettaglio + handler create/join/leave/cancel
│       └── useTournamentMatch.ts     # Polling globale match di torneo pronti
├── lib/
│   ├── api/                  # Client Supabase per dominio (ex rpc-client.ts)
│   │   ├── profile.ts, matches.ts, leaderboard.ts
│   │   ├── auth-security.ts, audit.ts
│   │   ├── challenges.ts, friends.ts, friend-challenges.ts
│   │   ├── tournaments.ts
│   │   ├── stats.ts
│   │   ├── achievements.ts
│   │   ├── match-history.ts
│   │   ├── round-stats.ts
│   │   └── shop.ts
│   ├── circuit-breaker.ts    # Resilience pattern
│   ├── error-logger.ts       # Logging errori
│   ├── security.ts           # Password strength, session utils
│   └── supabase.ts           # Configurazione client Supabase
├── store/                    # Zustand a slice (ex store.ts monolitico)
│   ├── types.ts              # GameState + slice interfaces + costanti round (ROUND_DURATION_MS)
│   ├── matchmakingSlice.ts   # Ricerca avversario PvP
│   ├── gameplaySlice.ts      # Round di gioco, punteggio, timer
│   ├── lifecycleSlice.ts     # Fine partita: salvataggio, abbandono
│   └── index.ts              # Combina le slice, esporta useGameStore
├── authStore.ts              # State autenticazione
├── types/                    # TypeScript types
└── test/                     # Test unitari (15 file, 208 test)
```

---

## Funzionalita Principali

### 1. Autenticazione

**Componenti**: `AuthScreen.tsx`, `authStore.ts`

**Funzionalità**:
- Registrazione utente con email/password
- Login con Google OAuth
- Recupero password
- Rate limiting: max 5 tentativi falliti in 15 minuti

**Funzioni RPC**:
- `signUp` / `signInWithPassword` (Supabase Auth)
- `checkEmailLocked()` - verifica se email bloccata
- `recordLoginAttempt()` - registra tentativo di login

### 2. Modalità di Gioco

**Componenti**: `GameScreen.tsx`, `src/store/gameplaySlice.ts`, `src/store/matchmakingSlice.ts`

**Modalità**:
- **AI**: Contro il computer (timer 15 secondi)
- **PvP**: Contro un altro giocatore (timer 10 secondi)

**Flusso di gioco**:
1. Selezione campionato e difficoltà
2. Ricerca partita (matchmaking)
3. Sfida: vengono mostrate due squadre
4. Il giocatore deve inserire il nome di un giocatore che ha giocato in entrambe le squadre
5. Se corretto: punti in base a rarità e combo
6. Vince chi arriva primo a 2 round vinti

**Sincronizzazione round PvP (fix 2026-10-06)**: host e guest condividono
lo stesso `roundStartTime` (incluso nel payload broadcast `game_start`
inviato dall'host, non più generato indipendentemente da ciascun client),
e il countdown (`tickTimer`) è calcolato dal tempo reale trascorso rispetto
a quel timestamp condiviso invece di decrementare un contatore locale — i
due giocatori vedono scadere il round nello stesso istante invece che
l'host con un vantaggio pari alla latenza di rete.

**Calcolo Punteggio**:
- Rarità: più la combinazione è rara, più punti
- Combo: risposte consecutive aumentano il moltiplicatore
- Tempo: rispondere più velocemente dà più punti

### 3. Classifiche

**Componenti**: `LeaderboardScreen.tsx`

**Tipi di classifica**:
- **All Time**: punteggio totale di tutti i tempi
- **Settimanale**: resetta ogni lunedì
- **Mensile**: resetta il primo del mese

**Funzioni RPC**:
- `get_leaderboard()` - classifica all-time
- `get_weekly_leaderboard()` - classifica settimanale
- `get_monthly_leaderboard()` - classifica mensile
- `get_user_rank()` - posizione dell'utente

### 4. Sistema Tier

**Tier disponibili**:
| Tier | Punteggio |
|------|-----------|
| Bronze | 0-500 |
| Silver | 501-1500 |
| Gold | 1501-3000 |
| Platinum | 3001-5000 |
| Diamond | 5001+ |

**Visualizzazione**:
- Badge nel profilo utente
- Progresso verso il tier successivo
- Tier dell'avversario durante le partite PvP

### 5. Matchmaking PvP

**Canali Supabase**:
- `matchmaking_{league_id}` - canale per cercare avversari
- `game_{room_id}` - canale privato per la partita

**Eventi broadcast**:
- `match_found` - avversario trovato
- `guest_ready` - guest è pronto
- `game_start` - inizio partita con dati match + `roundStartTime` condiviso
- `game_start_ack` - conferma ricezione
- `player_won` - un giocatore ha risposto correttamente
- `opponent_abandoned` - un giocatore ha abbandonato (vittoria per forfeit all'altro)

⚠️ **Fix race condition (2026-10-06)**: `abandonMatch()` ora attende
(`await`) che il broadcast `opponent_abandoned` sia stato effettivamente
consegnato (il canale usa `ack: true`) prima di chiamare `resetGame()`,
che rimuove subito il canale realtime. Prima del fix l'invio non era
atteso: a seconda della latenza il messaggio poteva non partire mai,
lasciando l'avversario bloccato in partita senza sapere di aver vinto per
abbandono. Riguarda tutte le modalità PvP (matchmaking libero, sfide
link/amico, match di torneo), non solo i tornei.

⚠️ **Fix "Home" a fine partita non tornava alla Home (2026-10-06,
segnalato dall'utente)**: il bottone "Home" in `GameScreen.tsx` chiamava
solo `resetGame()` (reset dello stato in memoria), mai un cambio di URL.
Chiunque raggiunge una partita PvP tramite `/sfida/<token>` (sfida link o
sfida amico — **riguarda entrambi i giocatori**, non solo chi riceve la
sfida: anche il creatore viene reindirizzato a quell'URL quando l'altro
accetta) resta su quell'URL per tutta la partita. Cliccando "Home"
manualmente lo stato tornava a `idle` ma l'URL restava `/sfida/<token>`:
`App.tsx` ricadeva nel ramo `currentScreen === 'challenge'` e ricaricava la
sfida ormai conclusa invece di andare alla Home — a differenza del
redirect automatico dopo 10s di fine partita, che usa `window.location.href
= '/'` e pulisce correttamente l'URL. Fix: il bottone "Home" ora fa lo
stesso redirect a pagina intera.

### 6. Tornei

**Componenti**: `TournamentsScreen.tsx`, `src/components/tournament/*`,
`src/lib/api/tournaments.ts`, schema `supabase/schema/11_tournaments.sql`

**Funzionalità**:
- Eliminazione diretta, iscrizione libera (2/4/8/16 giocatori)
- Due modalità di avvio, scelte alla creazione:
  - **Al riempimento** (default): parte automaticamente quando si raggiungono `max_players` iscritti
  - **Schedulato**: data/ora fissata dal creatore; un polling client-side (`start_due_tournaments()`, ogni 30s in `App.tsx`, stesso pattern di `pollFriendChallenges` — nessun `pg_cron` nel progetto) avvia il torneo allo scadere dell'orario anche se non al completo (minimo 2 iscritti), con **bracket "bye"**: chi non trova un avversario al round 1 passa direttamente al round 2
- Campionato: uno dei 5 singoli, o **"Tutti i Campionati"** (`league = 'all'`, nessun filtro lega in `get_random_match`)
- Cancellazione: il creatore può cancellare un torneo non ancora iniziato (`cancel_tournament`, soft-delete via `status = 'cancelled'`), con dialog di conferma prima dell'operazione — bottone disponibile sia nella card della lista (icona cestino) sia nel dettaglio
- Card della lista interamente cliccabile per aprire il dettaglio/bracket
- Bracket visibile durante la competizione, storico tornei completati

**RPC principali**: `create_tournament`, `get_open_tournaments`,
`get_tournament_details`, `join_tournament`, `leave_tournament`,
`cancel_tournament`, `start_due_tournaments`,
`get_my_active_tournament_matches`, `complete_tournament_match`,
`abandon_tournament_match`, `get_my_tournament_history`.

### 7. Achievement e Badge (Milestone 8, 2026-10-06 — esteso lo stesso giorno)

**Componenti**: `src/components/profile/ProfileAchievementsTab.tsx` (quarta
scheda del profilo, raggruppata per categoria), `src/lib/api/achievements.ts`,
schema `supabase/schema/12_achievements.sql` + `13_achievements_expansion.sql`.
Catalogo in tabella `achievements` (**26 voci**, inizialmente 7 — esteso su
richiesta esplicita dell'utente dopo il primo test: "7 sono pochi, cerchiamo
una profondità maggiore"), progressi utente in `user_achievements`.

**7 categorie, ciascuna con più livelli di difficoltà** (campo `tier`:
bronze/silver/gold/platinum — stessa terminologia del tier giocatore ma
concetto indipendente, indica solo la rarità dell'achievement nella sua
famiglia):
- **wins** (5): `first_win` (1), `win_10`, `win_50`, `win_150`, `win_500`
- **streak** (3): `streak5`, `streak10`, `streak25` (vittorie consecutive)
- **tier** (4): `tier_silver`, `tier_gold`, `tier_platinum`, `tier_diamond` (tier giocatore raggiunto)
- **skill** (4): `speed` (<3s), `speed_flash` (<1,5s), `perfect` (10 risposte corrette di fila), `perfect25` (25 di fila)
- **social** (3): `social10`, `social50`, `social200` (partite PvP)
- **dedication** (3): `play50`, `play250`, `play1000` (partite totali, qualunque modalità)
- **tournament** (4, nuova): `tournament_join` (1° torneo), `tournament_win` (vinci un torneo), `tournament_win5` (5 tornei vinti), `tournament_big_win` (vinci un torneo da 16 giocatori)

**Due famiglie di criteri, due RPC diverse**:
- **Server-truth** (22 codici, tutti tranne i 4 di skill): calcolabili da
  colonne già persistite in `profiles`/`matches_history`/
  `tournament_participants`/`tournaments`. Verificati da
  `check_and_unlock_achievements(p_user_id)` (SECURITY DEFINER, richiede
  `auth.uid() = p_user_id`), chiamata dal client subito dopo il salvataggio
  di una partita (`saveMatchResultToDb` in `lifecycleSlice.ts`). Un'unica
  `INSERT ... SELECT ... FROM (VALUES (codice, condizione), ...) WHERE
  condizione ON CONFLICT DO NOTHING RETURNING` valuta tutti i 22 criteri in
  una query sola — più leggibile di 22 `IF` ripetuti. Idempotente, ritorna
  solo i codici sbloccati in quella chiamata.
- **Eventi momentanei client-side** (`speed`, `speed_flash`, `perfect`,
  `perfect25`): non esiste oggi nessuna colonna che persista tempo di
  risposta o streak di risposte corrette entro una singola partita, quindi
  vengono rilevati a runtime in `validatePlayer` (`gameplaySlice.ts`) e
  sbloccati on-demand via `unlock_achievement(p_user_id, p_code)`. Per non
  trasformarla in un endpoint "sblocca qualsiasi achievement a piacere", la
  RPC accetta solo questi 4 codici (whitelist lato server) — gli altri 22
  restano raggiungibili solo tramite `check_and_unlock_achievements`. Il
  client deduplica i tentativi ripetuti nella stessa sessione browser
  (`sessionStorage`, chiave `achv_attempted:<userId>` in
  `src/lib/api/achievements.ts`) per non richiamare la RPC ad ogni singola
  risposta corretta dopo il primo sblocco (es. uno streak di 40 risposte
  corrette chiamerebbe altrimenti `unlock_achievement('perfect')` 31 volte).

**Lettura catalogo**: `get_user_achievements(p_user_id)` ritorna tutti i 26
achievement con stato `unlocked`/`unlocked_at`/`tier` (pubblica in lettura,
come i profili — nessun controllo `auth.uid()`, permette in futuro di
mostrare i badge su un profilo altrui).

**Notifica sblocco (rivista 2026-10-06)**: toast dedicato in `App.tsx`,
separato dal `toastWithAction` generico (riusato da polling sfide/tornei,
che altrimenti poteva sovrascrivere il toast achievement entro pochi
secondi). Caratteristiche, dopo il feedback dell'utente ("l'ho visto solo
un secondo"):
- **Chiusura solo esplicita** (bottone X), nessun auto-dismiss a tempo —
  prima il toast si chiudeva da solo dopo 6s, spesso prima che l'utente
  facesse in tempo a leggerlo mentre era ancora sulla schermata di fine
  partita.
- **CTA "I miei achievement"** che apre il profilo direttamente sulla
  scheda Achievement (`ProfileScreen` accetta un prop opzionale
  `initialTab`).
- **Persistenza in `sessionStorage`** (chiave `pendingAchievementToasts`):
  `GameScreen.tsx` fa un redirect a pagina intera (`window.location.href =
  '/'`) 10s dopo la fine partita, che ricarica l'intera app e cancellerebbe
  sia lo stato Zustand in memoria sia un toast ancora visibile. Lo sblocco
  viene quindi scritto subito anche in `sessionStorage`; al mount
  dell'app (anche dopo il reload) un init "lazy" dello stato React lo
  rilegge, cosicché il toast ricompare intatto sulla home e resta visibile
  finché l'utente non lo chiude esplicitamente.

⚠️ **Bug pre-esistente trovato e corretto durante questa milestone**:
`saveMatchResultToDb` (che scrive su `matches_history` via `save_match_result`)
non era chiamata da **nessun componente** — `GameScreen.tsx` gestiva il
completamento di sfide/tornei a fine partita ma non il salvataggio del
risultato stesso. In pratica `matches_history` non si popolava mai durante
il gioco reale, e con essa restavano sempre vuote anche le statistiche
avanzate di Milestone 7/12 (`get_stats_by_difficulty`,
`get_stats_by_opponent_tier`, `get_monthly_activity`,
`get_result_distribution_v2`, tutte lette da quella tabella), nonostante
fossero segnate "Completato". Corretto aggiungendo la chiamata mancante
nell'`useEffect` di fine partita di `GameScreen.tsx`. Aggiunta anche la
colonna `matches_history.is_pvp` (non derivabile in modo affidabile da
`opponent_tier`, sempre valorizzato a `'bronze'` anche contro l'IA), usata
dalla famiglia `social*` per contare solo le partite PvP.

**RPC**: `get_user_achievements`, `check_and_unlock_achievements`,
`unlock_achievement`.

**Verificato dall'utente in app** (2026-10-06): milestone definitiva.

### 8. Storico Partite (Milestone 7 — Task 7.3, 2026-10-06)

**Componenti**: `src/components/profile/ProfileHistoryTab.tsx` (quinta
scheda "Storico" del profilo), `src/lib/api/match-history.ts`, schema
`supabase/schema/14_match_history.sql`.

Riusa `matches_history` già esistente (nessuna nuova tabella). RPC
`get_match_history(p_user_id, p_limit=20, p_offset=0, p_mode, p_result)`:
SECURITY DEFINER, guard `auth.uid() = p_user_id`, `p_mode` filtra su
`is_pvp` (`'pvp'`/`'ai'`/`NULL` = tutte), `p_result` su `is_win`
(`'win'`/`'loss'`/`NULL` = tutti), paginazione con `LIMIT`/`OFFSET` e una
colonna `total_count` calcolata con `COUNT(*) OVER()` nella stessa query
(il client sa quante pagine ci sono senza una seconda chiamata). Il
dettaglio di una partita è solo un'espansione inline della riga già
caricata — tutti i dati necessari sono già in `matches_history`, nessuna
RPC aggiuntiva.

**Non implementato** (Task 7.2 della stessa milestone): combinazioni
squadre più comuni, risposte corrette/errate per difficoltà, tempo medio
di risposta, giocatori più indovinati. Richiederebbero una tabella di
tracciamento **per-round** (ogni singola risposta, non solo l'esito finale
della partita) che oggi non esiste — cambio di schema più ampio, da
progettare a parte.

### 9. Classifiche Amici (Milestone 11, 2026-10-06)

**Componenti**: quarta scheda "Amici" in `src/components/LeaderboardScreen.tsx`,
`getFriendsLeaderboard` in `src/lib/api/leaderboard.ts`, schema
`supabase/schema/15_friends_leaderboard.sql`.

RPC `get_friends_leaderboard(p_user_id, p_limit=100)`: SECURITY DEFINER,
guard `auth.uid() = p_user_id`, stesso shape di ritorno di `get_leaderboard`
(`rank, user_id, display_name, total_score, tier, matches_played,
matches_won, win_rate`), calcolato solo sul sottoinsieme amici + utente
stesso (join con la tabella `friends`, già simmetrica in scrittura da
Milestone 6b — un singolo `WHERE user_id = p_user_id` basta, senza bisogno
di `OR` sulle due direzioni).

⚠️ **Bug trovato e corretto durante l'implementazione**: la CTE interna
usava `user_id` come nome di colonna, ambiguo con la colonna di output
`user_id` della funzione stessa (visibile come variabile nello scope
plpgsql) — corretto con un alias esplicito (`f.user_id`/`f.friend_id`).
Trovato testando la query con `SET request.jwt.claims` + `SET ROLE
authenticated` su due utenti reali amici tra loro nel DB.

**Ultima attività amici (Task 11.3.2, 2026-10-06)**: `src/components/profile/ProfileFriendsTab.tsx`
ora mostra "Attivo X fa" per ogni amico. Nessuna nuova colonna/tabella
serviva: l'RPC `get_friends` esponeva **già** `last_login` (alias di
`profiles.updated_at`, aggiornato ad ogni partita) e il client lo mappava
già in `lastLogin` — semplicemente non veniva mai mostrato in UI. Riusa
`formatRelativeTime` già esistente in `src/lib/game-utils.ts`. `is_online`
resta sempre `false` (nessuna presence/realtime-online implementata).

### 10. Modalità Hard (Milestone 10, Task 10.1/10.2 — 2026-10-06)

**Componenti**: quarta opzione difficoltà in `src/components/HomeScreen.tsx`,
badge "HARD" in `src/components/GameScreen.tsx`, logica in
`src/store/gameplaySlice.ts`/`src/store/types.ts`, schema
`supabase/schema/16_hard_mode.sql`.

`selectedDifficulty = 4` (livello aggiuntivo rispetto a Facile/Medio/Difficile
1-3 esistenti), nessuna nuova tabella:
- **Timer**: 5s invece di 10-15s. `getRoundDurationMs`/`getRemainingSeconds`
  (`src/store/types.ts`) ora dipendono anche dalla difficoltà, non solo da
  `gameMode` — retrocompatibili (parametro opzionale, default 1).
- **Matching più severo**: `validate_player_intersection` accetta un nuovo
  parametro `p_strict BOOLEAN DEFAULT FALSE` in coda — in strict mode
  richiede che l'input contenga uno spazio (nome **e** cognome, non basta
  più un cognome distintivo) e una soglia di similarity trigram ≥0.65
  invece del default 0.3.
- **Penalità errore**: -50 punti sullo score di sessione (clampato a 0) su
  risposta sbagliata in Hard mode — stesso valore già usato per l'abbandono
  PvP, scelto per coerenza.
- **UI**: quarta opzione nel selettore difficoltà (stile rosso + avviso),
  badge "HARD" (fiamma rossa) durante la partita.

⚠️ **Gotcha SQL incontrato**: aggiungere `p_strict` con `DEFAULT FALSE` in
coda a `validate_player_intersection` **non** è stato sufficiente con
`CREATE OR REPLACE` — Postgres crea un secondo overload (stessa funzione,
3 vs 4 argomenti) invece di sostituire quello esistente, e PostgREST poi
rifiuta la chiamata RPC a 3 argomenti con "Could not choose the best
candidate function" per l'ambiguità tra i due overload (stesso tipo di
gotcha già documentato in `DOCKER.md` per i cambi di *return type* — qui
vale anche per l'aggiunta di un parametro, anche opzionale). Risolto con
`DROP FUNCTION` della versione a 3 argomenti prima di ricreare quella a 4.

**Task 10.3 (leaderboard dedicata), completato in un giro successivo
(2026-10-06)**: `get_hard_mode_leaderboard` (`supabase/schema/20_hard_mode_leaderboard.sql`)
aggrega `matches_history` filtrato su `difficulty = 4` — nessuna nuova
tabella, stesso shape di ritorno delle altre leaderboard. Quinta scheda
"Hard" in `LeaderboardScreen.tsx` (stile rosso/fiamma, coerente col resto
della modalità). Nessun guard `auth.uid()`: è una classifica pubblica come
le altre.

### 11. Statistiche Avanzate Per-Round (Milestone 7, Task 7.2 — 2026-10-06)

**Componenti**: nuova tabella `round_answers`
(`supabase/schema/19_round_stats.sql`), 4 nuove card nella sezione
"Statistiche Avanzate" già espandibile di
`src/components/profile/ProfileStatsTab.tsx` (Milestone 12).

A differenza di `matches_history` (un record per partita, scritto solo a
fine match), `round_answers` registra **ogni singola risposta** data
durante un round — corretta o sbagliata — con `team1_id/team2_id,
player_name` (la risposta corretta attesa, non l'input dell'utente),
`is_correct, difficulty, response_time_ms`. Popolata da
`record_round_answer` (SECURITY DEFINER, guard `auth.uid() = p_user_id`),
chiamata da `validatePlayer` in `src/store/gameplaySlice.ts` su **entrambi**
i rami (fire-and-forget, nessun impatto sulla logica di
punteggio/streak/achievement esistente — `timeTaken` è stato solo spostato
fuori dal ramo `isCorrect` per essere disponibile a entrambi, stesso
valore calcolato nello stesso punto di prima).

**RPC di lettura**: `get_common_team_combos` (normalizza l'ordine
team1/team2 con `LEAST`/`GREATEST` così la stessa coppia invertita conta
come una sola combo — `get_random_match` non garantisce un ordine
stabile), `get_accuracy_by_difficulty`, `get_avg_response_time` (una
query sola con `ROLLUP(difficulty)`: riga totale + breakdown per
difficoltà, Hard mode incluso), `get_most_guessed_players`.

### 12. Shop e Personalizzazione (Milestone 9, 2026-10-06)

**Componenti**: sesta scheda "Shop" in `src/components/ProfileScreen.tsx`,
`src/components/profile/ProfileShopTab.tsx`, `src/lib/api/shop.ts`, schema
`supabase/schema/18_shop.sql`.

**Valuta**: colonna `profiles.coins` (default 0). Guadagnata vincendo
partite (+15 coins, in `save_match_result`, qualunque modalità/difficoltà)
e sbloccando achievement (bonus proporzionale al `tier` del catalogo
achievement: bronze=10, silver=25, gold=50, platinum=100 — sia per gli
sblocchi server-truth che per quelli client-side, vedi Sezione 7).

**Catalogo** (`shop_items`/`user_purchases`, stesso pattern pubblico-in-lettura
di `achievements`/`user_achievements`): 3 badge cosmetici (50/100/150
coins) + 3 temi colore (200 coins ciascuno, `profiles.theme_color` +
`set_active_theme` per cambiare quale tema posseduto è attivo senza
ripagare). `purchase_shop_item` è atomica: scalo coins con `UPDATE ...
WHERE coins >= cost` (niente race condition tra acquisti concorrenti),
niente doppio acquisto (check `user_purchases` prima dello scalo).

⚠️ **Decisione di design**: il "cambio nickname a pagamento" previsto dal
roadmap originale (Task 9.2.1) non è stato implementato — il nickname è
già modificabile gratuitamente e senza limiti tramite `updateProfile()`
esistente, nessuna RPC/cooldown di mezzo. Vendere qualcosa di già gratuito
non avrebbe avuto senso; documentato nel commento di testa di `18_shop.sql`.

⚠️ **Follow-up aperto**: badge posseduti e tema colore attivo sono
persistiti e acquistabili correttamente, ma **non ancora applicati
visivamente** da nessuna parte dell'UI oltre al catalogo Shop stesso
(nessun badge accanto al nickname, nessun bordo/accento colorato nel
profilo) — manca solo l'ultimo collegamento di rendering.

**RPC**: `get_shop_catalog`, `purchase_shop_item`, `set_active_theme`.

---

## Sicurezza

### Rate Limiting

**Database**: `login_attempts` table

```sql
-- Limita tentativi di login
-- Max 5 tentativi falliti in 15 minuti per email
-- Lockout 15 minuti dopo 5 fallimenti
```

**Funzioni**:
- `is_email_locked(email)` - verifica se bloccato
- `record_login_attempt(email, ip, success)` - registra tentativo
- `get_login_lockout_remaining(email)` - secondi rimanenti

### Row Level Security (RLS)

Tabelle con policy RLS (corretto 2026-09-19: `teams_seasons` non esiste, il
nome reale è `player_teams`):
- `profiles` - lettura pubblica, modifica solo proprietario
- `matches`/`matches_history` - lettura/insert solo proprietario
- `teams`/`players`/`player_teams` - lettura pubblica, scrittura solo service_role
- `challenges`/`friend_challenges` - lettura solo creatore/avversario, nessuna policy UPDATE/DELETE (tutte le transizioni di stato passano dalle RPC `SECURITY DEFINER`)
- `friends`/`friend_requests` - lettura/scrittura solo proprietario
- `achievements`/`user_achievements` - lettura pubblica (come i profili), nessuna scrittura diretta (solo via RPC `SECURITY DEFINER`)
- `shop_items`/`user_purchases` - lettura pubblica, nessuna scrittura diretta (solo via RPC `SECURITY DEFINER`)
- `round_answers` - lettura solo propria (`auth.uid() = user_id`), nessuna scrittura diretta (solo via RPC `SECURITY DEFINER`)

⚠️ **Le RLS non proteggono le funzioni `SECURITY DEFINER`** (le RPC girano
coi privilegi del proprietario, bypassando sempre le RLS delle tabelle su
cui scrivono). Un audit di sicurezza (2026-09-19) ha trovato diverse RPC
che scrivevano dati senza verificare `auth.uid()` — vedi
`ROADMAP_SECURITY.md` e la sezione "Fix di sicurezza" più sotto.

### Validazione Input

- Sanitizzazione nomi giocatori (anti-injection in `validate_player_intersection`)
- Validazione campionato (whitelist)
- Validazione difficoltà (1, 2, 3)
- Validazione room_id (formato UUID)

### Fix di sicurezza (2026-09-19)

Un audit mirato sulle funzioni `SECURITY DEFINER` ha trovato e corretto
(in `supabase/schema/`, vedi sezione File SQL più sotto) diversi problemi
di controllo accessi: `save_match_result`/`update_profile_stats`
scrivibili per un `p_user_id` arbitrario (chiunque poteva falsificare
punteggi altrui, anche senza login), `complete_friend_challenge`/
`abandon_friend_challenge` chiamabili da chi non era uno dei due
giocatori della sfida, `run_retention_cleanup` chiamabile da chiunque.
Dettaglio completo, severità e stato (corretto/non risolto) in
`ROADMAP_SECURITY.md`. **La fix è applicata solo al DB Docker locale**:
va ancora applicata manualmente al progetto Supabase Cloud di produzione.

---

## Audit Logging

### Tabella: `audit_log`

| Campo | Tipo | Descrizione |
|-------|------|--------------|
| id | BIGSERIAL | ID univoco |
| user_id | UUID | Utente (null per anonimi) |
| event_type | TEXT | Tipo evento |
| event_category | TEXT | Categoria (auth, game, profile, admin) |
| description | TEXT | Descrizione evento |
| metadata | JSONB | Dati aggiuntivi |
| ip_address | TEXT | IP client |
| user_agent | TEXT | Browser client |
| created_at | TIMESTAMPTZ | Timestamp |

### Eventi Tracciati

**Auth**:
- `login` - login effettuato
- `login_failed` - tentativo fallito
- `logout` - logout
- `password_change` - password modificata

**Game**:
- `match_started` - partita iniziata
- `match_won` - partita vinta
- `match_lost` - partita persa
- `match_abandoned` - partita abbandonata

**Profile**:
- `profile_created` - profilo creato
- `profile_update` - profilo aggiornato

### Trigger Automatici

```sql
-- Profili: trigger automatico su INSERT/UPDATE
CREATE TRIGGER audit_profile_trigger
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION trigger_profile_audit();
```

### Query Utili

```sql
-- Ultimi 20 eventi di un utente
SELECT * FROM audit_log
WHERE user_id = 'uuid-utente'
ORDER BY created_at DESC LIMIT 20;

-- Tentativi login falliti oggi
SELECT * FROM audit_log
WHERE event_type = 'login_failed'
  AND created_at >= CURRENT_DATE;

-- Utenti più attivi oggi
SELECT user_id, COUNT(*) as event_count
FROM audit_log
WHERE created_at >= CURRENT_DATE
GROUP BY user_id
ORDER BY event_count DESC LIMIT 10;
```

### Retention

- **keep**: 90 giorni
- **cleanup**: funzione `cleanup_old_audit_logs()`
- **frequenza consigliata**: quotidiana

---

## Test

### Esecuzione Test

```bash
npm test
```

### Coverage Attuale

- **208 test** distribuiti su 15 file (verificato 2026-10-06):
  - `authStore.test.ts` - 5 test
  - `circuit-breaker.test.ts` - 10 test
  - `security.test.ts` - 15 test
  - `profile.test.ts` - 9 test (ex `rpc-client.test.ts`, rinominato dopo lo split di `rpc-client.ts`)
  - `utils.test.ts` - 28 test
  - `game-utils.test.ts` - 36 test
  - `challenges.test.ts` - 26 test
  - `friend-challenges.test.ts` - 12 test
  - `tournaments.test.ts` - 15 test
  - `achievements.test.ts` - 11 test (Milestone 8, incluso dedup sessionStorage)
  - `match-history.test.ts` - 5 test (Storico Partite)
  - `leaderboard.test.ts` - 9 test (Classifiche Amici + Leaderboard Hard)
  - `hard-mode.test.ts` - 8 test (Modalità Hard)
  - `round-stats.test.ts` - 11 test (Statistiche per-round)
  - `shop.test.ts` - 8 test (Shop e Personalizzazione)

### Aree Testate

- Generazione nomi guest (`guest-XXXX`)
- Calcolo tier e progressi
- Ordinamento e filtraggio classifiche
- Validazione input
- Circuit breaker
- RPC client (getUserInfo, getLeaderboard, etc.)

---

## Ambiente locale (Docker)

Il progetto può girare interamente in locale, senza Supabase Cloud, con
uno stack Supabase self-hosted in Docker (Postgres, Auth/GoTrue,
PostgREST, Realtime, Studio, Mailpit). Vedi **`DOCKER.md`** per la guida
completa: avvio, popolamento dati (import da API-Football o export dal
progetto Cloud), URL dei servizi, note di sicurezza sulle chiavi demo.

```bash
cp .env.docker.example .env   # fai prima un backup del tuo .env reale!
docker compose up -d
```

## Deployment

### Build Produzione

```bash
npm run build
```

Output in `dist/`

⚠️ **Fallback SPA in produzione (fix 2026-10-06)**: `server.ts`, in modalità
produzione, serve `dist/` con `express.static` e poi un catch-all
`app.get('*', ...)` che restituisce `dist/index.html` per qualunque rotta
non statica (es. `/sfida/<token>`, un link di invito). Senza questo
fallback, una navigazione diretta del browser verso quelle rotte riceveva
un 404 raw da Express prima che il router client-side in `App.tsx` potesse
intercettarla. In sviluppo (`vite` in `appType: "spa"`) questo non serviva,
il problema esisteva solo nel branch di produzione.

Collegato: i link di invito (`HomeScreen.tsx`, `ChallengeViews.tsx`)
costruivano l'URL con un dominio hardcoded (`https://istintopuro.com`)
invece dell'host effettivo da cui gira l'app — un link copiato da un
ambiente locale/di test puntava quindi a un dominio sbagliato (sempre
"not found" per chi lo apriva altrove). Corretto usando
`window.location.origin`, già usato altrove nel progetto per lo stesso
scopo (`AuthScreen.tsx`, redirect reset password).

### Variabili Env

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Supabase CLI (progetto Cloud)

```bash
# Apply migrations
supabase db push

# Open studio
supabase studio
```

---

## File SQL Utili

> **Consolidato 2026-09-19**: i 26 file storici (`schema.sql`, `alter-002`
> … `alter-022`) sono stati sostituiti da 10 file puliti organizzati per
> dominio in `supabase/schema/` — usa questi come riferimento, non i file
> storici (archiviati in `supabase/migrations_archive/`, solo per
> consultazione). Il consolidamento ha anche corretto due bug reali
> (PK sbagliata su `leaderboard_weekly`/`monthly`, colonne `teams.league_id`/
> `player_teams.season` usate ma mai migrate) — dettagli in `DOCKER.md`.

| File | Descrizione |
|------|--------------|
| `supabase/schema/01_extensions_and_game_data.sql` | Estensioni, `teams`/`players`/`player_teams` |
| `supabase/schema/02_profiles_and_auth.sql` | `profiles`, RLS, trigger `handle_new_user` |
| `supabase/schema/03_matches_and_leaderboard.sql` | `matches`/`matches_history`, leaderboard, `get_random_match`, `save_match_result` |
| `supabase/schema/04_login_rate_limit.sql` | Rate limiting login |
| `supabase/schema/05_audit_log.sql` | Audit logging |
| `supabase/schema/06_data_retention.sql` | Retention/cleanup GDPR |
| `supabase/schema/07_challenges.sql` | Sfide Express (link pubblico) |
| `supabase/schema/08_friends.sql` | Sistema amicizie |
| `supabase/schema/09_friend_challenges.sql` | Sfide dirette tra amici |
| `supabase/schema/10_advanced_stats.sql` | Statistiche giocatore |
| `supabase/schema/11_tournaments.sql` | Tornei: tabelle, bracket (con supporto bye per avvio anticipato), cancellazione, scheduling |
| `supabase/schema/12_achievements.sql` | Achievement/badge: catalogo, progressi utente, `check_and_unlock_achievements`/`unlock_achievement` |
| `supabase/schema/13_achievements_expansion.sql` | Espansione catalogo achievement (7→26, colonna `tier`, categoria `tournament`) |
| `supabase/schema/14_match_history.sql` | Storico Partite: `get_match_history` paginato con filtro modalità/risultato |
| `supabase/schema/15_friends_leaderboard.sql` | Classifiche Amici: `get_friends_leaderboard` |
| `supabase/schema/16_hard_mode.sql` | Modalità Hard: `validate_player_intersection` (+`p_strict`), `get_random_match` (clamp esteso a 1-4) |
| `supabase/schema/17_friend_challenges_all_leagues.sql` | Bug fix: `friend_challenges.league` ammette `'all'` (Tutti i Campionati) |
| `supabase/schema/18_shop.sql` | Shop: `coins`/`theme_color`, catalogo `shop_items`/`user_purchases`, `purchase_shop_item`/`set_active_theme` |
| `supabase/schema/19_round_stats.sql` | Statistiche per-round: tabella `round_answers`, `record_round_answer` + 4 RPC di aggregazione |
| `supabase/schema/20_hard_mode_leaderboard.sql` | `get_hard_mode_leaderboard` (aggrega `matches_history` filtrato su `difficulty = 4`) |

Per aggiungere schema in futuro: nuovo file numerato in `supabase/schema/`,
copiato anche in `docker/volumes/db/migrations/` con prefisso `999_app_NN_`
per lo stack Docker locale — vedi `DOCKER.md`. ⚠️ Se modifichi un file di
migrazione **già applicato** a uno stack Docker locale già avviato, la
modifica non si propaga da sola: quelle migrazioni girano solo alla
primissima inizializzazione del volume dati. Va applicata a mano al DB
vivo — vedi "Modificare lo schema di una migrazione già applicata" in
`DOCKER.md` per la procedura (ruolo `supabase_admin`, gestione overload di
funzione, reload della cache schema di PostgREST).

---

## Troubleshooting

### Problemi Comuni

**Login non funziona**:
- Verificare rate limiting: `SELECT * FROM login_attempts WHERE email = '...'`
- Attendere 15 minuti se bloccato

**Partite PvP non trovano avversari**:
- Verificare canale realtime: controllare console browser per errori
- Verificare presenza utenti nel canale matchmaking

**Classifica vuota**:
- Verificare che `save_match_result` venga chiamata correttamente
- La classifica all-time (`get_leaderboard`) legge direttamente `profiles.total_score`, non una tabella dedicata — controllare quel campo
- Le classifiche settimanale/mensile leggono invece `leaderboard_weekly`/`leaderboard_monthly`

**Audit log non registrato**:
- Verificare che le funzioni RPC siano state create
- Controllare tabella `audit_log`

---

## Future Implementazioni (Opzionali)

1. **Cron job cleanup**: Automatizzare cancellazione log vecchi
2. **Notifiche email**: Alert per lockout account
3. **Storage audit**: Log accessi file
4. **Monitoring**: Alert per anomalie
5. **GDPR**: Export dati utente, delete account

---

*Ultimo aggiornamento: 2026-10-06*