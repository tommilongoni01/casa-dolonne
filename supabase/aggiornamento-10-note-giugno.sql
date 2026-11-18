-- Aggiornamento 10 – Note del 18/06: fornitori multipli, acquisti con sconto e trasporto, contratti completi,
-- interventi con contratto/esecutore/costo, registro Deposito del pellet.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza danni.

-- Prodotti: più fornitori [{ "nome": "Gecostore", "link": "https://…" }]
alter table prodotti add column if not exists fornitori jsonb not null default '[]';
update prodotti set fornitori = jsonb_build_array(jsonb_build_object('nome', fornitore, 'link', fornitore_link))
where fornitori = '[]'::jsonb and trim(fornitore) <> '';

-- Contratti: fornitore, durata, costo complessivo con IVA, obbligo di legge
alter table contratti add column if not exists fornitore text not null default '';
alter table contratti add column if not exists durata_valore int;
alter table contratti add column if not exists durata_unita text not null default 'anni';
alter table contratti add column if not exists costo numeric;
alter table contratti add column if not exists iva_percentuale numeric;
alter table contratti add column if not exists obbligo_legge boolean not null default false;
update contratti c set fornitore = trim(coalesce(nullif(trim(k.azienda), ''), k.nome || ' ' || k.cognome))
from contatti k where c.fornitore = '' and c.fornitore_id = k.id;

-- Interventi: da contratto, chi l'ha eseguito, costo
alter table interventi add column if not exists contratto_id uuid references contratti(id) on delete set null;
alter table interventi add column if not exists eseguito_da text not null default 'ditta';
alter table interventi add column if not exists esecutore text not null default '';
alter table interventi add column if not exists costo numeric not null default 0;

-- Deposito pellet: letture del pannello con lo stato dei piani { "Spa": "on", "P-1": "standby", "P0": "off", "P1": "on" }
create table if not exists letture_deposito (
    id uuid primary key default gen_random_uuid(),
    prodotto_id uuid references prodotti(id) on delete cascade,
    momento timestamptz not null default now(),
    kg numeric not null default 0,
    piani jsonb not null default '{}',
    note text not null default ''
);
alter table letture_deposito enable row level security;
drop policy if exists "lettura familiari" on letture_deposito;
drop policy if exists "modifica editor" on letture_deposito;
create policy "lettura familiari" on letture_deposito for select using (is_membro());
create policy "modifica editor" on letture_deposito for all using (is_editor()) with check (is_editor());
do $$ begin alter publication supabase_realtime add table letture_deposito; exception when duplicate_object then null; end $$;

-- La rettifica di giacenza del pellet diventa la prima lettura del deposito (in kg).
insert into letture_deposito (prodotto_id, momento, kg, note)
select m.prodotto_id, (m.data::timestamp + interval '12 hours'), m.quantita * 100, 'Da rettifica giacenza'
from movimenti m join prodotti p on p.id = m.prodotto_id
where p.categoria = 'pellet' and m.tipo = 'rettifica'
  and not exists (select 1 from letture_deposito l where l.prodotto_id = m.prodotto_id and l.momento::date = m.data);

-- Allarme pellet sotto i 5 q, se non impostato.
update prodotti set scorta_minima = 5 where categoria = 'pellet' and scorta_minima = 0;

-- Pellet: descrizione breve; i passaggi diventano la guida "Carico del pellet e deposito" nel Manuale della Caldaia.
insert into guide (sezione_id, titolo, blocchi, aggiornata)
select s.id, 'Carico del pellet e deposito', '[{"tipo": "testo", "html": "<h3>Carico del pellet</h3><ol><li>Prima del carico leggi sul pannello ETA i kg presenti nel deposito.</li><li>Usa pellet certificato ENplus A1, asciutto e con pochi residui di polvere.</li><li>Registra l''acquisto (pulsante Acquisto) con quantità, prezzo al quintale, sconto, trasporto, IVA e fornitore.</li><li>Dopo il carico registra una nuova lettura del deposito con i kg indicati dal pannello.</li><li>Durante la stagione registra le letture del deposito con lo stato dei piani (Spa, P-1, P0, P1): così si vede quanto consuma ogni configurazione.</li><li>Sotto i 5 q compare l''avviso di scorta minima.</li><li>Se il pellet finisce, la pompa di calore può scaldare al posto della caldaia (vedi guida \"Gestione priorità\").</li></ol>"}]'::jsonb, now()
from sezioni s where s.nome = 'Caldaia'
  and not exists (select 1 from guide g where g.sezione_id = s.id and g.titolo = 'Carico del pellet e deposito');
update operazioni o set descrizione = 'Carichi di pellet e letture del deposito della caldaia.', passaggi = '{}',
    guida_id = coalesce(o.guida_id, (select g.id from guide g where g.titolo = 'Carico del pellet e deposito' limit 1))
where o.tipo = 'pellet' and coalesce(array_length(o.passaggi, 1), 0) > 0;
