# 🛡️ Roadmap di Ottimizzazione Sicurezza - Istinto Puro

## 📋 Panoramica

Questo documento definisce le milestone e i task per rendere l'applicazione "Istinto Puro" sicura e pronta per il production.

**Stato attuale:** MVP funzionante con vulnerabilità critiche da risolvere
**Obiettivo:** Applicazione sicura, testata e conforme alle best practice

---

## 🔴 MILESTONE 1: Security Hardening (CRITICO)

**Tempo stimato:** 2-3 giorni
**Priorità:** ALTISSIMA - Blocca deployment production

### Task 1.1: Funzioni RPC e sicurezza a livello database
> ⚠️ **Corretto in audit del 2026-09-19**: la formulazione originale di questa sezione ("convertire da `security.insecure()` a `security.enable()`") descriveva un'API che non esiste in Postgres/Supabase — probabilmente un placeholder mai verificato contro il codice reale. Le funzioni `generate_seasons()`, `update_match_status()` e la tabella `teams_seasons` citate sotto **non esistono nel codebase** (verificato con grep su tutti i file `.sql`/`.ts`/`.tsx`). Quanto segue riflette lo stato reale.

- [x] **Task 1.1.1:** `get_random_match()` è consolidata in `supabase/schema/03_matches_and_leaderboard.sql` (versione con parametro `p_difficulty` e le validazioni anti-injection) ed è invocata dal client con l'anon/authenticated key tramite `supabase.rpc(...)` direttamente in `src/store/gameplaySlice.ts`
- [x] **Task 1.1.2:** `validate_player_intersection()` è anch'essa `SECURITY DEFINER`, filtra sull'intersezione reale `player_teams`/`teams` (non esiste una tabella `teams_seasons`)
- [ ] **Task 1.1.3 (rimosso):** `generate_seasons()` non esiste nel codebase — nessuna evidenza che questa funzionalità sia mai stata implementata o necessaria
- [ ] **Task 1.1.4 (rimosso):** `update_match_status()` non esiste nel codebase — la tabella `matches` viene scritta solo tramite le RPC `save_match_result`/`complete_challenge`/`complete_friend_challenge`, non da un endpoint di update diretto

### ⚠️ Task 1.1.5: Audit di controllo accessi sulle funzioni RPC — 2026-09-19
Un audit mirato ha verificato riga per riga tutte le funzioni `SECURITY DEFINER` del progetto (che bypassano sempre le RLS delle tabelle su cui scrivono — solo un controllo esplicito `auth.uid()` dentro la funzione protegge). Trovate e **corrette** (applicate al DB Docker locale, verificato con test exploit via `curl` + anon key prima/dopo — vedi task successive per il deploy in produzione). La fix è stata scritta inizialmente in `supabase/alter-022-security-fixes.sql`; dopo il consolidamento dello schema SQL (2026-09-19, vedi `DOCKER.md`) è confluita nei file per dominio in `supabase/schema/` ed è archiviata, come standalone patch riutilizzabile, in `supabase/migrations_archive/alter-022-security-fixes.sql`:

- [x] **CRITICO** `save_match_result()` — chiunque (anche non autenticato) poteva forgiare un risultato partita per qualsiasi `p_user_id`, alterando punteggio/tier/leaderboard altrui. **Corretto**: richiede `auth.uid() = p_user_id`.
- [x] **CRITICO** `update_profile_stats()` — stesso problema. **Corretto**.
- [x] **CRITICO** `complete_friend_challenge()` — chiunque poteva chiudere una sfida-amico altrui dichiarando un vincitore/punteggio arbitrario (es. il giocatore in perdita poteva auto-dichiararsi vincitore). **Corretto**: richiede che il chiamante sia `creator_id` o `opponent_id` della sfida.
- [x] **ALTO** `abandon_friend_challenge()` — leggeva `auth.uid()` ma non lo usava per limitare chi potesse invalidare la sfida altrui. **Corretto**.
- [x] **MEDIO** `complete_challenge()` / `expire_challenge()` (sfide via link pubblico) — stesso problema di autorizzazione mancante. **Corretto**.
- [x] **ALTO** `run_retention_cleanup()` — chiamabile da chiunque (doveva essere solo amministrativa). **Corretto**: `REVOKE EXECUTE` da `anon`/`authenticated`.
- [x] **BASSO** `record_audit_event()` (e i wrapper `record_auth_event`/`record_game_event`) — permetteva di iniettare voci di audit log false a nome di un altro utente. **Corretto**, consentendo comunque eventi anonimi legittimi (`p_user_id IS NULL`).
- [ ] **ALTO, non risolto — richiede decisione di prodotto** `record_login_attempt()` — deve restare chiamabile senza sessione (serve prima del login), quindi non è possibile aggiungere un controllo `auth.uid()`: chiunque può chiamarla per un'email arbitraria e forzare il lockout di un account altrui (5 chiamate = 15 min di blocco), senza mai tentare un vero accesso. Alternativa consigliata: sostituire questo rate-limiting custom con quello nativo di GoTrue (configurabile nello stack self-hosted) invece di una RPC pubblica.
- [ ] **Da fare**: applicare `supabase/migrations_archive/alter-022-security-fixes.sql` anche al progetto Supabase Cloud di produzione (incollandolo nell'SQL Editor di Supabase Studio) — non ancora fatto, la fix per ora è solo sul DB Docker locale.
- [x] **Verifica 2026-10-06**: le nuove RPC introdotte per i tornei (`cancel_tournament`, `start_due_tournaments`, estensione di `create_tournament`) seguono lo stesso pattern corretto da questo audit — `cancel_tournament` richiede `auth.uid() = creator_id`, nessuna policy RLS INSERT/UPDATE diretta aggiunta sulle tabelle `tournaments*`. Nessuna nuova vulnerabilità introdotta.

Bug funzionale collaterale trovato e corretto: `removeFriend()` (`src/lib/api/friends.ts`) cancellava l'amicizia solo lato client con `.from('friends').delete()`, bloccato in parte dalla RLS (corretta) e lasciando l'amicizia asimmetrica. Ora usa l'RPC `remove_friend()` già esistente.

### Task 1.2: Configurazione RLS (Row Level Security)
- [x] **Task 1.2.1:** Definire policy per tabella `profiles`
  - [x] SELECT per tutti (stats pubbliche)
  - [x] UPDATE solo per utente proprietario
  - [x] INSERT disabilitato (gestito da Auth)
- [x] **Task 1.2.2:** Definire policy per tabella `matches`
  - [x] SELECT per tutti (resultati pubblici)
  - [x] INSERT solo per utente autenticato
  - [x] UPDATE solo per creator match
- [x] **Task 1.2.3:** Definire policy per tabella `teams`
  - [x] SELECT per tutti (roster pubblici)
  - [x] UPDATE solo per admin/creator
  - [x] INSERT disabilitato
- [x] **Task 1.2.4:** Definire policy per tabella `player_teams` (nome corretto — `teams_seasons` non esiste)
  - [x] SELECT per tutti (`supabase/security.sql`)
  - [ ] UPDATE/INSERT: non ci sono policy dedicate, la tabella viene scritta solo dagli script di import (`scripts/import-data.ts`) con la service role key, non dal client
- [x] **Task 1.2.5:** Testare tutte le policy con Supabase Studio
  - [x] Verificare che RPC falliscono senza auth
  - [x] Verificare che UPDATE falliscono per altri utenti
  - [x] Documentare risultati

### Task 1.3: Validazione Input Client-Side
- [x] **Task 1.3.1:** Aggiungere sanitizzazione per player input
  - [x] Normalizzare stringa player (trim, lowercase)
  - [x] Limitare lunghezza (max 50 caratteri)
  - [x] Regex validation per caratteri consentiti
- [x] **Task 1.3.2:** Validare difficoltà selezionata
  > ⚠️ **Corretto il 2026-10-06** (scoperto durante l'implementazione di
  > Modalità Hard, ROADMAP_FEATURES.md Milestone 10): non esiste nel
  > codebase nessuna whitelist client-side `[1, 2, 3]` dedicata (verificato
  > con grep su `src/lib/security.ts` e altrove) — il claim originale non
  > era mai stato verificato contro l'implementazione reale. La
  > validazione effettiva è server-side, in `get_random_match`
  > (`supabase/schema/03_matches_and_leaderboard.sql`, esteso a 1-4 con
  > `16_hard_mode.sql`): `IF p_difficulty < 1 OR p_difficulty > 4 THEN
  > p_difficulty := 1`, un clamp silenzioso al default anziché un reject
  > esplicito.
  - [x] Validazione server-side (clamp a 1 se fuori range 1-4) in `get_random_match`
  - [ ] Nessuna whitelist client-side dedicata — l'input è comunque limitato ai bottoni della UI (`HomeScreen.tsx`), non un campo libero
- [x] **Task 1.3.3:** Validare campionato selezionato
  - [x] Whitelist ID: [null, 135, 39, 140, 78, 61]
  - [x] Mostra errore se ID non valido
- [x] **Task 1.3.4:** Validare room_id
  - [x] Formato UUID
  - [x] Lunghezza massima
  - [x] Charatteri consentiti

### Task 1.4: Timeout e Error Handling
- [x] **Task 1.4.1:** Implementare timeout per tutte le RPC calls
  - [x] Timeout RPC: 8s (default)
  - [x] Timeout auth: 5s
  - [x] Timeout update: 10s
- [x] **Task 1.4.2:** Gestione errori graceful
  - [x] Timeout → Retry con backoff esponenziale
  - [x] Error → Mostra messaggio utente
  - [x] Log errors su Supabase logs
- [x] **Task 1.4.3:** Circuit breaker pattern
  - [x] Max 3 fallimenti consecutivi
  - [x] Fallback a match pre-generato
  - [x] Queue per retry (integrato nel circuit breaker)

---

## 🟠 MILESTONE 2: Auth & Session Management

**Tempo stimato:** 1-2 giorni
**Priorità:** ALTA

### Task 2.1: Session Security
- [x] **Task 2.1.1:** Implementare session refresh automatico
  - [x] Refresh token ogni 30min (gestito automaticamente da Supabase)
  - [ ] Revoke session anomala: `revokeAllSessions()`/`refreshSession()`/`isSessionValid()` in `security.ts` esistono ma **non sono mai chiamate** da nessun componente (verificato con grep) — sono codice morto, non una funzionalità attiva
- [x] **Task 2.1.2:** Aggiungere logout everywhere
  - [x] Logout su errore auth
  - [x] Logout su timeout
  - [x] Logout su password change
- [x] **Task 2.1.3:** Rate limiting su login
  - [x] Max 5 tentativi falliti in una finestra di 15 minuti per email/IP (corretto: non "al minuto" — vedi `is_email_locked`/`is_ip_locked` in `alter-005-rate-limit.sql`)
  - [x] Lockout 15min dopo 5 fallimenti
  - [ ] **(OPZIONALE)** Notifica email per lockout

### Task 2.2: Password Security
- [ ] **Task 2.2.1:** Implementare password strength requirements
  > ⚠️ **Corretto in audit 2026-09-19**: `validatePasswordStrength()` in `src/lib/security.ts` implementa davvero questi controlli, ma **non viene mai chiamata** da `AuthScreen.tsx` (verificato con grep — zero usi fuori da `security.ts` e dal suo test). Il form di registrazione/reset applica solo `minLength={6}`, senza requisiti di complessità. Va collegata la funzione al form per rendere reale quanto dichiarato.
  - [ ] Min 8 caratteri (form UI richiede solo 6)
  - [ ] Min 1 numero, 1 maiuscola, 1 simbolo (funzione pronta, non collegata alla UI)
  - [ ] Non usare password recenti (5) (funzione pronta, ma nessuno storico password recenti viene passato)
- [x] **Task 2.2.2:** Aggiungere password reset via email
  - [x] Token JWT a scadenza (1h) (gestito da Supabase)
  - [x] One-time use (gestito da Supabase)
  - [x] Email con link reset (implementato sendPasswordResetEmail)
- [x] **Task 2.2.3:** Aggiornare hash password
  - [x] Usare bcrypt/scrypt (gestito da Supabase)
  - [x] Work factor: 12 (gestito da Supabase)

### Task 2.3: CSRF Protection
> ⚠️ **Corretto in audit 2026-09-19**: questa sezione descriveva protezioni basate su cookie di sessione (HttpOnly/Secure/SameSite), ma `src/lib/supabase.ts` usa `createClient()` con la configurazione di default di `@supabase/supabase-js`, che salva la sessione in `localStorage` e autentica le chiamate con un header `Authorization: Bearer <jwt>` — **non usa cookie di sessione**. Questo di per sé rende il classico attacco CSRF (basato sull'invio automatico di cookie cross-site) non applicabile, ma espone un profilo di rischio diverso: furto del token via XSS (dato che è leggibile da qualsiasi script nella pagina). Le voci originali "gestito da Supabase" non erano state verificate contro l'implementazione reale.
- [ ] **Task 2.3.1:** Rivalutare il rischio reale (XSS/token theft in localStorage) invece del CSRF classico, non applicabile con questa configurazione
- [ ] **Task 2.3.2:** Non applicabile con l'attuale transporto Bearer/localStorage — da riconsiderare solo se si migra a sessioni basate su cookie (es. `@supabase/ssr`)

---

## 🟡 MILESTONE 3: Data Protection

**Tempo stimato:** 1 giorno
**Priorità:** MEDIA

### Task 3.1: Encryption
- [ ] **Task 3.1.1:** Crittografare dati sensibili
  - [ ] Email (AES-256)
  - [ ] Credit card se previsto
  - [ ] JWT secrets (KMS)
- [ ] **Task 3.1.2:** Key rotation
  - [ ] Rotate ogni 90 giorni
  - [ ] Dual key durante rotation
  - [ ] Audit log

### Task 3.2: Audit Logging
- [x] **Task 3.2.1:** Implementare audit log
  - [x] UPDATE profili (trigger automatico)
  - [x] Login/logout events
  - [x] Failed auth attempts
  - [x] Eventi di gioco (match_won, match_lost)
  - [ ] **(OPZIONALE) Task 3.2.2:** Creare cron job per cleanup automatico audit log (90 giorni)
- [ ] **Task 3.2.3:** Storage audit
  - [ ] Database: Supabase logs
  - [ ] Files: access log
  - [ ] RPC calls: timestamp

### Task 3.3: Data Retention
- [x] **Task 3.3.1:** Politiche retention
  - [x] Match data: 2 anni (730 giorni)
  - [x] Logs: 90 giorni (audit_log)
  - [x] Failed attempts: 30 giorni (login_attempts)
  - [x] Funzione master `run_retention_cleanup()`
  - [x] View `get_retention_stats()` per monitoraggio
- [ ] **Task 3.3.2:** Data export (GDPR)
  - [ ] Export completo profilo
  - [ ] Download storico match
  - [ ] Delete account (irreversibile)
- [ ] **(OPZIONALE) Task 3.3.3:** Cron job automatico per retention cleanup (eseguire `run_retention_cleanup()` quotidianamente)

---

## 🔵 MILESTONE 5: Compliance & Documentation

**Tempo stimato:** 2 giorni
**Priorità:** BASSA

### Task 5.1: GDPR Compliance
- [ ] **Task 5.1.1:** Privacy policy
  - [ ] Cookie consent
  - [ ] Data usage explanation
  - [ ] Contact info
- [ ] **Task 5.1.2:** Privacy settings
  - [ ] Public/private profile toggle
  - [ ] Data download request
  - [ ] Delete account flow

### Task 5.2: Documentation
- [ ] **Task 5.2.1:** Security policy
  - [ ] Internal team
  - [ ] External disclosure
  - [ ] Incident response
- [ ] **Task 5.2.2:** API docs
  - [ ] Endpoint list
  - [ ] Auth requirements
  - [ ] Rate limits
- [ ] **Task 5.2.3:** User docs
  - [ ] Privacy settings guide
  - [ ] Security best practices
  - [ ] Support contacts

### Task 5.3: Training
- [ ] **Task 5.3.1:** Team training
  - [ ] Secure coding
  - [ ] Incident response
  - [ ] Security tools
- [ ] **Task 5.3.2:** Security awareness
  - [ ] Phishing awareness
  - [ ] Password hygiene
  - [ ] Reporting procedure

---

## 🟢 MILESTONE 4: Monitoring & Incident Response (DOPO MILESTONE 5)

**Tempo stimato:** 1 giorno
**Priorità:** BASSA (funzionalità admin)

### Task 4.1: Security Monitoring
- [ ] **Task 4.1.1:** Implementare monitoring
  - [ ] Failed auth attempts
  - [ ] RPC errors rate
  - [ ] Abnormal traffic patterns
- [ ] **Task 4.1.2:** Alerting
  - [ ] Email su breach
  - [ ] Slack su anomalie
  - [ ] PagerDuty per critico

### Task 4.2: Vulnerability Scanning
- [ ] **Task 4.2.1:** SAST (Static Analysis)
  - [ ] Snyk/CodeQL
  - [ ] Weekly scans
  - [ ] Block critical/high
- [ ] **Task 4.2.2:** DAST (Dynamic Analysis)
  - [ ] OWASP ZAP
  - [ ] Monthly scans
  - [ ] Fix within SLA

### Task 4.3: Penetration Testing
- [ ] **Task 4.3.1:** Engage pentester esterno
  - [ ] Test annuale completo
  - [ ] Bug bounty program
  - [ ] Riporto findings

---

## 📊 Timeline Riepilogativa

| Milestone | Task | Tempo | Stato |
|-----------|------|--------|-------|
| 1. Security Hardening | 1.1 Fix RPC | 1 giorno | ✅ Completed |
| 1. Security Hardening | 1.2 RLS policies | 1 giorno | ✅ Completed |
| 1. Security Hardening | 1.3 Input validation | 4 ore | ✅ Completed |
| 1. Security Hardening | 1.4 Timeout handling | 4 ore | ✅ Completed |
| 2. Auth Management | 2.1 Session | 8 ore | ⏳ Pending |
| 2. Auth Management | 2.2 Password | 4 ore | ⏳ Pending |
| 2. Auth Management | 2.3 CSRF | 4 ore | ⏳ Pending |
| 3. Data Protection | 3.1 Encryption | 4 ore | ⏳ Pending |
| 3. Data Protection | 3.2 Audit logging | 4 ore | ⏳ Pending |
| 3. Data Protection | 3.3 Retention | 4 ore | ⏳ Pending |
| 4. Monitoring | 4.1 Monitoring | 4 ore | ⏳ Pending |
| 4. Monitoring | 4.2 Scanning | 4 ore | ⏳ Pending |
| 4. Monitoring | 4.3 Penetration test | 4 ore | ⏳ Pending |
| 5. Compliance | 5.1 GDPR | 8 ore | ⏳ Pending |
| 5. Compliance | 5.2 Docs | 4 ore | ⏳ Pending |
| 5. Compliance | 5.3 Training | 4 ore | ⏳ Pending |

**Totale:** ~20 ore lavoro (1 settimana part-time)

---

## 🚀 Fasi di Implementazione

### Fase 1 (Giorno 1-2): Hardening Critico
- [ ] Completa Milestone 1
- [ ] Testa su staging
- [ ] Deploy production

### Fase 2 (Giorno 3-4): Auth & Data
- [ ] Completa Milestone 2 e 3
- [ ] Implementa session refresh
- [ ] Configura audit log

### Fase 3 (Giorno 5-6): Compliance
- [ ] Completa Milestone 5
- [ ] Privacy policy
- [ ] User docs

### Fase 4 (Giorno 7+): Monitoring (Admin)
- [ ] Completa Milestone 4
- [ ] Setup alerting
- [ ] Prima scansione sicurezza

---

## 🔐 Checklist Pre-Deployment

Prima di ogni deployment:
- [ ] RPC policies verificate
- [ ] RLS attivo su tutte le tabelle
- [ ] Input validated
- [ ] Timeout configurati
- [ ] Error handling testato
- [ ] Session security verificata
- [ ] Password policy attiva
- [ ] Audit log funzionante
- [ ] Alerting configurato

---

## 📞 Supporto Security

**Security contact:** security@istintopuro.dev
**Incident response:** emergency@istintopuro.dev
**Bug bounty:** https://hackerone.com/istintopuro

---

*Document aggiornato: 2026-10-06 (verifica RPC tornei, nessuna nuova vulnerabilità — vedi Task 1.1.5; corretto claim obsoleto su whitelist difficoltà, Task 1.3.2)*
