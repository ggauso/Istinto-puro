# Restyle "Night Pitch" — Piano d'azione

> Fonte: mockup `Istinto_Puro — Night Pitch.html` (23 schermate statiche: fondamenta, componenti, loader/micro-interazioni, badge achievement, bandiere campionati, home ×2, partita, esito, profilo ×2, classifica, tornei ×2, achievement, shop, amici e sfide, statistiche avanzate, gagliardetti ×5 campionati).
>
> Stato: piano di lavoro. Ogni checkbox va spuntata man mano che il task è completato e verificato (build + lint + test + controllo visivo). Non saltare le fasi: la Fase 0 e la Fase 1 sono prerequisiti per tutte le altre.

## Obiettivo

Restyle completo dell'interfaccia di Istinto Puro secondo il design system "Night Pitch": tema scuro "campo di notte", palette Volt/Ember, tipografia Archivo (display/condensed) + Geist + Geist Mono, raggi/ombre/spaziature a scala fissa, motion a 4 timing nominati, componenti UI riusabili, bottom navigation persistente, loader e micro-interazioni a tema calcistico. Nessuna modifica alla logica di gioco, agli store Zustand o alle API: è un restyle, non un refactor funzionale (eccetto dove esplicitamente notato come "piccola feature mancante" nel mockup).

## Design tokens di riferimento (da `fondamenta.html` + `componenti.html`)

**Colori**
| Token | Hex | Uso |
|---|---|---|
| `ink` | `#0B0C0A` | sfondo app |
| `turf-1` | `#141613` | card/superficie |
| `turf-2` | `#1C1F1B` | rialzo (input, sheet, item attivo) |
| `turf-3` | `#2A2E27` | bordi/input/barre inattive |
| `chalk` | `#F3F5EE` | testo primario |
| `chalk-2` | `#A9AFA2` | testo secondario |
| `label-grey` | `#7C8376` | label/meta/eyebrow |
| `volt` | `#D7FF3A` | primario, "tu", successo, timer attivo — pressed `#B8E01F` |
| `ember` | `#FF5B3A` | avversario, errore, scadenza, uscita — pressed `#E6431F`, testo chiaro `#FF7A5C` |

Tier (gradient + label, **diversi** dagli attuali `TIER_CONFIG` in `src/types/game.ts` che usano hex piatti `#CD7F32`/`#C0C0C0`/ecc.):
- Bronze `linear-gradient(135deg,#E0A878,#8E5A34)` · label `#C98A5A`
- Silver `linear-gradient(135deg,#F0F3F7,#8D949E)` · label `#C9CED6`
- Gold `linear-gradient(135deg,#FFE08A,#C4901C)` · label `#F2C14E`
- Platinum `linear-gradient(135deg,#C6FFF6,#4FB3A4)` · label `#8FE3D6`
- Diamond `linear-gradient(135deg,#DCE5FF,#6178E0)` · label `#9DB4FF`

**Tipografia**
- Font: `Archivo` (variable 400–900, stretch 62–125%), `Geist` (400/700), `Geist Mono` (400/700), via Google Fonts woff2.
- `.disp`: Archivo, stretch 125%, weight 850, uppercase, letter-spacing -0.01em, line-height .92 — hero/H1/punteggi.
- `.cond`: Archivo, stretch 75%, weight 700, uppercase, letter-spacing .06em — eyebrow/label/meta.
- `.mono`: Geist Mono, `font-variant-numeric: tabular-nums` — timer, punteggi, date, prezzi.
- Body: Geist 400.
- Scala: Display 56px · H1 32px (stretch 110%) · Title 20px (650) · Body 15px (400) · Label 12px caps · Score 44px mono 600.

**Spaziature**: scala base 4 → `4,8,12,16,24,32,48,64`.

**Border-radius**: `8,14,22,32` px; radius "hero" asimmetrico `32px 32px 32px 8px`; `999px` pill.

**Elevazioni**: `e0` solo bordo `1px solid rgba(255,255,255,.07)` · `e1` ombra `0 12px 32px -8px rgba(0,0,0,.7)` · `e2` riflettore `0 0 0 1px rgba(215,255,58,.5), 0 0 32px rgba(215,255,58,.25)` (stato selezionato/attivo).

**Motion** (rispettare sempre `prefers-reduced-motion`):
- **Snap** 120–200ms `cubic-bezier(.2,.9,.1,1)` — tab, toggle, press.
- **Bounce** 320–480ms `cubic-bezier(.34,1.56,.64,1)` — successo, badge, +punti, unlock.
- **Glide** 320–560ms `cubic-bezier(.16,1,.3,1)` — ingressi, sheet, liste.
- **Clock** 1s step `linear` — **solo** timer/progress.
- Con `prefers-reduced-motion: reduce`: loader → pallone statico con pulsazione opacità; snap/bounce → dissolvenza 120ms.

Riferimento file puliti (HTML statico, solo consultazione visiva/struttura, non da copiare 1:1): `/tmp/restyle_clean/named/*.html` (fondamenta, componenti, loader-microinterazioni, badge-achievement, bandiere-campionati, home-scegli-sfida, home-ricerca-avversario, partita-round-in-corso, esito-tempo-scaduto, profilo, modifica-profilo, classifica, tornei, crea-torneo, achievement, shop, amici-sfide, statistiche-avanzate, gagliardetti-{seriea,premierleague,laliga,bundesliga,ligue1}).

---

## FASE 0 — Fondamenta tecniche

Prerequisito di tutto il resto: senza questi token/utility nulla delle fasi successive può essere implementato in modo coerente.

- [x] **0.1 Font loading** — **Decisione: Google Fonts CDN** (coerente col mockup originale, setup immediato, zero peso nel bundle).
  - [x] Aggiunti preconnect (`fonts.googleapis.com`, `fonts.gstatic.com`) + `<link>` CSS2 per Archivo (ital,wdth,wght variable), Geist (wght), Geist Mono (wght) in `index.html`, con `display=swap`.
  - [x] `font-display: swap` incluso nell'URL CSS2 (gestito da Google, nessun `@font-face` manuale necessario).
- [x] **0.2 Tailwind v4 theme tokens** — in `src/styles/night-pitch.css` (blocco `@theme`, importato da `src/index.css`)
  - [x] Color tokens: `--color-ink/turf-1/turf-2/turf-3/chalk/chalk-2/label/volt/volt-pressed/ember/ember-pressed/ember-light` → utility `bg-ink`, `text-volt`, `border-turf-3`, ecc.
  - [x] Tier gradient tokens come plain custom properties in `:root` (non `@theme`, perché multi-stop): `--tier-{bronze,silver,gold,platinum,diamond}-{from,to,label}`.
  - [x] Font-family tokens: `--font-sans` (Geist, sovrascrive il default Tailwind → `font-sans`/body ereditano Geist), `--font-mono` (Geist Mono, sovrascrive `font-mono` esistente → `CircularTimer`/altri usi attuali di `font-mono` ottengono già Geist Mono senza modifiche), `--font-display`/`--font-cond` (nuovi, usati dentro `.disp`/`.cond`).
  - [x] Radius tokens con prefisso `np-` per non toccare la scala Tailwind esistente durante la transizione: `--radius-np-{sm,md,lg,xl,hero,pill}` → `rounded-np-*`.
  - [x] Spacing: nessun token dedicato, la scala Tailwind default (4/8/12/16/24/32/48/64) copre già il caso.
  - [x] Shadow tokens: `--shadow-np-e1`, `--shadow-np-e2-volt`, `--shadow-np-sheet` → `shadow-np-*`.
- [x] **0.3 Utility classes globali** in `src/styles/night-pitch.css`
  - [x] Classi `.disp`, `.cond`, `.mono`.
  - [x] `.lift`, `.sw`, `.row-hover`.
  - [x] `.field` (focus-within volt + ring).
  - [x] `.chip` (active scale .94).
  - [x] `.btn` + `.btn-volt` (glow hover), `.btn-ghost`, `.ib` (icon-button hover rotate), `.tab`/`.tab-ind`.
  - [x] Keyframes: `np-pulse-glow` (`.glow`), `np-stripes` (`.stripe`), `np-ring-in` (`.ring`), `np-flick` (`.flame`), `np-shine` (`.shine`), `np-toast-in` (`.toast`), `np-shake` (`.shake`), `np-drop` (`.drop`), `np-grow` (`.grow`), `np-clock-hot` (`.hot`). Non implementate le classi demo `.e-snap/.e-bounce/.e-out/.e-lin` del file fondamenta (erano solo esempi dimostrativi dei 4 timing, non usate da nessuna schermata reale — i timing restano documentati sopra e si applicano via le classi funzionali elencate).
  - [x] `@media (prefers-reduced-motion: reduce)`: disabilita tutte le animazioni nominate sopra, riduce le transition a 120ms, azzera i transform su hover/active.
  - [x] Base globale: `body{margin:0;background:var(--color-ink)}`, `a{color:var(--color-volt)}`/`a:hover{color:#EFFF9E}` — innocuo finché le schermate non ancora restyled impongono il proprio sfondo a livello di wrapper.
- [x] **0.4 Convenzioni di progetto**
  - [x] Scelto file dedicato `src/styles/night-pitch.css` importato via `@import` da `src/index.css` (subito dopo `@import "tailwindcss"`), per tenere `index.css` leggibile.
  - [x] Nessun conflitto con `clsx`/`tailwind-merge`: i nuovi token generano semplici utility Tailwind standard (`bg-volt`, `font-mono`, ecc.), componibili come qualsiasi altra classe.
- [x] **0.5 Verifica**: `npm run build` pulito (CSS compilato correttamente, token presenti: verificato `--color-volt`, `--font-mono`, `.font-display` nel bundle), `npm run lint` (tsc) senza nuovi errori rispetto al baseline pre-esistente (13 errori preesistenti in `authStore.ts`/`HomeScreen.tsx`/`TierBadge.tsx`/`matchmakingSlice.ts`/`error-logger.ts`/`profile.ts`/test — **non introdotti da questa fase**, nessun file toccato in Fase 0 compare tra gli errori), `npm test` 208/208 verdi. Nessuna pagina debug dedicata: la verifica visiva vera e propria avviene in Fase 1 man mano che i componenti usano i token.

---

## FASE 1 — Libreria componenti condivisi

Costruire in `src/components/ui/` (nuova cartella) i primitivi riusati da tutte le schermate, **prima** di toccare le schermate stesse. Ogni componente va fatto con props per varianti/stati, non hardcodato per singolo uso.

> **Nota infrastrutturale emersa durante 1.1**: il progetto non aveva `@types/react`/`@types/react-dom` come devDependency — `tsc` risolveva `react` a `any` ovunque, mascherando silenziosamente eventuali errori di forma delle props in tutta la codebase (il problema è diventato visibile solo scrivendo un'interfaccia esplicita ben tipata). Installati entrambi (`^19.3.0`, coerenti con `react@^19`). Questo ha fatto emergere **4 nuovi errori tsc preesistenti e indipendenti dal restyle** (non presenti nei file toccati qui): `App.tsx` ×3 (`"game"` non assegnabile al tipo union di `currentScreen` — manca il valore `'game'` nello `useState` tipizzato, riga 53) e `AuthScreen.tsx` ×1 (confronto `"forgot_password"` senza overlap, riga 365). Si aggiungono alla lista baseline già nota (0.5) — **non corretti qui**, fuori scope restyle, da segnalare/pianificare separatamente. `npm test` (208/208) e `npm run build` restano verdi dopo l'installazione.

- [x] **1.1 `Button.tsx`** — varianti `volt` (primario, glow+press scale .95), `ghost` (bordo bianco 12%, bg turf-2), `destructive` (ember tint testo), `icon-volt`/`icon-neutral`/`icon-ember` (quadrato 48×48 radius-16), stato disabled (bg turf-2, testo `#5E655A`, cursor not-allowed), stato `loading` (spinner `Loader2`). Dimensioni pill `sm`(44)/`md`(52); icon sempre 48×48. Prop `withArrow` per la freccia che scivola on-hover (classe `.arr`).
- [x] **1.2 `Chip.tsx`** — filtro on/off (bg `#F3F5EE`/transparent), prop `tone` per varianti ember (filtro "Hard"), usato in filtri classifica/amici/storico.
- [x] **1.3 `SegmentedControl.tsx`** — indicator che scivola, generico su N opzioni (indicator dimensionato/spostato in %, non in px fissi come nel mockup, per riuso a 2–6 voci). **Aggiornato in fase di correzione pixel-perfect (vedi Fase 3)**: prop `shape` (`pill` default 999px, `rounded` 20px contenitore/16px indicatore — quest'ultimo per il toggle PvP/Vs IA, che nel mockup reale **non** è a pill) + supporto `icon` per opzione.
- [x] **1.4 `DifficultySelector.tsx`** — selettore a gradino con barre di potenza, opzioni generiche `{value,label,tone}`. **Riscritto in fase di correzione pixel-perfect**: la prop `level` fissa (1-3) è stata rimossa — il numero di barre totali ora segue `options.length` (dinamico, non più hardcoded a 3) e il livello di ciascuna opzione è implicito nella sua posizione; le opzioni `tone="ember"` (Hard) hanno un trattamento "pericolo" persistente anche da spente (bordo/testo/barre leggermente tinti di ember anche senza selezione), replicando esattamente `home-scegli-sfida.html` invece dell'approssimazione iniziale a 3 barre fisse.
- [x] **1.5 `Field.tsx`** — input pill (999px, ricerca) o `answer` (radius-lg, 64px, risposta round), focus ring volt via `.field`, prop `icon`/`prefixSlot` (rinominato da "prefix" per evitare collisione col attributo HTML RDFa `prefix` già tipato da `InputHTMLAttributes`)/`suffix`/`error`.
- [x] **1.6 `TierBadge.tsx` (rework)** — sostituita l'implementazione: pill con cerchio iniziale lettera su gradiente metallico (via le CSS var `--tier-*-from/to/label` di Fase 0), API invariata (`tier`, `showLabel`, `size: sm|md|lg`) per non rompere i 5 chiamanti esistenti (`GameScreen`, `LeaderboardScreen`, `ProfileInfoTab`, `ProfileHistoryTab`). **Le 4 forme geometriche per tier (esagono/scudo/sigillo/ottagono) restano un componente separato**, `AchievementBadge` (1.10) — qui c'è sempre e solo il cerchio, coerente con l'uso reale (badge compatto accanto a nickname/liste). Rimosse le prop inutilizzate `showProgress`/`currentScore` (nessun chiamante le usava; la progressione tier avrà una sua card dedicata via `StripedProgressBar`, 1.7, in Fase 6).
  - **Bug preesistente corretto** (non solo styling): il vecchio componente chiamava `getTierInfo(tierKey)` — funzione di `types/game.ts` che si aspetta un **punteggio numerico** (`totalScore: number`) e ne deriva il tier per soglie — passandogli invece una **stringa tier** (es. `"bronze"`). La stringa coercizzata a `NaN` in un confronto `>=` è sempre `false`, quindi la funzione ritornava sempre `TIER_CONFIG.bronze` a prescindere dal tier reale: ogni badge (anche Gold/Diamond) veniva renderizzato con colore/etichetta Bronze. Sostituito con l'accesso diretto `TIER_CONFIG[tierKey]`.
- [ ] **1.7 `StripedProgressBar.tsx`** — barra progresso striata diagonale animata (classe `.stripe`), con label "N / N+1 pt" e "mancano N pt", usata per progressione tier.
- [ ] **1.8 `BentoStatCard.tsx`** — set di card statistiche: hero win-rate con anello SVG animato (`ring-in`), card semplice (Partite/Media punti/Best score), card streak con fiamma animata + sparkline barre, card tempo medio mono. Props componibili per riuso in Profilo/Statistiche avanzate.
- [x] **1.9 `ListRow.tsx`** — riga lista generica (avatar/leading, title, subtitle mono, trailing, `highlighted` con `shadow-np-e2-volt`) + sotto-componente `RowAvatar` (quadrato/cerchio, tone volt/neutral/ember) per iniziali storico/amici/classifica.
- [x] **1.10 `AchievementBadge.tsx`** — forma per tier via clip-path generato in JS (`regularPolygon`/`scallopedSeal`, non coordinate hardcoded): Bronze=esagono, Silver=scudo, Gold=sigillo a 16 punte, Platinum=ottagono; **Diamond=rombo provvisorio**, nessun riferimento nel mockup — vedi punti aperti in fondo al file. Stati `unlocked` (shine), `in-progress` (progressLabel), `locked` (lucchetto). Dimensioni 84/64/40.
- [x] **1.11 `EmptyState.tsx`** — icona con bounce (`motion-safe:animate-bounce`, disattivato nativamente da Tailwind sotto reduced-motion), titolo, sottotitolo, CTA opzionale.
- [x] **1.12 `Toast.tsx` (rework)** — pill chiara su nero, icona per tono (success=check volt/error=X ember/info=info chalk-2), azione mono opzionale, animazione `.toast` bounce-in. **Non ancora** rewired dentro `App.tsx` (che oggi renderizza i suoi toast inline con markup proprio) — l'integrazione è rimandata a quando si tocca la shell globale (Fase 2/3), per non mischiare un cambio di presentazione con la Fase 1 di puro componenti.
- [x] **1.13 `BottomSheet.tsx`** — overlay blur + card che sale dal basso (motion/react, coerente con `AnimatePresence` già usato altrove), handle grab bar draggable (swipe-down >80px chiude), portal su `document.body`.
- [x] **1.14 `CircularTimer.tsx` (rework)** — colore dinamico volt→ember sotto `hotThreshold` (default 5s) con classe `.hot` pulsante, `tabular-nums`, 132px, **API invariata** (`timeLeft`, `totalTime`) + nuova prop opzionale `hotThreshold`; `GameScreen.tsx` continua a funzionare senza modifiche.
- [x] **1.15 `RoundProgressBar.tsx`** — barra segmentata a N celle (props `total`/`current`).
- [x] **1.16 `TeamCrest.tsx`** — gonfalone generico via clip-path, 8 pattern (`solid/vstripes/halves/sash/band/vband/diag/cross`) tutti generati da funzione (non asset statici), asta+pomello, sigla auto-derivata dal nome squadra. Fallback puro: non tocca l'uso dei loghi `<img>` reali esistenti.
- [x] **1.17 `LeagueFlag.tsx`** — 4 varianti (`wave/tile/circle/chip`), per le 5 leghe + "Tutti", chiavi allineate agli id API-Football già usati in `HomeScreen.LEAGUES` (135/39/140/78/61/null→'all'). **Riscritto in fase di correzione pixel-perfect**: la prima versione approssimava le bandiere con gradienti CSS a bande uguali (sbagliato per Spagna, che ha la banda gialla al 50% non 1/3, e per l'Inghilterra, che è una croce non due bande) — ora sono SVG inline con le stesse coordinate/colori esatti di `home-scegli-sfida.html` (incluso l'icona speciale "Tutti" a 5 bande + cerchio).
- [x] **1.18 `BottomNavBar.tsx`** — nav pill floating con blur (`backdrop-blur-md`), voce attiva espansa (max-width/opacity transition anziché width fissa, per supportare label di lunghezza variabile), safe-area bottom inset. **Corretto in fase di correzione pixel-perfect**: sfondo era `bg-turf-1/90`, il mockup vuole `bg-turf-2/90` (`rgba(28,31,27,.9)`).
- [x] **1.19 Loader set** (`src/components/ui/loaders/`) — tutti e 6 implementati: `BallBounceLoader` (palleggio), `RadarLoader` (radar sweep+ping+centro), `ScoreboardLoader` (tabellone, cifre "flap" sfalsate), `PenaltyLoader` (rigore, pallino+"Gol" pop-in, da far ripartire cambiando `key` nel genitore), `KickoffCountdown` (countdown 3-2-1 con ring lineare che si scarica, volt→ember sull'ultimo secondo — vedi punto aperto sull'uso reale in Fase 10/4.4), `PitchSkeleton` (righe skeleton animate per liste in caricamento). Nuovi keyframe dedicati aggiunti a `night-pitch.css` (`np-ball-bounce/-shadow`, `np-radar-sweep/-ping`, `np-flap`, `np-penalty-fly`, `np-kickoff-ring`, `np-pitch-mow`), tutti coperti dalla media query `prefers-reduced-motion` (i loader a palla diventano pulsazione d'opacità statica, gli altri si disattivano).
- [x] **1.20 Verifica Fase 1**: nessuna pagina `/_ui-kit` dedicata creata (valutato non necessario: nessuno dei 20 componenti è ancora montato in una route reale, quindi non c'è ancora nulla da vedere a schermo — la prima verifica visiva vera avviene in Fase 2/3 quando vengono wired nelle schermate). Verificato invece, dopo ogni blocco di componenti: `tsc --noEmit` pulito su tutti i file nuovi (0 errori in `src/components/ui/**`, `src/lib/cn.ts`, `src/components/{TierBadge,CircularTimer}.tsx`), `npm run build` e `npm test` (208/208) verdi a fine fase. Confermato via grep sul bundle di produzione che nessuno dei 20 componenti è ancora incluso nel JS finale (sono isolati, non importati da nessuna schermata) — nessun side-effect imprevisto sul bundle esistente a parte le ~27KB di `clsx`+`tailwind-merge` ora tirate in dentro da `CircularTimer.tsx`/`TierBadge.tsx` tramite `lib/cn.ts`.

---

## FASE 2 — Navigazione globale

- [x] **2.1** `BottomNavBar` montata in `App.tsx`: 4 voci (Gioca=`Goal`, Classifica=`Medal`, Tornei=`Trophy`, Profilo=`CircleUser`, icone lucide-react), visibile solo quando `currentScreen` è una delle 4 schermate di navigazione (`showBottomNav = NAV_ITEMS.some(...)`), quindi automaticamente nascosta durante `game`/`challenge`/`auth`.
- [x] **2.2** Nessuna modifica al tipo di `currentScreen`: riusati 1:1 i valori esistenti `'home'|'leaderboard'|'tournaments'|'profile'` tramite il nuovo tipo locale `NavScreen` (sottoinsieme derivato da `NAV_ITEMS as const`). Aggiunto `handleBottomNav`, che replica la stessa pulizia sessionStorage (`userLeftChallenge`/`lastChallengeRoomId`) già usata dai callback `onNavigate*` di `HomeScreen`, così la navigazione diretta tra Leaderboard/Tornei/Profilo via bottom nav (oggi impossibile, prima si passava sempre da Home) resta coerente con quella logica anti-redirect-fantasma.
- [ ] **2.3** Padding-bottom nei contenuti scrollabili: **non ancora fatto** — rimandato a quando ciascuna schermata viene toccata nelle Fasi 3/5/6/7 (oggi la nav bar può sovrapporsi all'ultimo elemento di liste lunghe in Leaderboard/Tournaments/Profile, visibile nei screenshot di verifica).
- [x] **2.4** Verificato: `ChallengeScreen`/routing `/sfida/:token` non rientra tra i `NAV_ITEMS`, nav bar assente in quel flusso.
- [x] **Verifica visiva**: `npm run dev` + Playwright headless (installato temporaneamente con `--no-save`, poi rimosso a fine verifica — nessun residuo in `package.json`/lockfile). Screenshot Home: nav bar floating in fondo, pill blur, voce "Gioca" attiva espansa con label su sfondo volt (`#D7FF3A`, visibilmente distinto dal giallo `#FFD700` del resto di Home non ancora restyled — atteso a questo stadio). Click su "Classifica" e "Profilo": schermata cambia, stato attivo si aggiorna correttamente, nav bar persiste. Nessun errore console attribuibile al codice nuovo (gli errori "Failed to fetch"/`ERR_CONNECTION_REFUSED` visti durante il test sono dovuti al backend Supabase locale non in esecuzione in questo ambiente, non al restyle). `npm test` 208/208 e `npm run build` verdi dopo le modifiche ad `App.tsx`.

---

## FASE 3 — Home (`HomeScreen.tsx`) ✅

Riferimento: `home-scegli-sfida.html`, `home-ricerca-avversario.html`.

- [x] **3.1 Header**: avatar **cerchio** (non squircle) con anello conic-gradient 50/50 (accento volt + neutro turf-3 — non legato a "squadra del cuore", non esiste un colore-squadra strutturato nei dati, vedi punto aperto Fase 6), saluto "Ciao, {nome}", pill monete oro sempre visibile per utenti loggati (default 0). **Bottone notifiche ripristinato** (era stato omesso per scelta nella prima stesura, poi reintrodotto in fase di correzione pixel-perfect perché presente nel mockup): visivo soltanto, il pallino ember non è alimentato da un sistema di notifiche reale (vedi punti aperti). **Rimossi i bottoni header "Classifica"/"Tornei"**: ridondanti con la `BottomNavBar` di Fase 2, non presenti nel mockup (che infatti non li ha, essendo coperti dalla nav persistente) — di conseguenza rimosse anche le prop `onNavigateToLeaderboard`/`onNavigateToTournaments` da `HomeScreenProps` e dalla chiamata in `App.tsx`.
- [x] **3.2 Hero**: eyebrow `.cond` volt + H1 `.disp` "Istinto/Puro" (Puro in volt) + sottotitolo invariato.
- [x] **3.3 Selettore modalità**: `SegmentedControl` (PvP/Vs IA).
- [x] **3.4 Rail campionati**: sostituito il `<select>` nativo con rail orizzontale scrollabile di card (`LeagueFlag` variant `tile` + nome, bordo/bg volt quando selezionata); rimossa l'emoji dai nomi lega (la bandiera è ora vettoriale).
- [x] **3.5 Selettore difficoltà**: `DifficultySelector`, Facile/Medio/Difficile in volt (1/2/3 barre), Hard 3 barre in ember.
- [x] **3.6 CTA row**: icon-button "Sfida un amico" (variant `icon-neutral`, solo se PvP+loggato) + CTA pill `Button variant="volt"` con `withArrow`.
- [x] **3.7 Stato "searching"**: `RadarLoader` (1.19) con iniziale utente al centro, titolo `.disp` "Cerco rivale…", `TierBadge` come tier hint (solo se profilo disponibile), bottone "Annulla ricerca" **ora davvero funzionante** (prima non esisteva alcun modo di annullare una ricerca in corso): collegato a `resetGame()` dello store, che già smontava correttamente il canale realtime di matchmaking per altri flussi (abbandono partita) — nessuna nuova logica di backend, solo esposizione di una funzione già sicura ed esistente. **Countdown mono e card "N tornei aperti" non implementati**: richiedono rispettivamente un dato (tempo trascorso in ricerca) oggi non tracciato e una query aggiuntiva non ancora verificata — rimandati, non bloccanti per il restyle visivo.
- [x] **3.8** Nessun residuo di font Tailwind default: tutto il testo usa `.disp`/`.cond`/`.mono`/`font-sans` (quest'ultimo ora è Geist via override del token Fase 0).
- [x] **3.9 Verifica**: `npm run dev` + Playwright headless, screenshot a viewport mobile (420px): Home loggato-fuori, selezione Hard (ember), toggle Vs IA (CTA diventa "Sfida l'IA", icon-button sfida-amico scompare), avvio ricerca (RadarLoader renderizzato correttamente) e annullamento (torna correttamente allo stato normale). Nessun errore console attribuibile al codice (solo `ERR_CONNECTION_REFUSED`/WebSocket per il backend Supabase locale assente in questo ambiente). `tsc --noEmit`: **zero nuovi errori**, anzi **2 errori preesistenti risolti come effetto collaterale della riscrittura** (`HomeScreen.tsx(32,...)` `errorMsg`/`setErrorMsg` inesistenti su `GameState`, e `HomeScreen.tsx(228,...)` confronto `'searching'` impossibile in quel branch). `npm test` 208/208 e `npm run build` verdi.
  - **Bug reale corretto** (non solo styling): il banner d'errore leggeva/scriveva `errorMsg`/`setErrorMsg` da `useGameStore()`, campi **mai esistiti** su `GameState` — il banner non si è mai mostrato finora, e `setErrorMsg(...)` nel path di errore di `handleCreateChallenge` avrebbe lanciato `TypeError: setErrorMsg is not a function` al primo errore reale di creazione sfida. Sostituito con uno stato locale (`localError`/`setLocalError`), scope corretto per un messaggio transiente di questa sola schermata.

### Correzione pixel-perfect (post-review utente)

Dopo una prima verifica visiva, un confronto riga-per-riga con il sorgente esatto di `home-scegli-sfida.html` (non solo col riepilogo testuale usato inizialmente) ha rivelato diversi scostamenti reali, poi corretti:

- [x] **Header**: avatar ora cerchio pieno (non più lo "squircle" `14/14/14/6` usato per errore, che nel mockup è riservato al Profilo, non alla Home), anello conic-gradient 50/50 con bordo ink 2px di separazione; pill monete ricolorata da volt a oro/`#FFD36E` su sfondo `rgba(242,193,78,.12)`, **sempre visibile per utenti loggati** (default a 0, non più nascosta se `coins` è `undefined`); **ripristinato il bottone notifiche** (cerchio 44px, bordo bianco 10%, bg turf-1, pallino ember) rimosso per errore nella prima versione — nessun sistema di notifiche reale lo alimenta ancora, il pallino è puramente visivo (vedi punti aperti).
- [x] **Hero**: "Istinto puro" corretto da due righe (`<br/>`) a una riga sola come nel mockup; dimensione 40px (non 56px) e sottotitolo 14px/max-width 300px (non 15px senza limite).
- [x] **Toggle modalità**: `SegmentedControl` ora usa `shape="rounded"` (20px/16px, non pill) con sfondo turf-1 (non ink) e le icone PvP/Vs IA (prima assenti); aggiunto l'hint testuale sotto il toggle, assente nella prima versione.
- [x] **Rail campionati**: intestazione corretta da "SELEZIONA CAMPIONATO" + icona globo centrata a "Campionato" (label, sinistra) + nome lega selezionata (destra), come nel mockup; card da chip centrate a card fisse 96×92 con layout bandiera-in-alto/nome-in-basso allineati a sinistra, bordo trasparente quando non selezionate (non più un bordo bianco 10% sempre visibile), badge di spunta volt quando selezionata (assente prima).
- [x] **Difficoltà**: vedi rework di `DifficultySelector` sopra (1.4) — da 3 a 4 barre, trattamento Hard persistente.
- [x] **CTA**: bottone icona "Sfida un amico" ingrandito da 48px a 60px con bordo e sfondo turf-1 (non più l'icon-button generico da 48px senza bordo); CTA principale da pill a rettangolo arrotondato 20px con l'animazione `.cta-glow` (ombra pulsante) aggiunta ad hoc — copy corretto da "Sfida l'IA" a "Gioca contro l'IA" per la modalità IA.
- [x] **Bottom nav**: sfondo corretto da turf-1/90 a turf-2/90; icone Classifica (`Medal`→`BarChart3`) e Profilo (`CircleUser`→`User`) sostituite con le più vicine al mockup (grafico a barre e sagoma persona, non medaglia/cerchio-persona).
- [x] **Nuove utility globali** aggiunte a `night-pitch.css` per supportare quanto sopra, riusabili altrove: `.press` (feedback pressione generico), `.rail` (scroll-snap orizzontale), `.flag`/`.flag svg` (sizing bandiere), `.pop` (badge di selezione), `.cta-glow` (ombra pulsante CTA primaria, distinta dal `.glow` esistente) — tutte coperte da `prefers-reduced-motion`.
- [x] **Verifica**: nuovo screenshot a viewport esatto del mockup (390×844, build di produzione via `vite preview` su porta 4173 per non collidere con lo stack Docker dell'utente in esecuzione sulla 3000) confermano la corrispondenza. `tsc`/`npm test`/`npm run build` invariati (puliti).

**Lezione di processo**: la prima stesura di Fase 3 si era basata sul riepilogo testuale prodotto da un agente di analisi (inevitabilmente lossy) invece di rileggere i file HTML sorgente del mockup riga per riga. Per le fasi successive, prima di implementare va sempre riletto il file mockup esatto della schermata in questione, non solo il riepilogo aggregato prodotto in fase di pianificazione.

---

## FASE 4 — Partita e Esito (`GameScreen.tsx`, `CircularTimer.tsx`) ✅

Riferimento: `partita-round-in-corso.html`, `esito-tempo-scaduto.html` (riletti integralmente riga-per-riga prima di implementare, lezione della Fase 3).

- [x] **4.1 Header doppio score-card**: "Tu" (volt, iniziale, tier colorato via `TIER_CONFIG`/CSS var tier-label) a sinistra, round indicator centrale `.disp` "N/3", avversario (ember, icona `Bot` se IA) a destra. **Typing-dots omessi**: nessun segnale reale "l'avversario sta scrivendo" esiste nello store (né per IA né per PvP) — mostrarli sempre animati sarebbe un'animazione finta, stessa logica già applicata a `is_online` nei punti aperti.
- [x] **4.2 `RoundProgressBar`**: barra segmentata **a 3 celle, non 5**. Il mockup usa "5" come valore d'esempio generico, ma il formato reale della partita (vedi `gameplaySlice.ts`/`matchmakingSlice.ts`) è "al meglio dei 3" — vince chi arriva prima a 2 round vinti (`newPlayerRoundsWon >= 2` / `newOpponentRoundsWon >= 2`). Seguire il mockup alla lettera qui sarebbe stato **sbagliato**, non solo infedele: usata una costante `TOTAL_ROUNDS = 3` con commento esplicito nel codice.
- [x] **4.3 Timer**: `CircularTimer` aggiornato — raggio 44 (non 42), cerchio di sfondo pieno ink con bordo turf-2 (non turf-3 trasparente), keyframe `.hot` corretto per combaciare esattamente col mockup (`throb`: ease-out, scale 1→1.1 al 30%→1 al 100%, sostituendo un'approssimazione `steps(2)` scritta prima di rileggere questo file).
- [x] **4.4 Intro "VS"**: entrata da lati opposti con rotazione + "VS" che slamma al centro (`motion`/framer, timing esatto da mockup: 550ms `cubic-bezier(.16,1,.3,1)` per i loghi, 450ms `cubic-bezier(.34,1.56,.64,1)` con 400ms di delay per lo slam). **Mantenuti i loghi reali** (`match.team1_logo`/`team2_logo`) invece dei gonfaloni/pennant generici del mockup: l'app ha già i loghi veri via API-Football, sostituirli con placeholder generici sarebbe stato un peggioramento, non un restyle — coerente con la nota già scritta per `TeamCrest` (1.16, "fallback, non sostituisce i loghi reali").
- [x] **4.5 Chip risposta errata**: implementato con stato locale (`wrongAttempts`, azzerato ad ogni cambio `round` via `useEffect`) — puramente di presentazione, non persistito, nessuna estensione allo store necessaria. Mostra **tutti** i tentativi sbagliati del round corrente (non solo l'ultimo), coerente col contenitore `flex-wrap` del mockup pensato per più chip.
- [x] **4.6 Input risposta**: `Field` variant `answer` (64px, radius-lg) + bottone invio integrato (freccia volt).
- [x] **4.7 Footer**: meta `.mono` lega (via `LEAGUE_NAMES` condiviso con Home, non un campo `match.league_name` che non esiste sul tipo `MatchData`) + difficoltà, bottone "Abbandona" ember testuale.
- [ ] **4.8 Micro-interazioni risposta corretta**: il blocco inline "Corretto! +N pt" è stato restylato (volt, check icon, mono) ma **non** ha ancora scintille/check disegnato (`stroke-dashoffset`) — demandato alla Fase 10 (loader/micro-interazioni), qui solo i colori/font sono stati aggiornati senza nuove animazioni bespoke.
- [x] **4.9 Schermata Esito di round** (`status==='lost'` e `'opponent_won'`, estratto in un componente condiviso `RoundOutcomeScreen`): banner ember skewato (`skewY(-8deg)`), titolo `.disp` con animazione slam esatta (`scale(1.6)→scale(.97)→scale(1)`, 600ms), card risposta corretta con le due squadre (**loghi reali**, non pennant generici — stessa scelta di 4.4) + stagioni in comune, card punteggio round Tu/avversario. Bottoni "Home" (icon-button circolare) + "Riprova" **solo per `gameMode==='ai'`** (in PvP un round perso non è mai l'ultima parola prima del `match_won`/`match_lost`, l'host avanza automaticamente dopo 3s — comportamento preesistente invariato, i due bottoni non devono comparire lì).
- [x] **Schermata Esito di match** (`status==='match_won'`/`'match_lost'`, nuovo, nessun mockup dedicato fornito): stessa grammatica visiva (banner skewato volt/ember, titolo slam, card punteggio) estrapolata in modo coerente per restare in stile — **non verificata dal vivo** (nessun mockup di riferimento esisteva e non è stato possibile raggiungere questo stato in una sessione di test breve), segnalato come rischio residuo.
- [x] **4.10** Nessuna modifica alla logica di transizione tra stati (`useGameStore`/`gameplaySlice.ts`/`matchmakingSlice.ts`) — solo markup/stili. Unica aggiunta reale: lo stato locale `wrongAttempts` (4.5), isolato al componente.
- [x] **4.11 Verifica**: giocata una partita Vs IA **reale** contro il backend Supabase locale (Docker, dati squadre importati) via Playwright headless — non solo screenshot statici: toggle Vs IA, avvio match, risposta sbagliata (chip ember confermata), timer che passa a "hot" a 3s (ring+cifra ember confermati), timeout naturale fino alla schermata "Tempo scaduto" (confermata pixel per pixel). Build/typecheck/208 test rimangono verdi.
  - **Finding, fuori scope** (non introdotto da questa fase, scoperto solo ora testando con dati reali per la prima volta): un nome giocatore risposta-corretta è apparso come `M&APOS;BALANZOLA` invece di `M'Balanzola` — le entità HTML non vengono decodificate da qualche parte a monte (probabilmente nell'import dati/API-Football). Il rendering qui è identico a quello originale (`{correctAnswer}` semplice), quindi è un bug di dati preesistente, non del restyle — da investigare separatamente.

---

## FASE 4B — Sistema Dialog e Avvisi (trasversale) ✅ componenti + primi 2 agganci reali

Riferimento: `Dialogs.dc.html` (mockup "Night Pitch — Dialog e avvisi", fornito dall'utente dopo la Fase 4 — letto integralmente riga per riga prima di scrivere questo piano, stessa disciplina adottata dopo la correzione di Fase 3). A differenza delle fasi precedenti, questo non è il restyle di una schermata ma un **sistema di componenti condivisi trasversale a tutta l'app**: 3 livelli di interruzione (Alert, Bottom Sheet, Toast) con regole precise di quando usare quale, che vanno poi innestati nei punti giusti di schermate sia già restylate (Fase 4) sia non ancora toccate (Fasi 5-9).

### Regole di sistema (da rispettare in ogni componente/integrazione)

- **Alert** (modale centrato): per decisioni non annullabili. Max 1 titolo + 2 righe di testo. Bottoni impilati a tutta larghezza, **l'azione sicura sempre in alto**. Entrata `scale(.86)→scale(1)` con bounce, 420ms (`alert-in`).
- **Bottom Sheet**: dal basso, maniglia visibile, swipe giù per chiudere. Glide 500ms (`sheet-in`). Per scelte con contesto (avatar, campionato, scadenza).
- **Toast**: in alto sotto la safe area (**mai sopra il timer durante la partita**), 3 secondi, uno alla volta, azione opzionale a destra.
- **Sfondo/overlay**: nero 55–66% + blur 4px, fade 250ms (`.dim`).
- **Colore**: **volt solo per successo e per l'azione che fa giocare**; **ember solo per l'irreversibile**; tutto il resto in chalk/neutro — regola che vincola anche scelte già fatte nelle fasi precedenti (es. verificare in Fase 6/7 che nessun bottone "distruttivo minore" sia finito in volt per errore).
- **Accessibilità**: `role="alertdialog"` (Alert) / `role="dialog"` (Sheet), focus sul primo bottone all'apertura, **Esc e tap-fuori = annulla, eccetto l'errore di rete** (quello non si chiude da solo, l'utente deve scegliere esplicitamente "Riprova" o "Esci").

### Componenti costruiti in `src/components/ui/`

- [x] **4B.1 `AlertDialog.tsx`** — modale centrato, portal + overlay `.dim` (fade 250ms), card `rounded-[28px]` (valore esatto del mockup, non riconducibile alla scala radius esistente) con entrata scale(.86)→1 bounce 420ms via `motion`/framer (non CSS keyframe, coerente con `BottomSheet`). Props: `icon` libero (composizione a carico del chiamante, vedi `AlertIconBadge` sotto), `title` **opzionale** (omesso nei casi con intestazione custom come `SuccessAlert`), `description`, `children` libero, `actions` **opzionale**. `dismissible={false}` disattiva Esc/tap-overlay. `glow` per bordo+alone volt (caso successo).
- [x] **4B.1b `AlertIconBadge.tsx`** (non previsto nel piano originale, aggiunto perché il badge 56×56 si ripete identico in 4 alert su 6): tono `ember` (quadrato radius-18, `wobble` opzionale) e `gold` (cerchio gradiente, flip 3D `.coin` sempre attivo). Il tono "volt/successo" ipotizzato qui **non serve come badge**: nel mockup il successo non ha icona in badge, ha l'intera card con bordo/alone volt (gestito da `AlertDialog`'s prop `glow`).
- [x] **4B.2 Varianti `Button.tsx`**: aggiunte `chalk` (bg `#F3F5EE`/ink, per "Riprova ora"/"Ho capito"), `text-ember` (trasparente, solo testo ember-light, per "Abbandona"), `text-neutral` (trasparente, testo chalk-2, per "Annulla"/"Esci dalla partita"). La variante `destructive` esistente (bg ember/14) non è stata toccata ed è quella giusta per "Rimuovi amico" nello sheet di conferma.
- [x] **4B.3 `SuccessAlert.tsx`** — bordo+alone volt (`AlertDialog glow`), eyebrow `.cond` volt, due avatar `slide-l`/`slide-r` (500ms+150ms delay) con "VS" `slam` al centro, countdown numerico con stato interno reale (`useEffect`+`setInterval`, richiama `onComplete` a 0, non solo decorativo), barra `.bar-deplete` 3s **non infinita** (il componente si chiude davvero a fine countdown, un loop CSS successivo non si vedrebbe comunque mai). Verificato: lo slam qui e quello dell'intro round di Fase 4 sono due istanze indipendenti (una classe CSS globale riusata, l'altra inline via `motion` in `GameScreen.tsx`), nessun conflitto di timing reale.
- [x] **4B.4 `ErrorAlert.tsx`** — icona wifi-off statica (nessun wobble), spinner (`Loader2`+`animate-spin` Tailwind, non serve un `.spin` CSS dedicato), puntini `.dot1/.dot2/.dot3` (rinominati da `.d1/.d2/.d3` per evitare nomi troppo corti), meta configurabile via prop (non hardcoded, per riuso fuori da un contesto di partita), bottoni `chalk`+`text-neutral`. `dismissible` fisso a `false` (non esposto come prop).
- [x] **4B.5 `CountdownSheet.tsx`** + **`ConfirmSheet.tsx`** (due componenti dedicati, non varianti generiche di `BottomSheet`): `CountdownSheet` ha un countdown reale interno (anello SVG volt→ember sotto i 3s, **scadenza = rifiuto automatico**, non solo visivo) + anello pulsante decorativo indipendente (`.pulse-ring`); `ConfirmSheet` è lo shell header+bottoni per conferme minori. Entrambi riusano `BottomSheet` (1.13) invariato come shell.
- [x] **4B.6 `Toast.tsx` riscritto** — 4 toni (`success/error/info/warning`) con bg+bordo+colore-testo distinti per tono (non solo icona colorata, come assumeva la versione di Fase 1), icona di default per tono con override via prop. **Corretta anche la direzione dell'animazione**: `np-toast-in` entrava dal basso (retaggio di `componenti.html`, che non specificava la posizione) — ora entra dall'alto, coerente con "il toast vive in alto".

### Mappa di integrazione — stato reale

- [x] **4B.7 `App.tsx`**: toast globale e achievement-toast unificati in un unico contenitore `fixed top-6` con `flex-col gap-3` (invece di due posizioni fisse scoordinate top/bottom), così si impilano senza sovrapporsi se entrambi visibili. Il toast achievement (multi-riga, 2 azioni) **non usa il primitivo `Toast`** — resta una card dedicata (quella forma non rientra nel primitivo pensato per 1 riga + 1 azione), ma ora con i token del design system (tono oro) al posto del gradiente giallo/ambra originale. Il toast "sfida da amico" con Accetta/Rifiuta (2 azioni) resta anch'esso una pill dedicata per lo stesso motivo, ora con `Button` volt/ghost al posto dei bottoni verdi/grigi originali. Il toast generico a singola azione usa davvero il nuovo `Toast` component.
- [x] **4B.8 `GameScreen.tsx`**: modale "Abbandonare?" migrata ad `AlertDialog`+`AlertIconBadge` (wobble). **Confermato e corretto** il problema segnalato nel piano: "Sì, abbandona" usava `variant="destructive"` con bg ember pieno forzato via className — sostituito con `variant="text-ember"` (testo semplice, nessun bg), "Resta in partita" spostato in cima come azione sicura in volt. **Verificato visivamente** in partita reale (Vs IA, Docker): corrisponde al mockup.
- [ ] **4B.9 `ErrorAlert` non ancora agganciato**: confermato che non esiste nello store alcun rilevamento reale di disconnessione realtime — resta un componente pronto ma non collegato. Punto aperto: costruire il rilevamento è una funzionalità nuova, da decidere con l'utente, non implicita nel restyle.
- [ ] **4B.10 `SuccessAlert` non ancora agganciato**: non collegato alla transizione reale di matchmaking. `status:'joining'`/`'starting'` in `matchmakingSlice.ts` esistono già, ma usarli richiede capire esattamente quando l'avversario è "noto" (nickname/tier disponibili) prima che la partita parta — rimandato, punto aperto.
- [ ] **4B.11 Rimuovi amico (`ConfirmSheet`)**: non ancora agganciato, `ProfileFriendsTab.tsx` non esiste ancora (Fase 6 non raggiunta). Il componente è pronto.
- [ ] **4B.12 Saldo insufficiente**: non ancora agganciato, `ProfileShopTab.tsx` non esiste ancora (Fase 6). Nessun componente "InfoAlert" dedicato costruito: si compone direttamente `AlertDialog`+`AlertIconBadge tone="gold"` al call site, pattern già sufficiente (come per l'alert distruttivo).
- [ ] **4B.13 `CountdownSheet` per sfida ricevuta**: non ancora agganciato al polling reale (`pollFriendChallenges` in `App.tsx` continua a usare il toast a 2 azioni per ora). Resta un punto aperto se sostituire o affiancare.
- [ ] **4B.14 Toast applicativi puntuali** ("Nickname già in uso", "ha accettato la richiesta", "il torneo inizia tra N minuti"): da collegare quando si raggiungono le rispettive fasi (6/7/9) — il componente `Toast` li supporta già tutti (toni `error`/`info`/`warning`).
- [x] **4B.15 Verifica**: `AlertDialog` testato dal vivo (screenshot, partita reale Vs IA su Docker) — corrisponde al mockup. Non verificato esaustivamente con screen reader/focus-trap reale (solo gestione Esc via `useEffect`, nessun trap esplicito del focus — **lacuna nota**, da indirizzare in Fase 12 QA/accessibilità). `tsc`/`npm test` (208/208)/`npm run build` puliti dopo tutte le modifiche.

---

## FASE 5 — Classifica (`LeaderboardScreen.tsx`) ✅

Riferimento: `classifica.html` (riletto integralmente prima di implementare).

- [x] **5.1 Header**: H1 `.disp` 34px "Classifica" + bottone refresh 44px circolare. **Comportamento migliorato rispetto al mockup**: lì l'icona ruota solo su hover/press come micro-interazione decorativa indipendente dal caricamento reale; qui ruota **mentre il fetch è davvero in corso** (`loading` state) — più corretto funzionalmente (feedback reale, non solo decorativo), scelta deliberata non un'infedeltà.
- [x] **5.2 Filtri**: i 5 chip passano al componente `Chip` (1.2), **corretto in corso d'opera**: l'altezza reale di questo screen è 40px (non i 36px della scheda componenti generica) e il tono `ember` resta leggermente tinto (bordo+testo) anche da **non selezionato** per "Hard" — pattern persistente di avviso non previsto nella prima versione di `Chip.tsx`, aggiunto ora (stesso trattamento già usato in `DifficultySelector`).
- [x] **5.3 Podio Top 3**: nuovo componente locale `PodiumColumn` (3 colonne, grid `1fr 1.1fr 1fr`), barre che crescono con stagger esatto del mockup (oro parte per primo nonostante sia la colonna centrale, poi argento, poi bronzo — `.podium-gold/-silver/-bronze`, nuovi keyframe dedicati in `night-pitch.css`), corona che cade sopra il 1° (`.crown`, riusa `np-drop` con delay dedicato 0.9s). **Nota di design scoperta rileggendo il mockup**: l'anello colorato (oro/argento/bronzo) codifica la **posizione sul podio**, non il tier di gioco del giocatore — e l'avatar ha sfondo **volt** anziché neutro **solo se quell'entry è l'utente corrente** (confrontato `entry.userId === user?.id`), indipendentemente dalla posizione: dettaglio presente nei dati d'esempio del mockup (il 2° posto lì è "Luigi", l'utente, ed è l'unico con sfondo volt) che sarebbe stato facile interpretare erroneamente come "il 1° posto è sempre volt".
- [x] **5.4 Lista righe 4+**: righe semplici (rank mono, iniziali, nome+conteggio partite, punteggio) con animazione d'ingresso `translateX` sfalsata (nuovo keyframe `.row-in`, non esisteva ancora). **Rimossi `TierBadge` e win-rate dalle righe**: il mockup non li mostra affatto (né nel podio né in lista) — scelta di design deliberata verso un impaginato più essenziale, seguita invece di preservare informazioni non richieste dal riferimento.
- [x] **5.5 Banner posizione utente**: spostato da banner nell'header a banner `fixed` sopra la bottom nav (bordo/glow volt tramite `box-shadow` a doppio livello, non `border`, per lo spessore 1.5px esatto del mockup). Il "N pt dal primo" **non era calcolabile con i dati già in stato** (il vecchio codice teneva solo il rank numerico, non lo scarto in punti) — aggiunto usando `profile.total_score` (già disponibile via `useAuthStore`, nessuna nuova chiamata API) contro il punteggio del leader (`entries[0]`), con caso speciale "Sei primo in classifica" quando il rank è 1.
- [x] **5.6 Verifica**: giocata/osservata dal vivo su Docker con dati reali — podio completo, filtro Hard con stato vuoto (`EmptyState`), fallback nome applicato. **Trovato e corretto un problema di robustezza** (non un bug introdotto da me, dato di seed): alcune entry hanno `displayName` vuoto, il che senza fallback rende iniziali e nome invisibili lasciando solo il punteggio — aggiunta `displayNameOf()` con fallback `'Giocatore'`. `tsc`/`npm test` (208/208)/`npm run build` puliti.
  - **Non testato dal vivo**: meno di 3 utenti in classifica (il podio in quel caso viene saltato interamente e si mostra solo la lista, per scelta esplicita in codice — comportamento ragionevole ma non verificato visivamente), e utente con rank oltre il 100 (banner nascosto).

---

## FASE 6 — Profilo (`ProfileScreen.tsx` + `src/components/profile/*`)

Riferimento: `profilo.html`, `modifica-profilo.html`, `achievement.html`, `shop.html`.

- [ ] **6.1 Header profilo**: avatar 76px radius `24/24/24/6` + ring conic-gradient squadra del cuore, nome `.disp`, `TierBadge` pill, badge "Tifoso {squadra}" (solo se squadra impostata), pill monete, bottone "Modifica" (matita) — sostituisce l'header statico attuale di `ProfileScreen.tsx`.
- [ ] **6.2 Tab bar**: `SegmentedControl` con indicator scivolante per le tab esistenti (Info/Stats/Achievements/History/Friends/Shop — **mantenere tutte e 6**, il mockup ne mostra 4 solo perché fonde Info nell'header, ma la struttura dati attuale più granulare va preservata, non ridotta).
- [ ] **6.3 `ProfileInfoTab.tsx`**:
  - [ ] Rimuovere il form inline di modifica (`isEditing` toggle) e sostituirlo con `BottomSheet` (1.13) "Modifica profilo".
  - [ ] Dentro lo sheet: campo avatar con bottone upload overlay; nickname con check "Disponibile" live (richiede query di disponibilità — verificare se esiste già un endpoint/RPC per check nickname univoco, altrimenti valutare se implementarlo o se mostrare il check solo dopo submit, **da decidere con l'utente** prima di introdurre nuove chiamate API); Nome/Cognome 2 colonne; "Squadra del cuore" come bottone che apre selezione con `TeamCrest` anteprima (sostituisce l'attuale `<input type="text">` libero — **verificare prima** se esiste già una lista chiusa di squadre selezionabile lato dati, o se il campo è intenzionalmente libero/testuale: cambiare da free-text a selezione strutturata è una modifica di comportamento, non solo styling, da confermare).
  - [ ] Sezione account (Cambia password / Esci) come lista con divider dentro lo sheet, riusando la logica già presente nel pannello password espandibile.
  - [ ] CTA "Salva modifiche" sticky in fondo allo sheet.
- [ ] **6.4 `ProfileStatsTab.tsx`**: sostituire le card quadrate attuali con `BentoStatCard` (1.8): hero win-rate ad anello, Partite, Serie con fiamma, barra tier con `StripedProgressBar` (1.7), 3 mini-stat (Media pt/Best/Abbandonate).
- [ ] **6.5 `ProfileAchievementsTab.tsx`**:
  - [ ] Card riepilogo con anello progresso SVG "N/26" + messaggio motivazionale dinamico (nome prossimo achievement + requisito mancante — il dato per calcolarlo esiste già nelle definizioni achievement, verificare in `types/game.ts`/`ACHIEVEMENT_LABELS`).
  - [ ] Filtri a categoria orizzontali scrollabili (chip, riusando `CATEGORY_ORDER` già presente).
  - [ ] Sostituire badge cerchio Lucide-icon con `AchievementBadge` (1.10) a forma per tier.
  - [ ] `BottomSheet` di dettaglio al tap: badge grande animato (scale+rotate bounce se appena sbloccato), tier+stato, nome `.disp`, descrizione, bottone Chiudi.
- [ ] **6.6 `ProfileHistoryTab.tsx`**: sostituire righe attuali con `ListRow` variante storico (iniziale V/A colorata) — mantenere filtri/paginazione esistenti (il codice attuale è già più ricco del mockup su questo fronte, non ridurlo).
- [ ] **6.7 `ProfileFriendsTab.tsx`** (+ `ChallengeFriendModal.tsx`):
  - [ ] Tab bar interna 4 sotto-tab (Cerca/Amici/Richieste/Sfide) → `SegmentedControl` con badge numerico integrato nell'indicator.
  - [ ] `EmptyState` (1.11) per: ricerca vuota ("Trova i tuoi rivali"), nessuna richiesta, nessuna sfida in attesa ("Lancia tu la prossima").
  - [ ] `ListRow` variante amico (dot online + bottone Sfida con icona fulmine che ruota on-hover).
  - [ ] **Nota prodotto** (non solo styling): `is_online` risulta sempre `false` lato dati — decidere con l'utente se mostrare comunque il dot "online" in modo fuorviante (da evitare) o nascondere l'indicatore finché non esiste vera presence, oppure implementare una presence reale (fuori scope restyle, da proporre come task separato).
- [ ] **6.8 `ProfileShopTab.tsx`**:
  - [ ] Header con saldo monete (icona moneta rotante 3D, rispetta reduced-motion).
  - [ ] Card "Anteprima" live (avatar con ring tema / nome con badge) prima dell'acquisto.
  - [ ] Sostituire icone emoji dirette (`item.icon`) con set SVG dedicato dentro riquadro 44px arrotondato.
  - [ ] Bottone "Saldo insufficiente" disabled con icona lucchetto (1.1 variante disabled).
- [ ] **6.9 Verifica**: percorrere tutte le 6 tab con dati reali (profilo con e senza squadra del cuore impostata, 0 achievement sbloccati, >0 amici, 0 amici, saldo 0 nello shop).

---

## FASE 7 — Tornei (`TournamentsScreen.tsx` + `src/components/tournament/*`)

Riferimento: `tornei.html`, `crea-torneo.html`. Nessuna feature mancante lato logica — solo restyle.

- [ ] **7.1 Header**: H1 `.disp` + `SegmentedControl` Aperti/Storico.
- [ ] **7.2 CTA "Crea torneo"**: sostituire bottone pill semplice con card hero volt (radius hero) + illustrazione SVG bracket "disegnata" (stroke-dasharray draw-in) + bottone "+" circolare.
- [ ] **7.3 Card torneo** (`TournamentListView`): badge stato con dot pulsante (Aperto) o countdown mono con icona orologio (scheduled); 3 chip meta (lega/difficoltà/modalità avvio); avatar-slot tratteggiati per i posti liberi (sostituisce il testo "N/max" + icona Users); bottone "Iscriviti" pill bianca piena.
- [ ] **7.4 Form Crea torneo** (`TournamentCreateForm`):
  - [ ] Input nome pill.
  - [ ] Selettore giocatori 2/4/8/16 con slot-pop-in animati + testo dinamico "N turni a eliminazione diretta" (piccolo value-add di presentazione, dato calcolabile da `log2(size)`, nessuna nuova chiamata API).
  - [ ] Selezione campionato come bottone con `LeagueFlag` mini.
  - [ ] Toggle "Al riempimento"/"Data e ora" con reveal animato (Glide) del date-picker.
  - [ ] `DifficultySelector` (1.4) al posto dei radio semplici.
  - [ ] CTA finale pill con icona trofeo.
- [ ] **7.5 `TournamentDetailView`/`TournamentBracketView`**: restyle colonne bracket con palette volt/ember/pennant (mantenendo evidenziazione match utente e vincitore già presenti), sostituire emoji `TierIcon` con `TierBadge` (1.6) compatto.
- [ ] **7.6 `TournamentHistoryView`**: allineare a `ListRow`.
- [ ] **7.7 Verifica**: creare un torneo 4 giocatori "al riempimento", uno 8 giocatori schedulato, verificare bracket dopo completamento match, cancellazione torneo da creatore.

---

## FASE 8 — Sfida (`ChallengeScreen.tsx` + `src/components/challenge/ChallengeViews.tsx`)

Riferimento più vicino: `amici-sfide.html` (tab Sfide) + pattern matchmaking di `home-ricerca-avversario.html`. Nessun mockup 1:1 per la pagina pubblica `/sfida/:token` — da derivare per analogia, non inventare elementi fuori dal design system.

- [ ] **8.1** Reskin delle 6 viste (`Loading`, `Error`, `Expired`, `CreatorPending`, `CreatorAccepted`, `VisitorAccept`) da palette viola/giallo a Volt/Ember.
- [ ] **8.2** `CreatorPendingView`: sostituire icona Clock pulsante con loader "Radar" (coerenza con stato di attesa matchmaking).
- [ ] **8.3** `EmptyState`/pattern "pill mono countdown" per la scadenza del link di sfida.
- [ ] **8.4 Verifica**: generare un link sfida, aprirlo in incognito come visitatore, testare scadenza link e abbandono.

---

## FASE 9 — Auth (`AuthScreen.tsx`)

**Nessun mockup fornito per questa schermata.** Non improvvisare uno stile "simile" senza validazione: proporre un primo draft coerente con i token di Fase 0 (card scura centrata, campi `Field`, bottone `.btn-volt`) e sottoporlo a revisione prima di procedere oltre il draft. Trattare come ultima priorità di restyle visto che non è coperta dal design fornito.

- [ ] **9.1** Draft schermata login/registrazione con i componenti di Fase 1.
- [ ] **9.2** Revisione/approvazione draft con l'utente.
- [ ] **9.3** Implementazione definitiva solo dopo approvazione.

---

## FASE 10 — Loader e micro-interazioni a tema

Riferimento: `loader-microinterazioni.html`. Da implementare come componenti in `src/components/ui/loaders/`, poi collegare nei punti d'uso già elencati nelle fasi precedenti (non creare nuovi punti di loading non richiesti).

- [ ] **10.1 Palleggio** — pallone che rimbalza + ombra. Uso: loading generico breve (sostituisce `Loader2`/`animate-spin` sparsi).
- [ ] **10.2 Radar** — sweep conico + ping + blip. Uso: Home ricerca avversario (3.7), Challenge pending (8.2).
- [ ] **10.3 Tabellone** (flap-display `steps(10)`) — uso: calcolo punteggio a fine round (nuovo punto, verificare dove inserirlo in `GameScreen.tsx` senza alterare i tempi effettivi di calcolo).
- [ ] **10.4 Rigore** — pallino verso la rete + "Gol" pop-in. Uso: invio risposta corretta (4.8) o avvio partita.
- [ ] **10.5 Fischio d'inizio** — countdown circolare 3-2-1, ring che si scarica, colore volt→ember. Uso: nuovo pre-round countdown in `GameScreen.tsx` (feature assente oggi — **verificare con l'utente se introdurlo** dato che allunga leggermente il flusso partita, non è puro restyle).
- [ ] **10.6 Skeleton prato** — righe "tosate" animate diagonali. Uso: stati di caricamento liste (Classifica, Storico, Amici, Tornei) al posto di spinner generici o contenuto vuoto improvviso.
- [ ] **10.7** Tutti i loader rispettano `prefers-reduced-motion` (fallback pallone statico con pulsazione opacità, come da fondamenta).
- [ ] **10.8 Verifica**: ogni loader testato nel suo punto d'uso reale con throttling di rete (devtools) per vedere durata/leggibilità.

---

## FASE 11 — Asset SVG: bandiere, gagliardetti, badge

- [ ] **11.1 `LeagueFlag` asset**: produrre le 5 bandiere campionato (Serie A/Premier/La Liga/Bundesliga/Ligue 1) nei 4 formati richiesti da 1.17, come componenti SVG React (non immagini raster) per poter animare/colorare via CSS.
- [ ] **11.2 `TeamCrest` asset**: mapping colore-squadra generico per le squadre presenti nel pool domande (coerente col commento nel mockup: "colori sociali e sigla, nessuno stemma ufficiale" — **non usare stemmi ufficiali reali per evitare questioni di diritti**, è una scelta deliberata del design system, mantenerla). Includere badge "Neo" per neopromosse e nota "+N in archivio" per squadre storiche, se applicabile al pool dati attuale.
- [ ] **11.3 `AchievementBadge` shapes**: 4 forme confermate (esagono/scudo/sigillo/ottagono) + 5ª forma da definire per Diamond (vedi nota in 1.6) — validare con l'utente prima di produrre l'asset definitivo.
- [ ] **11.4 Verifica**: tutti gli asset scalano correttamente alle dimensioni standard (84/64/40/20px per badge; wave/tile/cerchio/chip per bandiere) senza perdita di leggibilità.

---

## FASE 12 — QA, accessibilità, performance

- [ ] **12.1 Contrasto colori**: verificare WCAG AA per testo chalk-2 (`#A9AFA2`) su turf-1 (`#141613`) e per ember su ink, specialmente nei badge/chip con sfondo tinta trasparente.
- [ ] **12.2 `prefers-reduced-motion`**: test con l'impostazione attivata su tutte le schermate toccate.
- [ ] **12.3 Dimensione font/touch target**: bottoni minimo 44×44 (mobile-first, confermato dal mockup stesso "tocca, tieni premuto").
- [ ] **12.4 Performance font**: verificare peso totale dei woff2 caricati (Archivo variable + Geist + Geist Mono) e impatto su LCP/CLS; considerare subset se necessario.
- [ ] **12.5 Regressioni funzionali**: eseguire l'intera suite esistente (`npm test`) dopo ogni fase — il restyle non deve rompere `src/test/*.test.ts` (achievements, authStore, challenges, circuit-breaker, friend-challenges, game-utils, hard-mode, leaderboard, match-history, profile, round-stats, security, shop, tournaments, utils).
- [ ] **12.6 Lint/typecheck**: `npm run lint` (tsc --noEmit) pulito dopo ogni fase.
- [ ] **12.7 Test manuale end-to-end** su build di produzione (`npm run build && npm run preview`) prima di considerare il restyle completo, su almeno due viewport (mobile 375px, desktop ≥1280px).
- [ ] **12.8 Code review finale**: nessun colore/font hardcodato fuori dai token di Fase 0 (grep per hex Tailwind legacy residui tipo `#FFD700`, `purple-`, `zinc-` nei file toccati).

---

## Ordine di esecuzione consigliato

1. Fase 0 (fondamenta) → blocca tutto il resto.
2. Fase 1 (componenti) → blocca le fasi schermata.
3. Fase 2 (nav globale) in parallelo con l'inizio Fase 3.
4. Fasi 3–8 (schermate) in ordine di impatto utente: Home → Partita/Esito → Classifica → Profilo → Tornei → Sfida.
5. Fase 9 (Auth) per ultima, dopo validazione draft.
6. Fase 10–11 (loader/asset) possono procedere in parallelo alle fasi 3–8 man mano che i punti d'uso vengono raggiunti.
7. Fase 12 continua, non solo a fine progetto: eseguire i controlli 12.5/12.6 dopo **ogni** fase, non solo alla fine.

## Punti aperti da chiarire con l'utente prima/durante l'implementazione

- ~~Font self-hosted vs Google Fonts CDN~~ — **risolto**: Google Fonts CDN (0.1).
- Bottone notifiche in Home: presente visivamente (pixel-perfect col mockup) ma il pallino "non lette" è statico, non collegato a un sistema di notifiche reale — con cosa va collegato quando/se verrà costruito? (3.1)
- Check nickname disponibile live: serve nuovo endpoint o si rimanda? (6.3)
- "Squadra del cuore" da free-text a selezione strutturata: è un cambio di comportamento voluto? (6.3) — nota: l'anello avatar in Home (3.1) oggi usa un gradiente volt→ember fisso, non legato alla squadra, proprio perché questo punto non è ancora deciso.
- `is_online` sempre `false`: nascondere il dot o pianificare vera presence? (6.7)
- Countdown mono + card "N tornei aperti" nello stato di ricerca Home: rimandati (3.7), serve rispettivamente un dato di tempo-trascorso non tracciato e una query aperta da verificare.
- Pre-round countdown "fischio d'inizio": nuova feature o solo se richiesto esplicitamente? (10.5)
- Forma badge Diamond e stile definitivo Auth screen: nessun riferimento nel mockup, serve validazione prima di produrre asset finali (11.3, Fase 9).
- `ErrorAlert` "Connessione persa" presuppone un rilevamento reale di disconnessione realtime oggi assente nello store: lo costruiamo (nuova funzionalità, non solo styling) o resta un preset visivo non agganciato per ora? (4B.9)
- `SuccessAlert` "Avversario trovato" presuppone uno stato intermedio "match trovato, non ancora iniziato" — `status:'joining'`/`'starting'` bastano o serve un nuovo stato dedicato? (4B.10)
- Notifica "sfida ricevuta": tenere sia il toast generico (oggi in `App.tsx`) sia il nuovo sheet con countdown per contesti diversi, o sostituire uno con l'altro? (4B.13)
- Conferma rimozione amico: verificare cosa usa oggi `ProfileFriendsTab.tsx` (se esiste già, probabilmente un `window.confirm` o nulla) prima di sovrascriverlo con lo sheet nuovo (4B.11).
