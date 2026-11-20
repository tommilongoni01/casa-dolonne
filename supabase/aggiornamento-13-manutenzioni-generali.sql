-- Aggiornamento 13 – Impianto speciale "Manutenzioni Generali" e allegati negli interventi.
-- Crea l'impianto con le categorie di lavori iniziali e aggiunge titolo e foto/fatture agli interventi.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza creare doppioni.

alter table sezioni add column if not exists speciale text not null default '';
alter table interventi add column if not exists titolo text not null default '';
alter table interventi add column if not exists allegati jsonb not null default '[]';

do $$
declare
    gen uuid;
begin
    select id into gen from sezioni where speciale = 'generale' limit 1;
    if gen is null then
        insert into sezioni (nome, icona, ordine, speciale)
        values ('Manutenzioni Generali', 'pennello', (select coalesce(max(ordine), -1) + 1 from sezioni), 'generale')
        returning id into gen;
    end if;
    -- Le categorie iniziali (solo quelle che mancano).
    insert into operazioni (sezione_id, titolo, tipo, icona, descrizione, ordine, passaggi)
    select gen, v.titolo, 'lavori', v.icona, v.descrizione, v.ordine, '{}'
    from (values
        ('Verniciature', '', 'Pitturazione di pareti, soffitti, legno e ferro: garage, balconi, persiane, ringhiere.', 0),
        ('Recinzioni e staccionate', 'forbici', 'Staccionate, cancelli, reti e muretti di confine: riparazioni, trattamento del legno, rifacimenti.', 1),
        ('Tetto e grondaie', 'goccia', 'Controllo e pulizia di tetto, grondaie e pluviali, sostituzione di tegole e scossaline.', 2),
        ('Serramenti e porte', 'casa', 'Finestre, porte, persiane e scuri: regolazioni, guarnizioni, verniciatura, sostituzioni.', 3),
        ('Esterni e pavimentazioni', 'scopa', 'Vialetti, scale esterne, terrazzi, pavimentazioni e muretti: pulizia, riparazioni, rifacimenti.', 4),
        ('Piccole riparazioni', 'chiave', 'Lavori occasionali in casa non legati a un impianto: mobili, maniglie, sigillature, montaggi.', 5)
    ) as v(titolo, icona, descrizione, ordine)
    where not exists (select 1 from operazioni o where o.sezione_id = gen and o.titolo = v.titolo);
    -- Qui non serve l'operazione standard Manutenzioni (creata dall'aggiornamento 11, se rieseguito): via se è vuota.
    delete from operazioni o where o.sezione_id = gen and o.tipo = 'storico'
      and not exists (select 1 from interventi i where i.operazione_id = o.id);
end $$;
