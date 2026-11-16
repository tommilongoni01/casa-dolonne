-- Aggiornamento 5 – Nuovi impianti: Antifurto e Giardino, ognuno con lo Storico manutenzioni
-- (tipologie "Principale" ogni 12 mesi e "Cliente" senza avviso, come gli altri impianti).
-- Da eseguire una volta: SQL Editor → New query → incolla → Run. Si può rieseguire senza creare doppioni.
do $$
declare
    impianto record;
    sezione_id uuid;
    operazione_id uuid;
begin
    for impianto in select * from (values ('Antifurto', 'scudo'), ('Giardino', 'germoglio')) as v(nome, icona) loop
        if exists (select 1 from sezioni where nome = impianto.nome) then continue; end if;
        insert into sezioni (nome, icona, ordine)
        values (impianto.nome, impianto.icona, (select coalesce(max(ordine), -1) + 1 from sezioni))
        returning id into sezione_id;
        insert into operazioni (sezione_id, titolo, tipo, ordine, passaggi)
        values (sezione_id, 'Storico manutenzioni', 'storico', 0, '{}')
        returning id into operazione_id;
        insert into tipologie (operazione_id, nome, mesi_avviso, ordine)
        values (operazione_id, 'Principale', 12, 0), (operazione_id, 'Cliente', 0, 1);
    end loop;
end $$;
