<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Istinto Puro

Quiz calcistico multiplayer: due squadre, un solo giocatore ha militato in
entrambe — indovina il nome prima che scada il tempo. Modalità contro l'AI
o PvP in tempo reale, sfide dirette agli amici o via link condivisibile,
tornei a eliminazione diretta (anche schedulati), classifiche globali/
settimanali/mensili, sistema tier.

## Stack

- **Frontend**: React 19 + TypeScript + Vite, Tailwind CSS + Framer Motion, Zustand
- **Backend**: Supabase (Postgres + Auth + Realtime + RLS) — Cloud o self-hosted in Docker
- **Test**: Vitest (156 test)

Dettagli architetturali completi in [`DOCUMENTATION.md`](DOCUMENTATION.md).

## Avvio rapido

Due modi per avere un backend funzionante: un progetto Supabase Cloud tuo,
oppure lo stack self-hosted in Docker (consigliato per sviluppo locale,
nessuna dipendenza da servizi esterni).

### Opzione A — Docker locale (consigliata)

```bash
npm install
cp .env.docker.example .env   # se hai già un .env con chiavi Cloud, fanne prima un backup
docker compose up -d
```

App su http://localhost:3000. Il database parte vuoto: per popolarlo con
squadre/giocatori vedi la sezione "Popolare i dati" in
[`DOCKER.md`](DOCKER.md) (guida completa: servizi inclusi, Studio, Mailpit
per le email, sicurezza delle chiavi demo).

### Opzione B — Supabase Cloud

1. Crea un progetto su [supabase.com](https://supabase.com) ed esegui, in
   ordine, i file numerati in `supabase/schema/` (SQL Editor di Supabase Studio)
2. `npm install`
3. Configura `.env` con `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` del tuo progetto
4. `npm run dev`

## Comandi utili

```bash
npm run dev          # server di sviluppo (Vite + Express)
npm run build         # build di produzione
npm test              # suite di test (Vitest)
npm run import-data    # importa squadre/giocatori da API-Football
npm run export-seed    # esporta teams/players/player_teams da un progetto Supabase esistente (sola lettura)
```

## Documentazione

- [`DOCUMENTATION.md`](DOCUMENTATION.md) — architettura, funzionalità, sicurezza, troubleshooting
- [`DOCKER.md`](DOCKER.md) — stack locale self-hosted: setup, dati, sicurezza
- [`ROADMAP_FEATURES.md`](ROADMAP_FEATURES.md) — stato delle feature, cosa manca
- [`ROADMAP_SECURITY.md`](ROADMAP_SECURITY.md) — stato sicurezza, vulnerabilità note e corrette
- [`supabase/migrations_archive/README.md`](supabase/migrations_archive/README.md) — cronologia storica dello schema DB
