-- Aggiornamento 3 – Pellet nel magazzino: i carichi diventano acquisti del prodotto "Pellet".
-- Da eseguire una volta (dopo l'aggiornamento 2): SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza danni. La vecchia tabella carichi_pellet resta come copia di sicurezza.

alter table movimenti add column if not exists dettagli jsonb not null default '{}';

-- Prodotto Pellet collegato all'operazione Pellet della Caldaia.
insert into prodotti (nome, categoria, stato, unita, ordine, operazione_id)
select 'Pellet', 'pellet', 'Granulare', 'q', 3, (select id from operazioni where tipo = 'pellet' limit 1)
where not exists (select 1 from prodotti where categoria = 'pellet');

-- Ogni carico → acquisto (quantità in quintali, totale IVA inclusa; €/q, IVA e pre carico nei dettagli).
insert into movimenti (prodotto_id, data, tipo, quantita, costo, fornitore, note, dettagli)
select p.id, c.data, 'acquisto', c.quintali,
       round(c.quintali * c.prezzo_quintale * (1 + c.iva_percentuale / 100), 2), c.fornitore, c.note,
       jsonb_build_object('prezzo_unitario', c.prezzo_quintale, 'iva_percentuale', c.iva_percentuale,
                          'precarico', c.precarico, 'carico_id', c.id)
from carichi_pellet c
join prodotti p on p.categoria = 'pellet'
where not exists (select 1 from movimenti m where m.dettagli->>'carico_id' = c.id::text);
