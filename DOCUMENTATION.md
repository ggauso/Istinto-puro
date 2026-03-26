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

```
src/
├── components/       # Componenti React
│   ├── AuthScreen.tsx       # Login/Register
│   ├── GameScreen.tsx       # Schermata di gioco
│   ├── LeaderboardScreen.tsx # Classifiche
│   ├── ProfileScreen.tsx    # Profilo utente
│   └── ...
├── lib/              # Logica di business
│   ├── rpc-client.ts        # Chiamate al database
│   ├── circuit-breaker.ts   # Resilience pattern
│   ├── error-logger.ts     # Logging errori
│   └── supabase.ts          # Configurazione DB
├── store.ts          # State management (Zustand)
├── authStore.ts      # State autenticazione
├── types/            # TypeScript types
└── test/             # Test unitari
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

**Componenti**: `GameScreen.tsx`, `store.ts`

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
- `game_start` - inizio partita con dati match
- `player_won` - un giocatore ha risposto correttamente
- `game_start_ack` - conferma ricezione

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

Tabelle con policy RLS:
- `profiles` - lettura pubblica, modifica solo proprietario
- `matches` - lettura pubblica, insert autenticati
- `teams` - lettura pubblica
- `teams_seasons` - lettura pubblica, modifica solo owner

### Validazione Input

- Sanitizzazione nomi giocatori
- Validazione campionato (whitelist)
- Validazione difficoltà (1, 2, 3)
- Validazione room_id (formato UUID)

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

- **103 test** distribuiti su 6 file:
  - `authStore.test.ts` - 5 test
  - `circuit-breaker.test.ts` - 10 test
  - `security.test.ts` - 15 test
  - `rpc-client.test.ts` - 9 test
  - `utils.test.ts` - 28 test
  - `game-utils.test.ts` - 36 test

### Aree Testate

- Generazione nomi guest (`guest-XXXX`)
- Calcolo tier e progressi
- Ordinamento e filtraggio classifiche
- Validazione input
- Circuit breaker
- RPC client (getUserInfo, getLeaderboard, etc.)

---

## Deployment

### Build Produzione

```bash
npm run build
```

Output in `dist/`

### Variabili Env

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Supabase CLI

```bash
# Apply migrations
supabase db push

# Open studio
supabase studio
```

---

## File SQL Utili

| File | Descrizione |
|------|--------------|
| `supabase/schema.sql` | Schema iniziale tabelle |
| `supabase/alter-002-gioco.sql` | Matches e storico |
| `supabase/alter-003-nickname.sql` | Nickname utente |
| `supabase/alter-004-leaderboard.sql` | Classifiche |
| `supabase/alter-005-rate-limit.sql` | Rate limiting |
| `supabase/alter-006-audit-log.sql` | Audit logging |

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
- Controllare `leaderboard_all_time` per dati

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

*Ultimo aggiornamento: 2026-03-25*