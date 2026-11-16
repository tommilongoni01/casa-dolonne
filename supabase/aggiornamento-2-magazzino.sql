-- Aggiornamento 2 – Magazzino: scheda prodotto (codice, stato, fornitore, operazione),
-- schede tecniche, pH- e pH+, UNIOXY POOL per l'ossigeno.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza danni.

alter table prodotti add column if not exists codice text not null default '';
alter table prodotti add column if not exists stato text not null default '';
alter table prodotti add column if not exists fornitore text not null default '';
alter table prodotti add column if not exists fornitore_link text not null default '';
alter table prodotti add column if not exists operazione_id uuid references operazioni(id) on delete set null;
alter table documenti add column if not exists prodotto_id uuid references prodotti(id) on delete cascade;

-- Collegamenti esistenti: il prodotto dell'ossigeno e i prodotti pH.
update prodotti p set operazione_id = o.id
from operazioni o where p.operazione_id is null and o.prodotto_id = p.id;
update prodotti p set operazione_id = (select id from operazioni where tipo = 'ph' limit 1)
where p.operazione_id is null and p.categoria = 'ph';

-- pH: il "Correttore pH" iniziale diventa pH- (i movimenti restano) e si aggiunge pH+.
update prodotti set nome = 'pH-', ordine = 1 where categoria = 'ph' and nome = 'Correttore pH';
insert into prodotti (nome, categoria, unita, stato, ordine, operazione_id)
select 'pH+', 'ph', 'kg', 'Polvere', 2, (select id from operazioni where tipo = 'ph' limit 1)
where not exists (select 1 from prodotti where categoria = 'ph' and nome = 'pH+');

-- Ossigeno: UNIOXY POOL di Controlchemi, taniche da 5 e da 1 litro.
update prodotti set nome = 'UNIOXY POOL', codice = 'CK120914S', stato = 'Liquido', unita = 'l',
       confezioni = '[5, 1]', fornitore = 'Gecostore', fornitore_link = 'https://www.gecostore.it'
where categoria = 'ossigeno' and nome in ('Ossigeno attivo', 'UNIOXY POOL');
insert into documenti (prodotto_id, titolo, nome_file, percorso, dimensione)
select id, 'Scheda tecnica UNIOXY POOL', 'unioxypool_t_it_1_0.pdf', 'statico/schede/unioxypool_t_it_1_0.pdf', 225148
from prodotti where nome = 'UNIOXY POOL'
  and not exists (select 1 from documenti where percorso = 'statico/schede/unioxypool_t_it_1_0.pdf');
