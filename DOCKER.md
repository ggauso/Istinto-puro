# Istinto Puro — stack Docker locale (senza Supabase Cloud)

Questo progetto può girare interamente in locale con Docker, usando lo stesso
software open source di Supabase (Postgres + Auth/GoTrue + PostgREST + Realtime),
self-hosted, invece del progetto Supabase Cloud. Il codice React/TypeScript
dell'app **non è stato modificato**: usa ancora `@supabase/supabase-js`, punta
solo a un URL locale invece che a `*.supabase.co`.

## ⚠️ Quale comando usare: `docker compose` o `docker-compose`

Questa guida usa `docker compose` (il plugin moderno, integrato in `docker`).
**Su alcune installazioni — incluso il Mac su cui questo stack è stato
sviluppato — quel plugin non è disponibile** e va usato il binario
standalone `docker-compose` (trattino, comando separato) con **la stessa
identica sintassi**: ovunque in questa guida vedi `docker compose ...`,
prova prima quello e, se ricevi `unknown command: docker compose`, usa
`docker-compose ...` al suo posto. Verifica quale hai con:

```bash
docker compose version   # plugin moderno
docker-compose version   # binario standalone (fallback)
```

## Cosa include lo stack

| Servizio | Ruolo |
|---|---|
| `app` | Frontend + server Express/Vite di questo progetto |
| `kong` | API gateway — punto d'ingresso unico per Auth/REST/Realtime |
| `db` | Postgres (schema completo dell'app + auth/realtime) |
| `auth` | GoTrue: login, registrazione, reset password, OAuth |
| `rest` | PostgREST: query dirette + le ~40 funzioni RPC del gioco |
| `realtime` | Matchmaking online (broadcast/presence usati da `src/store/matchmakingSlice.ts`) |
| `studio` | Dashboard di amministrazione (equivalente locale di supabase.com/dashboard) |
| `meta` | Backend usato da Studio per introspezione DB |
| `mailpit` | Cattura le email (conferma registrazione, reset password) invece di inviarle |

Rispetto allo stack ufficiale di self-hosting Supabase sono stati **rimossi**
(perché l'app non li usa): Storage, Imgproxy, Edge Functions, Analytics/Logflare,
Vector, Supavisor. Vedi i commenti in cima a `docker-compose.yml` per i dettagli.

## Avviare lo stack

```bash
cp .env.docker.example .env   # solo la prima volta — vedi nota sotto se hai già un .env
docker compose up -d
```

La prima volta scarica le immagini e inizializza il database (schema + RLS +
tutte le funzioni RPC): ci vuole qualche minuto. Le volte successive è quasi
immediato, a meno che tu non abbia cancellato il volume dati (`docker compose down -v`).

> **Nota**: se hai già un `.env` con le chiavi del tuo progetto Supabase Cloud,
> fanne una copia prima di sovrascriverlo con `.env.docker.example`. I due file
> non sono compatibili: uno punta al cloud, l'altro allo stack locale.

## Verificare che sia tutto su e sano

```bash
docker compose ps
```

Tutti i servizi devono risultare `Up`/`healthy` (`rest` e `app` non hanno un
healthcheck configurato, quindi restano solo `Up` — è normale). Esempio di
output atteso:

```
NAME                                STATUS
istintopuro-app                     Up
istintopuro-auth                    Up (healthy)
istintopuro-db                      Up (healthy)
istintopuro-kong                    Up (healthy)
istintopuro-mailpit                 Up (healthy)
istintopuro-meta                    Up (healthy)
istintopuro-rest                    Up
istintopuro-studio                  Up (healthy)
realtime-dev.istintopuro-realtime   Up (healthy)
```

## URL e servizi — riferimento rapido

| Cosa | URL | Note |
|---|---|---|
| **App (frontend)** | http://localhost:3000 | Il gioco vero e proprio — apri questo nel browser |
| **API gateway (Kong)** | http://localhost:8000 | È l'URL da mettere in `VITE_SUPABASE_URL`/`SUPABASE_URL` |
| **Supabase Studio** (dashboard DB) | http://localhost:8000 | Stesso URL di Kong (root path). Login: `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` nel tuo `.env` (default demo: `supabase` / `this_password_is_insecure_and_should_be_updated`) |
| **Mailpit** (email catturate) | http://localhost:8025 | Conferma registrazione, reset password — tutte le email finiscono qui, non vengono mai inviate davvero |
| API Auth (GoTrue) | http://localhost:8000/auth/v1/ | Uso diretto/debug, normalmente non serve aprirlo a mano |
| API REST + RPC (PostgREST) | http://localhost:8000/rest/v1/ | Uso diretto/debug (es. `curl .../rest/v1/rpc/get_leaderboard`) |
| Postgres (DB) | non esposto sull'host | Solo interno alla rete Docker — vedi comando psql sotto |

## Fermare lo stack

```bash
docker compose down          # ferma tutti i container, MANTIENE i dati (DB, utenti, squadre importate)
docker compose down -v       # ferma tutto e AZZERA il database (volume dati cancellato)
```

Per riavviarlo dopo un `docker compose down` (senza `-v`) basta rilanciare
`docker compose up -d`: i dati ci sono ancora, non serve ripopolare nulla.
Se invece hai usato `-v`, allo start successivo il database riparte vuoto
(le migrazioni si reinizializzano da capo) e va ripopolato — vedi
"Popolare i dati di gioco" sotto.

## Comandi utili di tutti i giorni

```bash
docker compose restart app                      # riavvia solo il frontend/server
docker compose up -d --build app                # ricostruisce l'immagine dell'app e la riavvia
docker compose logs -f app                       # segui i log del frontend/server in tempo reale (Ctrl+C per uscire)
docker compose logs -f db                        # log di Postgres (utile per debug migrazioni)
docker exec -it istintopuro-db psql -U postgres -d postgres   # apri una shell psql sul database
APP_TARGET=prod docker compose up -d --build     # usa la build di produzione invece del dev server
```

## Popolare i dati di gioco (teams/players/player_teams)

Lo stack parte con database vuoto: senza squadre e giocatori il gioco non è
giocabile. Due opzioni:

**Opzione A — riusa i dati che hai già importato su Supabase Cloud (consigliata)**

Sul tuo `.env` "reale" (quello con le chiavi del progetto Cloud, **non** quello
Docker), esporta in sola lettura le tre tabelle:

```bash
npm run export-seed
```

Poi, con lo stack Docker locale avviato, carica il file generato:

```bash
docker exec -i istintopuro-db psql -U postgres -d postgres < docker/volumes/db/seed/local-data.sql
```

Questo non modifica né legge/scrive nient'altro sul progetto Cloud: fa solo
`SELECT` sulle tre tabelle e scrive un file SQL locale.

**Opzione B — reimporta da zero da API-Football**

Serve una `API_FOOTBALL_KEY` valida (consuma la tua quota API, tipicamente
100 richieste/giorno sul piano gratuito — un'importazione completa può
richiedere più giorni, lo script riprende da solo da dove si era fermato).
Nel tuo `.env` Docker imposta `API_FOOTBALL_KEY=...`, poi:

```bash
docker compose exec app npm run import-data
```

## Login e primo utente

Per comodità in locale `ENABLE_EMAIL_AUTOCONFIRM=true` di default: dopo la
registrazione sei loggato subito, senza dover confermare l'email. Per testare
il flusso reale di conferma (o il reset password), apri Mailpit
(http://localhost:8025): tutte le email finiscono lì invece di essere
inviate davvero.

Il bottone "Continua con Google" è **disattivato** in locale (fallirà con un
errore gestito lato client). Per abilitarlo: crea delle credenziali OAuth
Google, valorizza `GOOGLE_ENABLED`/`GOOGLE_CLIENT_ID`/`GOOGLE_SECRET` nel tuo
`.env` e scommenta le righe `GOTRUE_EXTERNAL_GOOGLE_*` nel servizio `auth` di
`docker-compose.yml`.

Se modifichi uno dei file SQL sotto `docker/volumes/db/`, ricorda che vengono
eseguiti **solo alla prima inizializzazione** del database: per farli
rieseguire serve `docker compose down -v` (cancella tutti i dati, comprese
squadre/giocatori importati — riesegui poi la sezione "Popolare i dati" sopra).

## Bug noto (risolto): Realtime e colima/virtiofs

Il client `@supabase/supabase-js` recente manda sempre frame WebSocket
binari. Questo esponeva due problemi diversi a seconda della versione del
server `supabase/realtime` self-hosted, entrambi legati al mount
`virtiofs` di colima (il bind mount che `docker/volumes/db/data` usava
in origine):

- **Versioni "vecchie" (v2.34.47, v2.47.4)**: non sanno decodificare il
  frame binario, crash con `Phoenix.Socket.V2.JSONSerializer.decode_binary`
  (`function_clause`), riavvio continuo del container `realtime` — isolato,
  non toccava mai i dati, ma rendeva il pairing via Realtime inaffidabile
  (ogni broadcast falliva, sia via WS che via fallback REST con 422).
- **`supabase/realtime:latest` (v2.140.8)**: decodifica il binario
  correttamente, ma crea in automatico uno slot di replica logica
  (`pg_replslot/supabase_realtime_messages_replication_slot_/`) per la
  feature "Broadcast from Database" (non usata da questa app). Su un
  **bind mount** con virtiofs, creare quel file nuovo falliva in modo non
  deterministico e poteva **mandare in PANIC Postgres stesso**, non solo
  Realtime (successo una volta in questo progetto, richiese di fermare i
  container e cancellare a mano la cartella dello slot).

**Fix strutturale applicato (2026-10-05)**: i dati di Postgres sono stati
migrati da bind mount (`./docker/volumes/db/data`) a un **volume Docker
nominato** (`db-data`, dichiarato in fondo a `docker-compose.yml`) — vive
nel filesystem nativo della VM colima, niente più virtiofs per quel path.
Con questo, `supabase/realtime:latest` (ora l'immagine in uso) funziona
correttamente: niente più crash né su Realtime né su Postgres. Verificato
con test ripetuti a due browser/due utenti (sfida tra amici), pairing
stabile su più round consecutivi.

La vecchia cartella `./docker/volumes/db/data` resta sul disco come
backup dei dati pre-migrazione (non più montata da nessun servizio, può
essere rimossa quando si è sicuri di non doverci più tornare). Se in
futuro serve ricreare il volume da zero (`docker volume rm istinto-puro_db-data`
+ `docker compose down -v`), ripopolare poi i dati con l'import o da un
seed — vedi "Popolare i dati di gioco" sopra.

## Sicurezza — leggi prima di esporre lo stack oltre il tuo Mac

Le chiavi `JWT_SECRET`/`ANON_KEY`/`SERVICE_ROLE_KEY` in `.env.docker.example`
sono le chiavi **demo pubbliche** documentate nella guida ufficiale di
self-hosting Supabase. Va benissimo usarle così su `localhost`. Se però esponi
questo stack oltre il tuo Mac (tunnel pubblico, rete condivisa, un server),
**devi** generare un `JWT_SECRET` nuovo e le `ANON_KEY`/`SERVICE_ROLE_KEY`
corrispondenti — altrimenti chiunque conosca queste chiavi pubbliche può
autenticarsi come `service_role` sul tuo database (accesso completo, bypassa
ogni RLS).

## Modificare lo schema di una migrazione già applicata

I file in `docker/volumes/db/migrations/999_app_*.sql` girano **solo alla
primissima inizializzazione** del volume dati Postgres (lo stesso vale per
`init-scripts/`): se lo stack è già avviato da tempo (come normalmente è
in sviluppo), modificare uno di questi file sul disco **non ha alcun
effetto** sul database vivo — va riapplicato a mano, oppure serve un
`docker compose down -v` (che però cancella tutti i dati, incluse
squadre/giocatori importati).

Procedura per applicare a mano una migrazione modificata senza perdere i
dati (verificata il 2026-10-06 aggiornando `11_tournaments.sql`):

```bash
# 1. Esegui il file come supabase_admin, NON come postgres: le tabelle
#    applicative sono di proprietà di supabase_admin (chi le ha create),
#    e "postgres" riceve "must be owner of table" sugli ALTER.
docker exec -i istintopuro-db psql -U supabase_admin -d postgres \
  -v ON_ERROR_STOP=1 < docker/volumes/db/migrations/999_app_NN_nome.sql

# 2. Se una funzione esistente cambia FIRMA (nuovi parametri, nuove colonne
#    di ritorno in una TABLE function) invece di solo corpo, CREATE OR
#    REPLACE fallisce:
#      "cannot change return type of existing function" → serve prima
#        DROP FUNCTION public.nome_funzione();  (poi rilancia lo script)
#      "function name ... is not unique" sul GRANT finale → è rimasto un
#        overload vecchio accanto al nuovo (parametri aggiunti con DEFAULT
#        creano una nuova funzione invece di sostituire quella esistente):
#        DROP FUNCTION public.nome_funzione(TIPI, DEGLI, ARGOMENTI, VECCHI);
#        (poi rilancia lo script)

# 3. PostgREST (il servizio "rest") mantiene una cache dello schema: dopo
#    aver aggiunto/cambiato funzioni o colonne va invalidata, altrimenti
#    il frontend continua a vedere la vecchia forma delle RPC per un po'.
docker exec istintopuro-db psql -U supabase_admin -d postgres \
  -c "NOTIFY pgrst, 'reload schema';"
```

Verifica rapida che il reload abbia funzionato — chiama la RPC via REST
(stesso path che usa il browser) e controlla che la risposta includa i
campi nuovi:

```bash
ANON_KEY=$(grep -E '^VITE_SUPABASE_ANON_KEY' .env | cut -d'=' -f2-)
curl -s -X POST "http://localhost:8000/rest/v1/rpc/nome_funzione" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -d '{}'
```

## Origine dello schema del database

Le 11 migrazioni applicative in `docker/volumes/db/migrations/999_app_*.sql`
sono una copia 1:1 di `supabase/schema/*.sql` — lo schema consolidato e
verificato del database (vedi sotto), organizzato per dominio invece che
per cronologia. I due file `99-realtime.sql`/`998_auth_jwt_helper.sql`
restano invariati: non sono schema applicativo, servono al bootstrap di
Realtime/GoTrue.

**`supabase/schema/`** (11 file numerati: dati di gioco, profili/auth,
partite/classifiche, rate-limit login, audit log, data retention, sfide
via link, amicizie, sfide tra amici, statistiche avanzate, tornei) sostituisce
i 26 file storici in `supabase/migrations_archive/` (schema.sql, rpc.sql,
security.sql, setup-auth.sql, alter_features.sql, alter-002...alter-022),
consolidati in questa sessione dopo un audit oggetto-per-oggetto che ha
trovato più ridefinizioni della stessa funzione in file diversi (es.
`get_challenge_by_token` in 5 file), due tabelle `audit_log` incompatibili
create con lo stesso nome, e colonne (`teams.league_id`,
`player_teams.season`) usate dalle funzioni ma mai aggiunte da nessun file
di migrazione — segno di modifiche fatte a mano sul progetto Supabase Cloud
reale e mai salvate nel repo. Il nuovo schema consolidato è stato verificato
riproducendolo in un container Postgres isolato e confrontando la struttura
risultante con quella già in uso su questo stack Docker.

Se modifichi lo schema in futuro, aggiungi un nuovo file numerato in
`supabase/schema/` (es. `11_tornei.sql`) invece di continuare la vecchia
numerazione `alter-NNN` — e copia lo stesso file anche in
`docker/volumes/db/migrations/` con prefisso `999_app_NN_` per applicarlo
allo stack Docker locale.

Se noti un comportamento diverso rispetto al progetto Supabase Cloud reale,
è probabile che derivi da una modifica fatta a mano sul dashboard Cloud e
mai salvata in nessun file SQL del repo (vedi sopra): confrontala con
Supabase Studio Cloud prima di assumere che il consolidamento sia sbagliato.
