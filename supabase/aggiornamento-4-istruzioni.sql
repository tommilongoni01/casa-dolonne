-- Aggiornamento 4 – Toglie la sezione "Istruzioni generali" (non è un impianto).
-- La elimina solo se è vuota: nessuna guida, documento, operazione, contratto o contatto collegato.
-- Da eseguire una volta: SQL Editor → New query → incolla → Run.
delete from sezioni s
where s.nome = 'Istruzioni generali'
  and not exists (select 1 from guide g where g.sezione_id = s.id)
  and not exists (select 1 from documenti d where d.sezione_id = s.id)
  and not exists (select 1 from operazioni o where o.sezione_id = s.id)
  and not exists (select 1 from contratti c where c.sezione_id = s.id)
  and not exists (select 1 from contatti c where s.id = any(c.sezioni));

-- Se compare "DELETE 0" la sezione contiene qualcosa: spostalo in un altro impianto
-- (o eliminalo) e poi riesegui, oppure eliminala dall'app con Casa → Modifica.
