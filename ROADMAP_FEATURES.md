# Roadmap Feature di Gioco - Istinto Puro

## 📋 Panoramica

Questo documento definisce le milestone e i task per implementare le nuove feature di gioco.

---

## 🔵 MILESTONE 1: Identità Utente in Partita

**Tempo stimato:** 2-3 ore
**Priorità:** ALTA

### Task 1.1: Mostrare nome utente all'avversario
- [x] **Task 1.1.1:** Modificare RPC `get_random_match` per restituire `match_id` univoco (infrastructure ready)
- [ ] **Task 1.1.2:** Creare tabella `matches` per tracciare partite in corso (richiede DB)
- [x] **Task 1.1.3:** Quando un utente anonymous gioca, assegnare nome "guest-{numero casuale}" (implementato in game-utils.ts)
- [ ] **Task 1.1.4:** Mostrare il nome dell'avversario nella UI di gioco (da integrare in GameScreen)

### Task 1.2: Tracciare partite giocate
- [ ] **Task 1.2.1:** Creare tabella `matches_history` per storico partite (richiede DB)
- [ ] **Task 1.2.2:** Salvare risultato partita alla fine (vittoria/sconfitta, punteggio)
- [ ] **Task 1.2.3:** Associare match all'utente se loggato

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
- [ ] **Task 2.2.2:** Resettare classifiche temporali ogni settimana/mese
- [ ] **Task 2.2.3:** UI per commutare tra classifiche

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
- [x] **Task 3.2.1:** Mostrare badge/icona tier nel profilo utente (getTierInfo implementato)
- [ ] **Task 3.2.2:** Mostrare tier dell'avversario durante la partita
- [ ] **Task 3.2.3:** Filtrare leaderboard per tier

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

## 📊 Timeline Riepilogativa

| Milestone | Tempo | Stato |
|-----------|-------|-------|
| 1. Identità Utente | 2-3h | ✅ Infrastruttura completata |
| 2. Classifica Generale | 2-3h | ✅ Infrastruttura completata |
| 3. Tier System | 2-3h | ✅ Infrastruttura completata |
| 4. Test e Validazione | 1-2h | ✅ Completato (94 test) |

**Totale:** ~8 ore lavoro

---

## 📝 Note Implementative

### Componenti creati:
- `src/types/game.ts` - Tipi e configurazione tier
- `src/lib/game-utils.ts` - Funzioni utility per gioco

### Test creati:
- `src/test/game-utils.test.ts` - 36 test per le funzioni di gioco

### Richiede modifiche al DB Supabase:
- Tabella `matches` per tracciare partite in corso
- Tabella `matches_history` per storico partite
- Funzione RPC `get_leaderboard`

---

*Document generato automaticamente - Aggiornato: 2026-03-25*