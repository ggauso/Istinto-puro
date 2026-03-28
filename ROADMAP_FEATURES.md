# Roadmap Feature di Gioco - Istinto Puro

## 📋 Panoramica

Questo documento definisce le milestone e i task per implementare le nuove feature di gioco.

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

## 🏆 MILESTONE 5: Tornei

**Tempo stimato:** 3-4 ore
**Priorità:** ALTA

### Task 5.1: Struttura Tornei
- [ ] **Task 5.1.1:** Creare tabella `tournaments` nel DB (nome, tipo, data inizio, data fine, stato)
- [ ] **Task 5.1.2:** Creare tabella `tournament_participants` (utente, torneo, punteggio, posizione)
- [ ] **Task 5.1.3:** Creare tabella `tournament_matches` (torneo, match_id, round, winner)

### Task 5.2: Iscrizione Tornei
- [ ] **Task 5.2.1:** UI per visualizzare tornei disponibili
- [ ] **Task 5.2.2:** Bottone per iscriversi a un torneo
- [ ] **Task 5.2.3:** Limite posti (max players per torneo)

### Task 5.3: Svolgimento Tornei
- [ ] **Task 5.3.1:** Generazione bracket automatico (eliminazione diretta)
- [ ] **Task 5.3.2:** Sistema round con match singolo
- [ ] **Task 5.3.3:** Determinazione vincitore e premi

### Task 5.4: Classifica Tornei
- [ ] **Task 5.4.1:** Mostrare posizione nel torneo durante la competizione
- [ ] **Task 5.4.2:** Schermata finale con classifica completa
- [ ] **Task 5.4.3:** Storico tornei disputati

---

## 🤝 MILESTONE 6: Sfide Express (Link) ✅ COMPLETATO

**Tempo stimato:** 2-3 ore
**Priorità:** ALTA
**Stato:** ✅ COMPLETATO

### Task 6.1: Creazione Link Sfida
- [x] **Task 6.1.1:** Generare link univoco per sfida (es. `istintopuro.com/sfida/abc123`)
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

## 🎮 MILESTONE 6c: Sfide Dirette tra Amici (IN PROGRESS)

**Tempo stimato:** 4-5 ore
**Priorità:** ALTA
**Stato:** 🔄 IN PROGRESS

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
- [ ] **Task 6c.4.3:** Se sfida accettata, navigare a /sfida/token per entrambi (richiede integrazione App.tsx)

### Task 6c.5: UI - Lista Sfide
- [x] **Task 6c.5.1:** Nuova scheda "Sfide" nel profilo accanto a "Amici"
- [x] **Task 6c.5.2:** Tab "In Attesa" - Mostra sfide inviate/ricevute in attesa
- [x] **Task 6c.5.3:** Tab "Giocate" - Mostra storico sfide con esito (Vittoria/Sconfitta/Abbandono)
- [x] **Task 6c.5.4:** Dettagli sfida (data, avversario, difficoltà, risultato)

### Task 6c.6: Gestione Room e Game
- [ ] **Task 6c.6.1:** Usare stessa logica delle sfide express per room/game
- [ ] **Task 6c.6.2:** Chiudere room quando sfida finita o abbandonata
- [ ] **Task 6c.6.3:** Impedire re-accesso a sfide completate/expired

### File SQL da creare:
- `supabase/alter-021-friend-challenges.sql` - Schema per sfide tra amici

### Test da creare:
- `src/test/friend-challenges.test.ts` - Test per sistema sfide amici

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

### Task 7.2: Statistiche Avanzate
- [ ] **Task 7.2.1:** Combinazioni squadre più comuni
- [ ] **Task 7.2.2:** Risposte corrette vs errate per difficoltà
- [ ] **Task 7.2.3:** Tempo medio di risposta
- [ ] **Task 7.2.4:** Giocatori più indovinati

### Task 7.3: Storico Partite
- [ ] **Task 7.3.1:** Lista partite giocate con dettagli
- [ ] **Task 7.3.2:** Filtro per data, modalità, risultato
- [ ] **Task 7.3.3:** Dettaglio singola partita (squadre, risposte)

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

## 🏅 MILESTONE 8: Achievement e Badge

**Tempo stimato:** 2-3 ore
**Priorità:** MEDIA

### Task 8.1: Sistema Achievement
- [ ] **Task 8.1.1:** Creare tabella `achievements` (nome, descrizione, icona, criterio)
- [ ] **Task 8.1.2:** Creare tabella `user_achievements` (utente, achievement, data ottenuto)
- [ ] **Task 8.1.3:** Definire achievement iniziali

### Task 8.2: Achievement Sbloccabili
- [ ] **Task 8.2.1:** "Prima vittoria" - Vinci la prima partita
- [ ] **Task 8.2.2:** "Streak" - Vinci 5 partite consecutive
- [ ] **Task 8.2.3:** "Campione" - Vinci 50 partite
- [ ] **Task 8.2.4:** "Speed" - Rispondi in meno di 3 secondi
- [ ] **Task 8.2.5:** "Perfetto" - Rispondi corretto 10 volte di fila
- [ ] **Task 8.2.6:** "Social" - Gioca 10 partite PvP
- [ ] **Task 8.2.7:** "Tier Diamond" - Raggiungi Diamond

### Task 8.3: Visualizzazione
- [ ] **Task 8.3.1:** Badge nel profilo utente
- [ ] **Task 8.3.2:** Notifica quando si sblocca achievement
- [ ] **Task 8.3.3:** Pagina completa con tutti gli achievement (sbloccati e locked)

---

## 🛒 MILESTONE 9: Shop e Personalizzazione

**Tempo stimato:** 3-4 ore
**Priorità:** BASSA

### Task 9.1: Sistema Currency
- [ ] **Task 9.1.1:** Aggiungere campo `coins` al profilo utente
- [ ] **Task 9.1.2:** Guadagnare coins vincendo partite
- [ ] **Task 9.1.3:** Bonus coins per achievement

### Task 9.2: Oggetti Shop
- [ ] **Task 9.2.1:** Cambio nickname (costo in coins)
- [ ] **Task 9.2.2:** Badge speciali cosmetic
- [ ] **Task 9.2.3:** Temi colorati per il profilo

### Task 9.3: Acquisti
- [ ] **Task 9.3.1:** UI shop con catalogo oggetti
- [ ] **Task 9.3.2:** Transazione acquisto (verifica coins, aggiorna profilo)
- [ ] **Task 9.3.3:** Storico acquisti nel profilo

---

## 🌋 MILESTONE 10: Modalità Hard

**Tempo stimato:** 2-3 ore
**Priorità:** MEDIA

### Task 10.1: Configurazione Hard
- [ ] **Task 10.1.1:** Ridurre timer a 5 secondi
- [ ] **Task 10.1.2:** Richiedere nome completo (primo + cognome)
- [ ] **Task 10.1.3:** Penalità errore (perdi punti invece di niente)

### Task 10.2: UI Hard Mode
- [ ] **Task 10.2.1:** Nuova opzione nella selezione difficoltà
- [ ] **Task 10.2.2:** Badge "Hard" visibile durante la partita
- [ ] **Task 10.2.3:** Statistiche separate per modalità hard

### Task 10.3: Leaderboard Hard
- [ ] **Task 10.3.1:** Classifica separata per modalità hard
- [ ] **Task 10.3.2:** Badge speciale per migliori hard players

---

## 👥 MILESTONE 11: Classifiche Amici

**Tempo stimato:** 2-3 ore
**Priorità:** BASSA

### Task 11.1: Sistema Amicizie
- [ ] **Task 11.1.1:** Creare tabella `friends` (utente1, utente2, stato, data)
- [ ] **Task 11.1.2:** Enviare richiesta amicizia
- [ ] **Task 11.1.3:** Accettare/rifiutare richiesta

### Task 11.2: Classifica Amici
- [ ] **Task 11.2.1:** UI per vedere classifica solo con amici
- [ ] **Task 11.2.2:** Filtro "I miei amici" nella LeaderboardScreen
- [ ] **Task 11.2.3:** Posizione relativa agli amici

### Task 11.3: Social Features
- [ ] **Task 11.3.1:** Lista amici nel profilo
- [ ] **Task 11.3.2:** vedere ultima attività amici
- [ ] **Task 11.3.3:**sfida diretta amico (quick match)

---

## 📊 Timeline Riepilogativa

| Milestone | Tempo | Stato |
|-----------|-------|-------|
| 1. Identità Utente | 2-3h | ✅ Completato |
| 2. Classifica Generale | 2-3h | ✅ Completato |
| 3. Tier System | 2-3h | ✅ Completato |
| 4. Test e Validazione | 1-2h | ✅ Completato (129 test) |
| 5. Tornei | 3-4h | ⏳ Todo |
| 6. Sfide Express (Link) | 2-3h | ✅ Completato |
| 6b. Sistema Amicizie | 2-3h | ✅ Completato |
| 6c. Sfide tra Amici | 4-5h | 📋 Pianificato |
| 7. Statistiche Avanzate | 2-3h | ✅ Completato |
| 8. Achievement | 2-3h | ⏳ Todo |
| 9. Shop | 3-4h | ⏳ Todo |
| 10. Modalità Hard | 2-3h | ⏳ Todo |

**Totale:** ~30+ ore lavoro

---

## 📝 Note Implementative

### Componenti creati/modificati:
- `src/types/game.ts` - Tipi e configurazione tier
- `src/lib/game-utils.ts` - Funzioni utility per il gioco
- `src/lib/rpc-client.ts` - Aggiunto RPC per leaderboard e salvataggio partite
- `src/components/TierBadge.tsx` - Badge visuale per il tier
- `src/components/LeaderboardScreen.tsx` - Schermata classifica
- `src/components/GameScreen.tsx` - Aggiunto info avversario (nome + tier)
- `src/store.ts` - Aggiunto saveMatchResultToDb

### File SQL da eseguire:
- `supabase/alter_features.sql` - Schema iniziale (gia eseguito)
- `supabase/alter-002-gioco.sql` - Schema per matches, matches_history e funzioni

### Test:
- `src/test/game-utils.test.ts` - 36 test per le funzioni di gioco

---

*Document generato automaticamente - Aggiornato: 2026-03-25*