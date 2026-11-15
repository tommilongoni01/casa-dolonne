-- Aggiornamento 2 – pH- e pH+ a scorta, schede tecniche dei prodotti.
-- Da eseguire una volta: SQL Editor → New query → incolla → Run.
alter table documenti add column if not exists prodotto_id uuid references prodotti(id) on delete cascade;

-- Il "Correttore pH" iniziale diventa pH- (acquisti e riempimenti restano), e si aggiunge pH+.
update prodotti set nome = 'pH-', ordine = 1 where categoria = 'ph' and nome = 'Correttore pH';
insert into prodotti (nome, categoria, unita, ordine)
select 'pH+', 'ph', 'kg', 2
where not exists (select 1 from prodotti where categoria = 'ph' and nome = 'pH+');
