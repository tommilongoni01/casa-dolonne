-- Aggiornamento 8 – Simbolo personalizzabile per operazioni e prodotti.
-- Da eseguire una volta: SQL Editor → New query → incolla → Run. Si può rieseguire senza danni.
alter table operazioni add column if not exists icona text not null default '';
alter table prodotti add column if not exists icona text not null default '';
