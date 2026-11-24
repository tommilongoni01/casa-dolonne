-- Aggiornamento 14 – Bollette luce.
-- Crea la tabella delle bollette (una per bimestre) e l'operazione "Bollette luce" nell'impianto elettrico.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza creare doppioni.

create table if not exists bollette (
    id uuid primary key default gen_random_uuid(),
    operazione_id uuid references operazioni(id) on delete cascade,
    anno int not null,
    bimestre int not null check (bimestre between 1 and 6),
    dal date,
    al date,
    importo numeric,
    kwh numeric,
    kwh_mese1 numeric,
    kwh_mese2 numeric,
    potenza_max numeric,
    note text not null default ''
);
alter table bollette enable row level security;
drop policy if exists "lettura familiari" on bollette;
drop policy if exists "modifica editor" on bollette;
create policy "lettura familiari" on bollette for select using (is_membro());
create policy "modifica editor" on bollette for all using (is_editor()) with check (is_editor());
do $$ begin alter publication supabase_realtime add table bollette; exception when duplicate_object then null; end $$;

-- L'operazione nell'impianto elettrico (quello con l'icona del fulmine), in cima all'elenco.
insert into operazioni (sezione_id, titolo, tipo, icona, descrizione, ordine, passaggi)
select s.id, 'Bollette luce', 'bollette', 'lampadina',
       'Bollette della luce, una ogni due mesi: importo, consumo in kWh e potenza massima prelevata. I grafici mostrano la spesa per bimestre e il consumo mese per mese, a confronto con l''anno prima.',
       -1, '{}'
from (select id from sezioni where icona = 'fulmine' or nome ilike '%elettric%' order by (icona = 'fulmine') desc, ordine limit 1) s
where not exists (select 1 from operazioni o where o.tipo = 'bollette');
