-- Aggiornamento 12 – Manutenzioni senza tipologie: aggiorna il passaggio della Caldaia che citava "Principale / Cliente".
-- Le tipologie restano nel database ma non vengono più usate (gli avvisi arrivano solo dai contratti).
-- Da eseguire una volta: SQL Editor → New query → incolla → Run.
update operazioni set passaggi = array_replace(passaggi, 'Registra data e tipo: Principale (tecnico, ogni 12 mesi) o Cliente (interventi fatti da voi).', 'Registra l''intervento con data, chi l''ha eseguito, costo ed eventuale contratto.')
where tipo = 'storico' and 'Registra data e tipo: Principale (tecnico, ogni 12 mesi) o Cliente (interventi fatti da voi).' = any(passaggi);
