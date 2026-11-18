-- Aggiornamento 11 – "Manutenzioni" come operazione standard di ogni impianto.
-- Rinomina gli "Storico manutenzioni" e crea l'operazione negli impianti che non ce l'hanno
-- (tipologie Principale ogni 12 mesi e Cliente senza avviso). Si può rieseguire senza creare doppioni.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run.

update operazioni set titolo = 'Manutenzioni' where tipo = 'storico' and titolo = 'Storico manutenzioni';

do $$
declare
    s record;
    nuova uuid;
begin
    for s in select * from sezioni where not exists (select 1 from operazioni o where o.sezione_id = sezioni.id and o.tipo = 'storico') loop
        insert into operazioni (sezione_id, titolo, tipo, ordine, passaggi)
        values (s.id, 'Manutenzioni', 'storico', (select coalesce(max(ordine), -1) + 1 from operazioni where sezione_id = s.id), '{}')
        returning id into nuova;
        insert into tipologie (operazione_id, nome, mesi_avviso, ordine)
        values (nuova, 'Principale', 12, 0), (nuova, 'Cliente', 0, 1);
    end loop;
end $$;

-- Controllo: un'operazione Manutenzioni per impianto.
select s.nome as impianto, count(o.id) as manutenzioni
from sezioni s left join operazioni o on o.sezione_id = s.id and o.tipo = 'storico'
group by s.nome, s.ordine order by s.ordine;
