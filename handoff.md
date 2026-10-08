# Handoff — Restyle "Night Pitch" di Istinto Puro

Documento di passaggio di contesto per riprendere il lavoro in una nuova chat, senza accesso alla conversazione originale. Progetto: app React/TypeScript "Istinto Puro" (quiz calcistico 1vs1), repo locale `/Users/luigiausino/Desktop/claude/Istinto-puro`, branch `feature/restyle`.

## Contesto e obiettivo

L'utente ha fornito un mockup di design ("Night Pitch", tema scuro, colori Volt `#D7FF3A`/Ember `#FF5B3A`, font Archivo/Geist/Geist Mono) come file HTML statico esportato da uno strumento di design, contenente 23 schermate. L'obiettivo è restylare l'intera app per farla combaciare con quel disegno, **senza** cambiare la logica applicativa (store Zustand, chiamate Supabase/RPC, regole di gioco) salvo laddove un bug reale viene scoperto incidentalmente nel file che si sta già modificando.

Un secondo mockup ("Dialogs e avvisi", formato zip con HTML+JS) è stato caricato a metà sessione per il sistema di finestre di dialogo/conferma/toast.

**Il piano di lavoro completo vive in `restyle.md` alla radice del repo.** È un file di circa 400 righe con 12 fasi, ciascuna scomposta in task/sotto-task con checkbox. Ogni fase già completata ha annotazioni dettagliate su cosa è stato fatto, cosa è stato corretto rispetto al piano originale, e cosa resta aperto. **Leggere `restyle.md` per intero prima di continuare è il primo passo obbligatorio.**

## Stato raggiunto (fine sessione precedente)

Fasi completate e verificate: **0, 1, 2, 3, 4, 4B (parziale), 5, 6**. Non iniziate: **7, 8, 9, 10 (parziale), 11, 12**.

Riepilogo per fase (dettagli completi in `restyle.md`):

- **Fase 0** — Design tokens (colori, font via Google Fonts CDN, raggi, ombre, timing di animazione nominati) in `src/styles/night-pitch.css`, importato da `src/index.css`.
- **Fase 1** — ~20 componenti condivisi in `src/components/ui/` (Button, Chip, SegmentedControl, DifficultySelector, Field, TierBadge, StripedProgressBar, BentoStatCard, ListRow, AchievementBadge, EmptyState, Toast, BottomSheet, CircularTimer, RoundProgressBar, TeamCrest, LeagueFlag, BottomNavBar, 6 loader in `src/components/ui/loaders/`).
- **Fase 2** — `BottomNavBar` agganciata in `src/App.tsx`.
- **Fase 3** — `src/components/HomeScreen.tsx` riscritta. **Nota importante**: la prima stesura si basava su un riassunto prodotto da un sotto-agente ed era imprecisa; dopo segnalazione dell'utente è stata riletta e corretta sul file sorgente esatto del mockup. Lezione applicata da qui in poi: **rileggere sempre il file HTML esatto della schermata prima di implementare**, mai fidarsi di un riassunto.
- **Fase 4** — `src/components/GameScreen.tsx` e `src/components/CircularTimer.tsx`. Round totali = 3 (non 5 come nell'esempio del mockup) perché corrisponde alla vera regola di vittoria (`newPlayerRoundsWon >= 2` in `gameplaySlice.ts`). Loghi squadra reali mantenuti al posto dei gonfaloni generici del mockup.
- **Fase 4B** — Sistema dialoghi in `src/components/ui/` (`AlertDialog.tsx`, `AlertIconBadge.tsx`, `SuccessAlert.tsx`, `ErrorAlert.tsx`, `CountdownSheet.tsx`, `ConfirmSheet.tsx`, `Toast.tsx` riscritto a 4 toni). Integrato: modale abbandono partita in `GameScreen.tsx`, toast globali in `App.tsx`. **Non integrato**: `ErrorAlert`/`SuccessAlert`/`CountdownSheet` sono pronti come componenti ma non agganciati a trigger reali (vedi "Aspetti aperti" sotto — richiede funzionalità backend non ancora decise).
- **Fase 5** — `src/components/LeaderboardScreen.tsx` riscritta, podio con animazione a cascata.
- **Fase 6** — Intera sezione Profilo (`src/components/ProfileScreen.tsx` + tutto `src/components/profile/*`). **Scoperta architetturale importante**: il Profilo ha 4 schede fisse (Stats/Trofei/Storico/Amici), non 6 come assunto inizialmente nel piano — "Modifica profilo" è un bottom sheet (`EditProfileSheet.tsx`, nuovo file) e "Negozio" è una schermata separata (`ProfileShopTab.tsx` ora prende `onBack`, non è più una tab), entrambe raggiunte dall'header sempre visibile. `ProfileInfoTab.tsx` è stato eliminato (contenuto assorbito dall'header fuso + dallo sheet). `ProfileAchievementsTab.tsx` riscritta su `achievement.html` con forme/colori esatti per tier (vedi `src/components/ui/AchievementBadge.tsx` e `src/components/profile/achievementIcons.ts`, 26 icone uniche mappate per singolo achievement).

## Metodo di lavoro consolidato (da preservare)

1. **Prima di toccare una schermata, rileggere per intero il file HTML del mockup corrispondente** (non un riassunto). Questo ha corretto errori reali più volte durante la sessione.
2. **Non inventare dati**: se il mockup mostra un numero/stato che l'app reale non può calcolare (es. progresso achievement, conteggio tornei aperti, countdown di ricerca), o si lascia il dettaglio fuori documentandolo come punto aperto, o si implementa solo se il dato è davvero derivabile da ciò che l'API/store già restituisce.
3. **Quando il mockup confligge con una regola reale del gioco**, vince la regola reale (esempio: round totali).
4. **Dati reali > segnaposto generico del mockup**, quando l'app li ha già (esempio: loghi squadra veri invece di gonfaloni).
5. **Verifica ad ogni fase**: `npx tsc --noEmit -p .` (solo errori preesistenti già noti devono comparire, elencati sotto), `npm test` (208 test, devono restare tutti verdi), `npm run build`.
6. **Verifica visiva dal vivo quando possibile**: installare Playwright temporaneamente (`npm install --no-save playwright`, poi `npx playwright install chromium` se serve), scrivere un piccolo script `.mjs` che naviga l'app (serve lo stack Docker locale attivo, vedi sotto), fare screenshot, **poi ripulire sempre**: `rm` lo script, `npm uninstall --no-save playwright`, `git checkout -- dist/ && git clean -fd dist/` (il build genera artefatti in `dist/` che non vanno committati).
7. **Build/lint non vanno mai lasciati a inquinare `dist/`**: dopo ogni `npm run build` di verifica, ripristinare `dist/` con `git checkout`.

## Ambiente di test locale

Lo stack gira via Docker Compose (`docker-compose.yml` alla radice): Postgres, Kong/Supabase API, Auth, Realtime, Studio, Mailpit, e il container `istintopuro-app` (Vite dev server con bind-mount del codice sorgente, hot-reload reale). Avvio: `docker-compose up -d` (il comando `docker compose` senza trattino **non funziona** in questo ambiente, dà errore `unknown shorthand flag`; usare sempre `docker-compose`, binario separato). App raggiungibile su `http://localhost:3000`.

Runtime: Colima (non Docker Desktop). Se `docker` non risponde ("Cannot connect to the Docker daemon") pur risultando Colima "running", è un disallineamento del socket di inoltro verso l'host — risolto con `colima restart` (non serve reinstallare nulla). Se i container risultano assenti (`docker ps -a` vuoto) nonostante Colima attivo, vuol dire che lo stack è stato fermato (`docker-compose down`) e va solo rifatto `docker-compose up -d`.

Per testare con un utente autenticato reale: non esiste un account persistito riutilizzabile a fine sessione precedente (quello creato era un test account effimero, email generata con timestamp, password nota solo nello script di test già rimosso). **Registrarne uno nuovo** via `AuthScreen` (form "Registrati") è semplice e veloce: in locale la conferma email non è richiesta (nessun blocco), il login è immediato dopo la registrazione.

## Mockup: dove recuperarli se servono di nuovo

I file HTML dei mockup erano stati decompressi e salvati in `/tmp/restyle_clean/named/*.html` (uno per schermata, nomi leggibili es. `tornei.html`, `crea-torneo.html`, `amici-sfide.html`, ecc.) e in `/tmp/dialoghi/Dialogs.dc.html` per il sistema dialoghi. **`/tmp` è effimero**: se questi file non esistono più nella nuova sessione, vanno ri-estratti dai file originali caricati dall'utente:

- Mockup principale (23 schermate, bundle gzip+base64 dentro un file `.html` singolo): `/Users/luigiausino/.claude/uploads/f75a00b4-a9dc-57ed-8b86-c04d9f8b325b/c0ae5a5a-Istinto_Puro___Night_Pitch.html`. Contiene un blocco `<script type="__bundler/manifest">` con un JSON i cui valori sono `{mime, compressed, data}` (data = base64 di un blob gzip); ogni blob decompresso contiene un ulteriore `<script type="__bundler/template">` con l'HTML vero della schermata, codificato come stringa JSON-escaped (richiede `json.loads('"' + raw + '"')` in Python per decodificarla, non solo gunzip).
- Mockup dialoghi (zip semplice, non il formato sopra): `/Users/luigiausino/.claude/uploads/f75a00b4-a9dc-57ed-8b86-c04d9f8b325b/11a6ce7c-06___Dialog_e_avvisi-html.zip`, contiene `Dialogs.dc.html` già leggibile direttamente (nessuna decompressione necessaria oltre `unzip`).

Schermate del mockup principale **non ancora lette/usate** (servono per le fasi future): `tornei.html`, `crea-torneo.html` (Fase 7), nessun mockup dedicato per Sfida/Challenge oltre ad `amici-sfide.html` già usato in Fase 6 (Fase 8 dovrà derivare lo stile per analogia, come già annotato in `restyle.md`), nessun mockup per Autenticazione (Fase 9, da progettare ex novo e validare con l'utente prima di finalizzare).

## Prossimo passo concreto

1. Leggere `restyle.md` per intero (contiene lo stato esatto, task per task, di tutto il lavoro svolto finora).
2. Procedere con **Fase 7 — Tornei** (`src/components/TournamentsScreen.tsx` + `src/components/tournament/*`): rileggere `tornei.html` e `crea-torneo.html` (ri-estraendoli se necessario, vedi sopra) riga per riga prima di scrivere codice.
3. Nota per Fase 7: `ConfirmDialog.tsx` (il vecchio componente di conferma, non il nuovo `ConfirmSheet` del sistema dialoghi) è usato anche da `TournamentsScreen.tsx` — in Fase 6 è stato **lasciato invariato** proprio perché condiviso con Tornei, non ancora raggiunto. Quando si tocca Tornei, valutare se migrarlo anche lì al nuovo `ConfirmSheet` (coerenza col resto dell'app) e solo allora eventualmente rimuovere il vecchio `ConfirmDialog.tsx` se non più usato da nessuno.

## Punti aperti (decisioni da prendere con l'utente, non assumere)

- Icona notifiche in Home: solo visiva, nessun sistema di notifiche reale da collegare — con cosa, se mai richiesto?
- Verifica nickname disponibile in tempo reale (nello sheet di modifica profilo): nessun endpoint esiste oggi, serve deciderne la costruzione o rinunciare alla live-check.
- "Squadra del cuore": oggi testo libero. Il mockup la tratta come selezione strutturata con anteprima gonfalone — cambiarla sarebbe un cambio di comportamento, non solo di stile, da confermare prima di farlo.
- `is_online` (amici) sempre `false`: nessuna presenza reale implementata, il pallino "online" non compare mai. Va bene così o serve una vera presence?
- `ErrorAlert` "connessione persa": il componente esiste ma non c'è alcun rilevamento reale di disconnessione realtime nello store (`matchmakingSlice`/`gameplaySlice`). Costruirlo è una funzionalità nuova, non implicita nel restyle.
- `SuccessAlert` "avversario trovato": non esiste oggi uno stato intermedio "match trovato ma non ancora iniziato" nello store da cui agganciare questo alert.
- `CountdownSheet` per sfida-amico ricevuta: pronto ma non collegato al polling reale in `App.tsx` (che usa ancora il vecchio toast a 2 bottoni Accetta/Rifiuta).
- Stile Auth screen: nessun mockup fornito finora. Prima bozza da sottoporre a validazione, non implementare direttamente in definitiva.
- Forma del badge achievement per il tier Diamond: **non più un problema aperto** — verificato che nessuno dei 26 achievement reali usa quel tier, quindi non serve una quinta forma per `AchievementBadge`.

## Problema di dati non risolto (fuori scope restyle)

Durante un test con dati reali in Fase 4, un nome giocatore risposta-corretta è apparso come `M&APOS;BALANZOLA` invece di `M'Balanzola` — entità HTML non decodificate da qualche parte a monte (probabile nell'import dati/API-Football). Il rendering nel componente è identico a quello preesistente (`{correctAnswer}` semplice), quindi è un bug di dati preesistente, non introdotto dal restyle. Non è stato indagato oltre né corretto: segnalarlo all'utente se richiede attenzione separata.

## Baseline errori TypeScript preesistenti (non toccare, non è lavoro di questa sessione)

`npx tsc --noEmit -p .` restituisce da sempre (anche prima di questa sessione, salvo i 3 in `App.tsx` emersi installando `@types/react` mancante in Fase 1) un set di ~17-18 errori preesistenti in file non toccati dal restyle: `src/App.tsx` (3, riferiti a un valore `'game'` mai aggiunto al tipo di `currentScreen` — bug preesistente, dead-code probabile), `src/authStore.ts`, `src/components/AuthScreen.tsx`, `src/lib/api/profile.ts`, `src/lib/error-logger.ts`, `src/store/matchmakingSlice.ts`, `src/test/security.test.ts`. Se in una nuova sessione questi numeri cambiano, confrontarli con questa lista prima di preoccuparsene: sono rumore di fondo noto, non regressioni introdotte dal restyle.

## File dello YAML del piano da NON perdere

`restyle.md` è l'unica fonte di verità sullo stato del piano. Ogni volta che si completa una fase, aggiornarlo con lo stesso livello di dettaglio usato finora (cosa è stato implementato, cosa corretto rispetto al piano originale, cosa verificato, cosa resta aperto) prima di passare alla fase successiva.
