-- L'immagine supabase/postgres:15.8.1.060 include auth.uid()/auth.role()/auth.email()
-- ma NON auth.jwt(): quella funzione viene creata più tardi da GoTrue stesso, alla
-- prima partenza del servizio "auth", tramite la sua migrazione interna
-- 20220531120530_add_auth_jwt_function. Il problema è che le NOSTRE migrazioni
-- (public RLS) girano PRIMA, durante il boot di Postgres, quando GoTrue non è
-- ancora partito: senza auth.jwt() quelle policy fallirebbero.
--
-- La creiamo qui in anticipo con lo STESSO contenuto e usando SET ROLE
-- supabase_auth_admin, in modo che sia di proprietà di quel ruolo: quando GoTrue
-- parte e rilancia la sua identica migrazione (CREATE OR REPLACE), non trova
-- conflitti di ownership e la sostituisce senza errori.
SET ROLE supabase_auth_admin;

comment on function auth.uid() is 'Deprecated. Use auth.jwt() -> ''sub'' instead.';
comment on function auth.role() is 'Deprecated. Use auth.jwt() -> ''role'' instead.';
comment on function auth.email() is 'Deprecated. Use auth.jwt() -> ''email'' instead.';

create or replace function auth.jwt()
returns jsonb
language sql stable
as $$
  select
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;

RESET ROLE;
