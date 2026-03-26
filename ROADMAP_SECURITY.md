# 🛡️ Roadmap di Ottimizzazione Sicurezza - Istinto Puro

## 📋 Panoramica

Questo documento definisce le milestone e i task per rendere l'applicazione "Istinto Puro" sicura e pronta per il production.

**Stato attuale:** MVP funzionante con vulnerabilità critiche da risolvere
**Obiettivo:** Applicazione sicura, testata e conforme alle best practice

---

## 🔴 MILESTONE 1: Security Hardening (CRITICO)

**Tempo stimato:** 2-3 giorni
**Priorità:** ALTISSIMA - Blocca deployment production

### Task 1.1: Fixare le funzioni RPC insicure
- [x] **Task 1.1.1:** Convertere `get_random_match()` da `security.insecure()` a `security.enable()`
  - [x] Implementare policy RLS per tabella `matches`
  - [x] Aggiungere `auth.uid()` nelle query
  - [x] Testare accesso senza token
- [x] **Task 1.1.2:** Convertere `validate_player_intersection()` a `security.enable()`
  - [x] Applicare policy RLS su `teams_seasons`
  - [x] Validare input player_id
  - [x] Logare tentativi di accesso non autorizzato
- [x] **Task 1.1.3:** Convertere `generate_seasons()` a `security.enable()`
  - [x] Limitare modifiche solo al team dell'utente
  - [x] Bloccare eliminazione dati
- [x] **Task 1.1.4:** Convertere `update_match_status()` a `security.enable()`
  - [x] Verificare ownership match
  - [x] Bloccare modifiche stato post-match

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
- [x] **Task 1.2.4:** Definire policy per tabella `teams_seasons`
  - [x] SELECT per tutti
  - [x] UPDATE solo per owner team
  - [x] INSERT solo per owner team
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
  - [x] Array whitelist: [1, 2, 3]
  - [x] Reject input non valido
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
  - [x] Revoke session anomala (implementato in security.ts)
- [x] **Task 2.1.2:** Aggiungere logout everywhere
  - [x] Logout su errore auth
  - [x] Logout su timeout
  - [x] Logout su password change
- [x] **Task 2.1.3:** Rate limiting su login
  - [x] Max 5 tentativi/minuto per email
  - [x] Lockout 15min dopo 5 fallimenti
  - [ ] **(OPZIONALE)** Notifica email per lockout

### Task 2.2: Password Security
- [x] **Task 2.2.1:** Implementare password strength requirements
  - [x] Min 8 caratteri
  - [x] Min 1 numero, 1 maiuscola, 1 simbolo
  - [x] Non usare password recenti (5)
- [x] **Task 2.2.2:** Aggiungere password reset via email
  - [x] Token JWT a scadenza (1h) (gestito da Supabase)
  - [x] One-time use (gestito da Supabase)
  - [x] Email con link reset (implementato sendPasswordResetEmail)
- [x] **Task 2.2.3:** Aggiornare hash password
  - [x] Usare bcrypt/scrypt (gestito da Supabase)
  - [x] Work factor: 12 (gestito da Supabase)

### Task 2.3: CSRF Protection
- [x] **Task 2.3.1:** Implementare anti-CSRF token
  - [x] Token in form submit (gestito da Supabase)
  - [x] Validazione server-side (gestito da Supabase)
  - [x] Regenerate su ogni submit (gestito da Supabase)
- [x] **Task 2.3.2:** HttpOnly cookies
  - [x] Sesstion cookie HttpOnly (gestito da Supabase)
  - [x] Secure flag (HTTPS) (gestito da Supabase)
  - [x] SameSite=Strict (gestito da Supabase)

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

*Document generato automaticamente - Aggiornato: 2026-03-24*
