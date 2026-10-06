-- NOTE: change to your own passwords for production environments
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
-- supabase_functions_admin è creato solo se l'estensione pg_net risulta attiva
-- (legata al servizio "functions"/webhooks, non usato da questo stack): saltiamo
-- l'ALTER per evitare un errore quando il ruolo non esiste.
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
