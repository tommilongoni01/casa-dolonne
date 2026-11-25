-- Aggiornamento 16 – Bollette luce: altri costi, fornitore e dati della fornitura.
-- Da eseguire una volta DOPO l'aggiornamento 14: SQL Editor → New query → incolla tutto → Run. Si può rieseguire.

-- Ogni voce è una bolletta bimestrale oppure un altro costo (es. allacciamento) con solo data, importo e note.
alter table bollette add column if not exists tipo text not null default 'bimestre';
alter table bollette add column if not exists fornitore text not null default '';
alter table bollette alter column bimestre drop not null;

-- POD, fornitore, numero cliente, codice fiscale, indirizzo e potenza impegnata: si inseriscono dall'app.
alter table operazioni add column if not exists fornitura jsonb not null default '{}';

-- Descrizione aggiornata dell'operazione.
update operazioni set descrizione = 'Bollette della luce (una ogni due mesi) e altri costi dell''energia. I grafici mostrano consumi, spesa e prezzo mese per mese e il confronto dello stesso mese negli anni.'
where tipo = 'bollette' and descrizione like 'Bollette della luce, una ogni due mesi%';
