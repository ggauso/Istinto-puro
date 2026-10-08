---
ledger_version: 1

session:
  id: null
  title: "Restyle design system \"Night Pitch\" — Istinto Puro (Fasi 0–6)"
  slug: "restyle-night-pitch-istinto-puro-fasi-0-6"
  project: "Istinto Puro"
  started_at: "2026-10-06"
  closed_at: "2026-10-07"
  status: completed

prompt_ids: []
sub_prompt_ids: []

artifacts:
  executor_prompts: []
  other_files:
    - sequence: 1
      filename: "restyle.md"
      source_link: null
      purpose: "Piano d'azione del restyle (12 fasi, task/subtask dettagliati), scritto all'inizio della sessione e aggiornato incrementalmente a fine di ogni fase completata."

git:
  repository: null
  branch: "feature/restyle"
  start_commit: "1a38ee4"
  end_commit: "1a38ee4"
  commits: []
---

# Restyle design system "Night Pitch" — Istinto Puro (Fasi 0–6)

## Sintesi per il ledger

Questa sessione ha avviato e portato avanti il restyle completo dell'app calcistica "Istinto Puro" secondo un nuovo design system scuro ("Night Pitch"), partendo da un mockup visivo fornito dall'utente con 23 schermate di riferimento. Il lavoro è iniziato con la scrittura di un piano dettagliato (`restyle.md`, 12 fasi), poi si è passati all'implementazione vera e propria.

Sono state completate le fondamenta tecniche (colori, font, spaziature, animazioni), un'intera libreria di circa 20 componenti grafici condivisi, la barra di navigazione inferiore, e il restyle di quattro aree applicative principali: la Home, la schermata di gioco con gli esiti di round/partita, la Classifica, e l'intera sezione Profilo (la più estesa, con statistiche, trofei, storico, amici e negozio). È stato inoltre introdotto un sistema coerente di finestre di dialogo e avvisi (conferme, errori, notifiche), basato su un secondo mockup caricato a metà sessione.

Un principio di lavoro emerso e poi applicato sistematicamente: ogni schermata è stata implementata rileggendo il file di disegno originale riga per riga, non basandosi su riassunti di seconda mano, perché un primo tentativo sulla Home aveva prodotto scostamenti reali dal disegno corretti solo dopo la segnalazione dell'utente. Questo ha permesso di scoprire alcune cose utili lungo il percorso: la sezione Profilo dell'app, ad esempio, doveva avere 4 schede e non 6 come inizialmente previsto, con "Modifica profilo" e "Negozio" trattati come schermate a parte. Dove il disegno proponeva numeri di esempio in conflitto con le regole reali del gioco (come il numero di round di una partita), è stato seguito il comportamento reale dell'app invece del mockup. Non sono mai stati inventati dati finti per riempire spazi vuoti del disegno quando il sistema non li forniva davvero.

Durante il lavoro sono stati trovati e corretti alcuni problemi preesistenti non legati allo stile: un badge del livello giocatore che mostrava sempre "Bronze" per errore, un bottone che violava la regola di colore del nuovo design, e un nome giocatore mostrato in modo corrotto nei dati reali (quest'ultimo segnalato ma non corretto, perché riguarda l'importazione dati e non la grafica). È stato risolto anche un problema tecnico separato: l'ambiente Docker locale non si avviava a causa di un blocco del servizio Colima, sistemato con un riavvio mirato.

Ogni fase è stata verificata con controlli automatici (compilazione, controllo tipi, 208 test automatici, sempre tutti superati) e, per la maggior parte delle schermate, anche con una verifica dal vivo nel browser contro il backend reale in locale, incluso un account di prova registrato appositamente. Restano da affrontare le fasi successive del piano (Tornei, Sfida, Autenticazione e la rifinitura finale) e alcune decisioni di prodotto esplicitamente rimandate, elencate più sotto.

## Obiettivo

Ridisegnare completamente l'interfaccia dell'app "Istinto Puro" (quiz calcistico 1vs1) secondo il nuovo design system scuro "Night Pitch", fornito dall'utente come mockup HTML statico, mantenendo intatta tutta la logica applicativa esistente (store, chiamate API, regole di gioco). Prima di implementare, l'utente ha chiesto di produrre un piano d'azione dettagliato, scomposto in task e sotto-task.

## Attività svolte

**Pianificazione.** Estratto e decompresso il bundle del mockup (23 schermate statiche), analizzato il design system (palette colori, tipografia Archivo/Geist/Geist Mono, scala spaziature/raggi, timing di animazione nominati), mappato ogni schermata del mockup sui componenti React esistenti con l'aiuto di un sotto-agente di analisi. Scritto `restyle.md`: piano in 12 fasi con task e sotto-task dettagliati, punti aperti segnalati esplicitamente invece di essere decisi autonomamente.

**Fase 0 — Fondamenta.** Font caricati via Google Fonts, token di design (colori, raggi, ombre, timing) e classi utility globali definiti in un nuovo foglio di stile dedicato.

**Fase 1 — Libreria componenti.** Costruiti circa 20 componenti condivisi (bottoni, chip, selettori, barre di progresso, badge tier/achievement, stati vuoti, toast, pannelli a comparsa dal basso, timer circolare, bandiere campionato, gonfaloni squadra generici, barra di navigazione inferiore, sei loader a tema calcistico). In questa fase è emerso che mancava una dipendenza di tipizzazione per React, installata; ciò ha fatto emergere alcuni errori di tipo preesistenti altrove nel codice, lasciati invariati perché fuori perimetro. Corretto anche un bug reale nel badge del livello giocatore, che a causa di una chiamata sbagliata mostrava sempre "Bronze" indipendentemente dal livello vero.

**Fase 2 — Navigazione.** Agganciata la barra di navigazione inferiore nella shell dell'app, verificata visivamente con screenshot automatici.

**Fase 3 — Home.** Prima stesura basata su un riassunto del mockup; l'utente ha segnalato scostamenti visivi reali. Rifatta rileggendo il file sorgente del mockup riga per riga: corretti forma avatar, colori di pillole/badge, selettore modalità, fila campionati con bandiere vettoriali esatte, selettore difficoltà, forma e animazione del pulsante principale, colori e icone della barra di navigazione. Risolto anche un bug reale: il banner d'errore leggeva uno stato che non esisteva più nello store.

**Fase 4 — Partita ed esito.** Timer circolare e schermata di gioco riscritti sul mockup esatto. Mantenuto il vero numero di round (3, non 5 come nell'esempio del mockup) perché corrisponde alla regola reale del gioco. Mantenuti i loghi reali delle squadre al posto dei gonfaloni generici del disegno. Verificato giocando una partita vera contro il backend locale, incluso lo stato di timer "in scadenza" e la schermata di tempo scaduto. Segnalato, senza correggerlo, un problema di codifica nei nomi giocatore importati dai dati reali.

**Supporto ambiente.** L'utente ha segnalato che `docker-compose up` falliva. Diagnosticato un blocco del socket Docker di Colima (il demone interno era attivo, mancava solo l'inoltro verso l'host) e risolto con un riavvio mirato di Colima, poi dello stack applicativo.

**Fase 4B — Dialoghi e avvisi.** Dopo un nuovo mockup caricato dall'utente, aggiornato prima il piano scritto, poi costruito un sistema coerente di finestre di conferma, avvisi di successo/errore ed estensione del toast a quattro toni. Migrata la conferma di abbandono partita al nuovo sistema, correggendo un bottone che violava la regola di colore del design (azione distruttiva mostrata con sfondo pieno anziché solo testo).

**Fase 5 — Classifica.** Costruito un podio grafico con animazione a cascata fedele al mockup, scoprendo che il colore dell'anello intorno all'avatar indica la posizione in classifica e non il livello del giocatore. Corretto un problema di robustezza con nomi utente vuoti nei dati di test.

**Fase 6 — Profilo.** La fase più estesa. Rileggendo tutti i mockup collegati è emerso che la sezione Profilo doveva avere 4 schede fisse (non 6) con un'intestazione sempre visibile, più due schermate separate per "Modifica profilo" e "Negozio" — una scoperta che ha corretto il piano iniziale. Riscritte tutte le schede (statistiche, trofei/achievement con forme e icone esatte per livello, storico, amici con le sue quattro sotto-schede) e le due nuove schermate. Verificato registrando un vero account di prova nel backend locale e navigando l'intera sezione.

## Decisioni rilevanti

- Ogni schermata va implementata rileggendo il file HTML del mockup corrispondente per intero, non un riassunto: la correzione della Home ne è la prova diretta e questo metodo è stato poi applicato a tutte le fasi successive.
- Quando il mockup propone valori di esempio in conflitto con regole reali dell'app (es. numero di round di una partita), prevale il comportamento reale, non il disegno.
- Dove l'app ha già dati reali migliori del segnaposto del mockup (es. loghi squadra veri invece di gonfaloni generici), si mantengono i dati reali.
- Font caricati da Google Fonts (non auto-ospitati), scelta esplicita dell'utente.
- La sezione Profilo ha 4 schede, non 6: "Modifica profilo" è un pannello a comparsa, "Negozio" è una schermata separata raggiunta toccando il saldo monete.
- Nessun dato finto per riempire funzionalità non ancora supportate dal backend reale (notifiche, presenza amici online, progresso achievement, rilevamento disconnessione): tutte lasciate esplicitamente come punti aperti invece di essere simulate.
- I bug reali scoperti nei file già in lavorazione sono stati corretti sul posto; un problema di dati non legato allo stile, scoperto solo testando con dati reali, è stato segnalato ma non corretto perché fuori perimetro.

## Risultato

Implementate e verificate con successo le Fasi 0, 1, 2, 3 (con correzione), 4, 4B (parziale, vedi aspetti aperti), 5 e 6 del piano in `restyle.md`.

Verifica automatica: compilazione (`npm run build`), controllo tipi (`tsc --noEmit`) e l'intera suite di 208 test automatici superati dopo ogni fase, senza nuove regressioni rispetto agli errori di tipo preesistenti già noti e documentati.

Verifica dal vivo: Home, partita completa (vittoria/sconfitta/tempo scaduto), Classifica e l'intera sezione Profilo sono state navigate in un browser reale contro il backend Docker locale, incluso un account di prova registrato appositamente; gli screenshot risultanti sono stati confrontati visivamente con i mockup.

Rimasto solo pianificato, non ancora implementato: le fasi successive del piano (Tornei, Sfida, Autenticazione, rifinitura finale/asset/QA) e alcuni collegamenti funzionali del sistema di dialoghi (vedi aspetti aperti).

## Aspetti aperti

- Icona notifiche in Home: presente solo visivamente, non collegata a un sistema di notifiche reale (non esiste ancora).
- Verifica di disponibilità del nickname in tempo reale durante la modifica profilo: non implementata, serve decidere se costruire un endpoint dedicato.
- Campo "squadra del cuore": lasciato come testo libero invece di una selezione strutturata, in attesa di conferma dall'utente sul comportamento voluto.
- Indicatore "amico online": il dato sottostante è sempre falso (nessuna presenza reale implementata), quindi il pallino non compare mai; da decidere se implementare una vera presenza.
- Avviso "connessione persa" e avviso "avversario trovato" (sistema dialoghi): i componenti grafici sono pronti ma non collegati, perché richiederebbero nuove funzionalità di rilevamento non ancora presenti nel codice.
- Notifica di sfida tra amici ricevuta in tempo reale: il nuovo pannello con conto alla rovescia è pronto ma non ancora collegato al flusso reale, che usa ancora il vecchio avviso.
- Stile della schermata di Autenticazione: nessun mockup fornito finora, restyle rimandato.
- Nome giocatore corrotto nei dati reali (entità HTML non decodificate): segnalato, non corretto, riguarda l'importazione dati e non la grafica.
- Fasi 7-12 del piano (Tornei, Sfida, Autenticazione, loader/asset restanti, rifinitura/QA finale) non ancora iniziate.

## Artefatti della sessione

### Prompt executor

Nessun prompt executor da archiviare.

### Altri file

1. `restyle.md`
   Piano d'azione del restyle in 12 fasi, con task/sotto-task dettagliati; aggiornato a fine di ogni fase con lo stato reale raggiunto, le correzioni emerse e i punti aperti.

## Nota per l'archiviazione

Nessun `PROMPT_ID`/`SUB_PROMPT_ID` presente in questa sessione (nessun prompt executor generato). Dati Git limitati a quanto esplicitamente mostrato a inizio sessione (branch e commit più recente): nessuna operazione Git è stata eseguita durante il lavoro, quindi commit di inizio e fine coincidono.
