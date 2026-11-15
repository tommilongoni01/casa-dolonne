-- Aggiornamento 1 – taniche dell'ossigeno (da eseguire una volta, se il database
-- è stato creato prima di questa modifica): SQL Editor → New query → incolla → Run.
alter table prodotti add column if not exists confezioni jsonb not null default '[]';
alter table movimenti add column if not exists confezioni jsonb not null default '[]';
update prodotti set confezioni = '[5, 1]' where categoria = 'ossigeno' and confezioni = '[]';
