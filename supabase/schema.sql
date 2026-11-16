-- =====================================================================
-- Casa Dolonne – struttura del database (Supabase / PostgreSQL)
--
-- Da eseguire UNA SOLA VOLTA nel pannello Supabase:
--   SQL Editor → New query → incolla tutto questo file → Run.
--
-- Poi, sempre nel SQL Editor, registra il primo familiare con ruolo editor:
--   insert into membri (email, nome, ruolo) values ('email@esempio.it', 'Nome', 'editor');
-- Gli altri familiari si aggiungono poi dall'app (Impostazioni → Famiglia).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Familiari e ruoli
-- ---------------------------------------------------------------------
create table if not exists membri (
    email text primary key,
    nome text not null default '',
    ruolo text not null default 'lettore' check (ruolo in ('editor', 'lettore')),
    creato timestamptz not null default now()
);

-- Email dell'utente collegato, in minuscolo.
create or replace function email_corrente() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- true se l'utente collegato è un familiare registrato.
create or replace function is_membro() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from membri where lower(email) = email_corrente())
$$;

-- true se l'utente collegato può modificare i dati.
create or replace function is_editor() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from membri where lower(email) = email_corrente() and ruolo = 'editor')
$$;

-- ---------------------------------------------------------------------
-- Dati dell'app
-- ---------------------------------------------------------------------
create table if not exists sezioni (
    id uuid primary key default gen_random_uuid(),
    nome text not null default '',
    icona text not null default 'chiave',
    ordine int not null default 0
);

create table if not exists contatti (
    id uuid primary key default gen_random_uuid(),
    nome text not null default '',
    cognome text not null default '',
    azienda text not null default '',
    ruolo text not null default '',
    telefono text not null default '',
    cellulare text not null default '',
    email text not null default '',
    indirizzo text not null default '',
    sito_web text not null default '',
    note text not null default '',
    preferito boolean not null default false,
    sezioni uuid[] not null default '{}'
);

create table if not exists guide (
    id uuid primary key default gen_random_uuid(),
    sezione_id uuid references sezioni(id) on delete cascade,
    titolo text not null default '',
    -- [{ "tipo": "testo", "html": "..." } | { "tipo": "immagine", "percorso": "...", "didascalia": "..." }]
    blocchi jsonb not null default '[]',
    aggiornata timestamptz not null default now()
);

create table if not exists documenti (
    id uuid primary key default gen_random_uuid(),
    sezione_id uuid references sezioni(id) on delete cascade,
    titolo text not null default '',
    nome_file text not null default '',
    percorso text not null default '',
    dimensione bigint not null default 0,
    aggiunto timestamptz not null default now()
);

create table if not exists contratti (
    id uuid primary key default gen_random_uuid(),
    sezione_id uuid references sezioni(id) on delete set null,
    fornitore_id uuid references contatti(id) on delete set null,
    titolo text not null default '',
    numero text not null default '',
    inizio date,
    scadenza date,
    costo_annuo numeric not null default 0,
    rinnovo_automatico boolean not null default false,
    preavviso_giorni int not null default 30,
    note text not null default '',
    allegato text not null default '',
    nome_allegato text not null default ''
);

create table if not exists prodotti (
    id uuid primary key default gen_random_uuid(),
    nome text not null default '',
    codice text not null default '',
    categoria text not null default 'altro',
    -- Simbolo scelto (vuoto = scatola).
    icona text not null default '',
    -- Liquido, Polvere, Granulare…
    stato text not null default '',
    unita text not null default 'pz',
    scorta_minima numeric not null default 0,
    consumo_mensile numeric,
    -- Formati di confezione in unità del prodotto, es. [5, 1] = taniche da 5 l e da 1 l.
    confezioni jsonb not null default '[]',
    fornitore text not null default '',
    fornitore_link text not null default '',
    note text not null default '',
    ordine int not null default 0
);

-- Schede tecniche dei prodotti a scorta (documenti senza sezione).
alter table documenti add column if not exists prodotto_id uuid references prodotti(id) on delete cascade;

create table if not exists movimenti (
    id uuid primary key default gen_random_uuid(),
    prodotto_id uuid references prodotti(id) on delete cascade,
    data date not null default current_date,
    tipo text not null default 'consumo' check (tipo in ('acquisto', 'consumo', 'rettifica')),
    quantita numeric not null default 0,
    costo numeric not null default 0,
    fornitore text not null default '',
    descrizione_prodotto text not null default '',
    -- Confezioni del movimento, es. [{"litri": 5, "numero": 2, "prezzo": 30}].
    confezioni jsonb not null default '[]',
    -- Acquisti: {"prezzo_unitario": 32.5, "iva_percentuale": 22, "precarico": 4} (precarico = giacenza prima del carico).
    dettagli jsonb not null default '{}',
    note text not null default ''
);

create table if not exists operazioni (
    id uuid primary key default gen_random_uuid(),
    sezione_id uuid references sezioni(id) on delete cascade,
    titolo text not null default '',
    tipo text not null default 'generica',
    descrizione text not null default '',
    passaggi text[] not null default '{}',
    note text not null default '',
    ordine int not null default 0,
    giorni_allarme int not null default 0,
    -- Simbolo scelto (vuoto = quello del tipo di operazione).
    icona text not null default '',
    prodotto_id uuid references prodotti(id) on delete set null,
    guida_id uuid references guide(id) on delete set null
);

-- Operazione (e quindi impianto) a cui è collegato un prodotto del magazzino.
alter table prodotti add column if not exists operazione_id uuid references operazioni(id) on delete set null;

create table if not exists tipologie (
    id uuid primary key default gen_random_uuid(),
    operazione_id uuid references operazioni(id) on delete cascade,
    nome text not null default '',
    mesi_avviso int not null default 0,
    ordine int not null default 0
);

create table if not exists interventi (
    id uuid primary key default gen_random_uuid(),
    operazione_id uuid references operazioni(id) on delete cascade,
    tipologia_id uuid references tipologie(id) on delete set null,
    data date not null default current_date,
    note text not null default ''
);

create table if not exists misure_ph (
    id uuid primary key default gen_random_uuid(),
    data date not null default current_date,
    dosimetro numeric,
    scuba numeric,
    note text not null default ''
);

create table if not exists processi_acqua (
    id uuid primary key default gen_random_uuid(),
    tipo text not null default 'svuotamento' check (tipo in ('svuotamento', 'riempimento')),
    inizio timestamptz not null default now(),
    fine timestamptz,
    livello_iniziale numeric not null default 0,
    livello_finale numeric,
    livello_obiettivo numeric,
    temperatura_iniziale numeric,
    temperatura_finale numeric,
    -- [{ "ora": "2026-11-15T10:00:00Z", "livello": -5 }]
    letture jsonb not null default '[]',
    note text not null default ''
);

create table if not exists carichi_pellet (
    id uuid primary key default gen_random_uuid(),
    data date not null default current_date,
    fornitore text not null default '',
    quintali numeric not null default 0,
    prezzo_quintale numeric not null default 0,
    iva_percentuale numeric not null default 22,
    precarico numeric,
    note text not null default ''
);

create table if not exists svuotamenti_cenere (
    id uuid primary key default gen_random_uuid(),
    data date not null default current_date,
    scorta_kg numeric,
    note text not null default ''
);

-- ---------------------------------------------------------------------
-- Regole di accesso: i familiari leggono, gli editor modificano.
-- ---------------------------------------------------------------------
do $$
declare
    tabella text;
begin
    foreach tabella in array array[
        'membri', 'sezioni', 'contatti', 'guide', 'documenti', 'contratti', 'prodotti', 'movimenti',
        'operazioni', 'tipologie', 'interventi', 'misure_ph', 'processi_acqua', 'carichi_pellet',
        'svuotamenti_cenere'
    ] loop
        execute format('alter table %I enable row level security', tabella);
        execute format('drop policy if exists "lettura familiari" on %I', tabella);
        execute format('drop policy if exists "modifica editor" on %I', tabella);
        execute format('create policy "lettura familiari" on %I for select using (is_membro())', tabella);
        execute format('create policy "modifica editor" on %I for all using (is_editor()) with check (is_editor())', tabella);
        -- Aggiornamenti in tempo reale verso tutti i dispositivi.
        begin
            execute format('alter publication supabase_realtime add table %I', tabella);
        exception when duplicate_object then null;
        end;
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- File (PDF, foto delle guide, allegati): spazio privato "file".
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('file', 'file', false)
on conflict (id) do nothing;

drop policy if exists "file lettura familiari" on storage.objects;
drop policy if exists "file caricamento editor" on storage.objects;
drop policy if exists "file modifica editor" on storage.objects;
drop policy if exists "file eliminazione editor" on storage.objects;

create policy "file lettura familiari" on storage.objects
    for select using (bucket_id = 'file' and is_membro());
create policy "file caricamento editor" on storage.objects
    for insert with check (bucket_id = 'file' and is_editor());
create policy "file modifica editor" on storage.objects
    for update using (bucket_id = 'file' and is_editor());
create policy "file eliminazione editor" on storage.objects
    for delete using (bucket_id = 'file' and is_editor());

-- ---------------------------------------------------------------------
-- "Risveglio": usata dal controllo automatico settimanale di GitHub
-- per evitare che il progetto gratuito venga sospeso per inattività.
-- ---------------------------------------------------------------------
create or replace function risveglio() returns text
language sql stable security definer set search_path = public as $$
    select 'ok ' || (select count(*) from sezioni)::text
$$;
grant execute on function risveglio() to anon;
