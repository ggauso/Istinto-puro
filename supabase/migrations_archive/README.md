# Archivio storico — non usare per nuovi deploy

Questi 26 file sono la cronologia reale delle migrazioni applicate nel tempo
sul progetto Supabase Cloud di produzione, da quando il progetto è nato fino
alla fix di sicurezza del 2026-09-19. Sono conservati qui solo come
riferimento storico/audit trail (per capire *perché* esiste una certa
colonna o funzione, o per confrontare col reale stato di produzione).

**Per lo stato attuale del database, usa `supabase/schema/`**, non questi
file: molti oggetti qui dentro sono stati ridefiniti più volte in file
diversi (es. `get_challenge_by_token` in 5 file, `save_match_result` in 4),
e alcuni file (`schema.sql`, `rpc.sql`, `security.sql`, `setup-auth.sql`)
contengono in parte definizioni superate — ricostruire lo stato reale da
qui richiederebbe di rileggerli tutti nell'ordine corretto, esattamente il
problema che `supabase/schema/` risolve.

## Se devi ricostruire il database da zero

Non eseguire questi file. Esegui invece, in ordine, i file numerati in
`supabase/schema/` — vedi il commento in testa a ciascun file per sapere
da quale/i file storici deriva.

## Se stai investigando un comportamento in produzione

Il progetto Supabase Cloud reale ha effettivamente eseguito questi file
nell'ordine storico (schema.sql → rpc.sql → security.sql → setup-auth.sql →
alter_features.sql → alter-002 → ... → alter-022-security-fixes.sql, con
alcune modifiche manuali mai salvate in un file — es. le colonne
`teams.league_id`/`player_teams.season`, aggiunte a mano e solo
successivamente documentate in `supabase/schema/01_extensions_and_game_data.sql`).
Se un comportamento in produzione non corrisponde a `supabase/schema/`,
è più probabile che sia dovuto a una modifica manuale mai versionata che a
un errore nel consolidamento — verifica con `\d`/`\df` su Supabase Studio
prima di assumere che il consolidamento sia sbagliato.
