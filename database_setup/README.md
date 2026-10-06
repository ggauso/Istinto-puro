# Migrazione Database a PostgreSQL Self-Hosted

> **Nota (2026-09-19)**: se l'obiettivo è far girare il progetto in locale
> con Docker mantenendo Supabase self-hosted (autenticazione, Realtime,
> RLS inclusi), usa invece `supabase/schema/` — vedi `DOCKER.md`. Questa
> cartella resta valida per lo scenario diverso descritto sotto: un Postgres
> "nudo" senza nessun componente Supabase, che richiede di riscrivere tu
> stesso autenticazione, matchmaking realtime e RLS. `02_rpc_functions.sql`
> contiene una versione di `get_random_match`/`validate_player_intersection`
> senza le validazioni anti-injection che invece sono state riportate nel
> file consolidato `supabase/schema/03_matches_and_leaderboard.sql`.

Questa cartella contiene tutti gli script SQL necessari per ricreare da zero il database di **Istinto Puro** su un qualsiasi server PostgreSQL privato (VPS, Docker, AWS, Aruba, ecc.) senza dipendere da Supabase.

## Appunti Architetturali Prima di Iniziare
Se abbandoni Supabase, dovrai gestire in autonomia alcune funzionalità che Supabase offriva "chiavi in mano":
- **Backend API:** Non potrai più fare query dirette al database dal browser web (`store.ts`) per motivi di sicurezza, ma dovrai creare un server intermedio Node.js/Python che comunica con il DB.
- **Realtime (WebSocket):** Il matchmaking online (Presence e Broadcast) usa Supabase Channels. Dovrai sostituirlo con un tuo server WebSocket (es. `Socket.io`).
- **Autenticazione:** Dovrai gestire autonomamente login, registrazione e hashing delle password.

## Ordine di Esecuzione delle Query

Connettiti al tuo server PostgreSQL tramite riga di comando o un tool grafico (tipo DBeaver, pgAdmin o DataGrip) ed esegui i file in questo rigoroso ordine:

### Passo 1: Esegui `01_tables_and_schema.sql`
- Questo script abilita l'estensione necessaria per la ricerca offuscata (`pg_trgm`).
- Crea la base del database: tabelle `teams`, `players` e `player_teams`.
- Crea una tabella `profiles` indipendente (in Supabase era triggerata via `auth.users`, qui usa UUID standard di Postgres ed include email/password nel caso volessi usare questo DB per gestire il login base).
- Crea tutti gli indici necessari per ottimizzare le ricerche nel database.

### Passo 2: Esegui `02_rpc_functions.sql`
- Crea le funzioni PL/pgSQL che girano sul database (Remote Procedure Calls).
- Include `validate_player_intersection` (usata per validare se un nome utente appartiene sia al team A che al B nel gioco).
- Include l'avanzato motore di estrazione `get_random_match` che calcola dinamicamente coppie di team non recentemente utilizzate forzando partite cross-league.

### Passo 3: Popolamento dei Dati (Data Seeding)
Dopo aver lanciato i due script, la struttura è pronta, ma le tabelle sono vuote. 
Dovrai importare i team e i giocatori reali, ad esempio scrivendo uno script che interroga le Football API o ripristinando un DUMP SQL contenente i dati attuali che avevi generato in fase di importazione su Supabase.
