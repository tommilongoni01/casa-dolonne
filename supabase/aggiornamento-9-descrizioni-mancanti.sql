-- Aggiornamento 9 – Completa le descrizioni mancanti delle operazioni.
-- Riempie la descrizione di ogni operazione che non ce l'ha (i passaggi già scritti restano; se mancano, li aggiunge).
-- Il nome dell'impianto è confrontato senza badare a maiuscole e spazi. Le descrizioni già scritte non vengono toccate.
-- Da eseguire: SQL Editor → New query → incolla tutto → Run. Alla fine mostra le operazioni ancora senza descrizione.

-- Piscina · ph
update operazioni o set descrizione = 'Misura del pH dell''acqua con il dosimetro e con il kit Scuba, e correzione con pH- o pH+. Valore ideale tra 7,0 e 7,4 (accettabile 6,8 – 7,8): un pH corretto fa lavorare bene l''ossigeno attivo e protegge pelle, occhi e impianto.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Con la filtrazione in funzione da almeno un''ora, preleva l''acqua a circa 30 cm di profondità, lontano dalle bocchette.', 'Leggi il valore sul dosimetro e ripeti la misura con il kit Scuba.', 'Registra entrambe le misure nell''app.', 'Se il pH è sopra 7,6 aggiungi pH-, se è sotto 7,0 aggiungi pH+, seguendo la dose indicata sulla confezione.', 'Sciogli il prodotto in un secchio d''acqua e versalo vicino alle bocchette di mandata, con la pompa accesa.', 'Ricontrolla dopo 4–6 ore e registra il consumo di prodotto.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Piscina') and o.tipo = 'ph'
  and trim(o.descrizione) = '';

-- Piscina · ossigeno
update operazioni o set descrizione = 'Trattamento senza cloro con UNIOXY POOL (perossido di idrogeno con alghicida e flocculante). Mantenimento: 1–2 litri ogni 10 m³ d''acqua alla settimana, di più con uso intenso o caldo.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Controlla prima che il pH sia nell''intervallo corretto.', 'Calcola la dose: 1–2 l ogni 10 m³ d''acqua (dose iniziale a inizio stagione: 5 l ogni 10 m³).', 'Versa il prodotto la sera, a piscina in funzione, oppure riempi la tanica della pompa dosatrice.', 'Usa guanti e occhiali: il prodotto è irritante per gli occhi. Non travasarlo in altri contenitori.', 'Registra il riempimento indicando le taniche usate.', 'Dopo il trattamento iniziale, fai un controlavaggio del filtro dopo 1–2 giorni.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Piscina') and o.tipo = 'ossigeno'
  and trim(o.descrizione) = '';

-- Piscina · cambioAcqua
update operazioni o set descrizione = 'Svuotamento e riempimento della vasca, ad esempio a fine o inizio stagione o quando l''acqua è da rinnovare. Il livello si misura in cm rispetto al pieno (0 cm) e scende con lo svuotamento.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Spegni la filtrazione e il riscaldamento della piscina.', 'Avvia lo svuotamento nell''app con il livello iniziale e registra il livello ogni qualche ora.', 'A vasca vuota pulisci fondo, pareti, linea d''acqua e skimmer.', 'Avvia il riempimento e registra le letture fino al livello di esercizio.', 'Riaccendi la filtrazione, controlla il pH e fai il trattamento iniziale con ossigeno attivo.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Piscina') and o.tipo = 'cambioAcqua'
  and trim(o.descrizione) = '';

-- Piscina · storico
update operazioni o set descrizione = 'Interventi del manutentore della piscina: controllo di pompa, filtro e dosatori, apertura e chiusura stagionale.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Registra data, tipo di intervento e cosa è stato fatto.', 'Allega il rapporto o la fattura del manutentore.', 'Annota i pezzi sostituiti (guarnizioni, sabbia o cartuccia del filtro, sonde).']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Piscina') and o.tipo = 'storico'
  and trim(o.descrizione) = '';

-- Caldaia · pellet
update operazioni o set descrizione = 'Carico del pellet nel deposito della caldaia ETA PelletsCompact. Il pannello della caldaia indica la scorta presente (Deposito) e avvisa quando si scende sotto la riserva.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Prima del carico leggi sul pannello ETA la scorta nel deposito e annotala come "Prima del carico".', 'Usa pellet certificato (ENplus A1), asciutto e con pochi residui di polvere.', 'Dopo il carico aggiorna sul pannello il valore del deposito.', 'Registra l''acquisto con quantità, prezzo al quintale, IVA e fornitore.', 'Se il pellet finisce, la pompa di calore può scaldare al posto della caldaia (vedi guida "Gestione priorità").']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Caldaia') and o.tipo = 'pellet'
  and trim(o.descrizione) = '';

-- Caldaia · cenere
update operazioni o set descrizione = 'Svuotamento del cassetto cenere della ETA PelletsCompact: la caldaia compatta la cenere da sola, basta svuotarlo qualche volta per stagione (indicativamente 3–4 volte l''anno) o quando il pannello lo segnala.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Spegni il riscaldamento dal pannello e attendi che la caldaia si porti su "Spento".', 'Avvia una scenerazione finale con il tasto "Scenerare" (De-ash).', 'Apri la porta, sblocca la leva ed estrai il cassetto cenere; chiudi le aperture con la piastra di copertura.', 'Svuota la cenere in un contenitore metallico con coperchio: può contenere braci per ore, mai nel bidone dei rifiuti.', 'Controlla la guarnizione del coperchio, rimonta il cassetto e riaccendi.', 'Registra lo svuotamento con la scorta di pellet letta sul pannello.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Caldaia') and o.tipo = 'cenere'
  and trim(o.descrizione) = '';

-- Caldaia · storico
update operazioni o set descrizione = 'Manutenzione annuale della caldaia a pellet da parte del tecnico ETA (pulizia, controllo e analisi fumi) e interventi del cliente.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Fissa la manutenzione prima dell''inverno.', 'Registra data e tipo: Principale (tecnico, ogni 12 mesi) o Cliente (interventi fatti da voi).', 'Fai annotare la manutenzione sul libretto d''impianto e allega il rapporto.', 'Segnala al tecnico eventuali messaggi di errore comparsi sul pannello o su meinETA.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Caldaia') and o.tipo = 'storico'
  and trim(o.descrizione) = '';

-- UTA · storico
update operazioni o set descrizione = 'Manutenzione dell''unità di trattamento aria: pulizia o sostituzione dei filtri, controllo di ventilatori, batterie di scambio e scarico della condensa.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Controlla i filtri ogni 3 mesi e sostituiscili quando sono sporchi.', 'Verifica che lo scarico della condensa non sia ostruito.', 'Fai fare dal tecnico la manutenzione annuale e la sanificazione.', 'Registra l''intervento indicando i filtri sostituiti.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('UTA') and o.tipo = 'storico'
  and trim(o.descrizione) = '';

-- VMC · storico
update operazioni o set descrizione = 'Manutenzione della ventilazione meccanica controllata: pulizia e sostituzione dei filtri, pulizia delle bocchette e controllo del recuperatore di calore.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Pulisci i filtri ogni 2–3 mesi (aspirapolvere o acqua tiepida, se lavabili).', 'Sostituisci i filtri almeno una volta l''anno, o quando la macchina lo segnala.', 'Pulisci le bocchette di immissione ed estrazione nelle stanze.', 'Fai controllare dal tecnico scambiatore, ventilatori e scarico condensa ogni anno.', 'Registra l''intervento e il tipo di filtri usati.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('VMC') and o.tipo = 'storico'
  and trim(o.descrizione) = '';

-- Ascensore · storico
update operazioni o set descrizione = 'Obblighi del DPR 162/99: manutenzione dell''impianto da parte della ditta abilitata almeno ogni 6 mesi e verifica periodica di un ente notificato ogni 2 anni.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Manutenzione impianto (ogni 6 mesi): il manutentore controlla porte e serrature, paracadute, limitatore di velocità, funi e impianto elettrico.', 'Verifica periodica (ogni 2 anni): l''ente incaricato controlla la sicurezza dell''impianto, alla presenza del manutentore.', 'Fai annotare ogni intervento sul libretto dell''ascensore e allega il verbale.', 'In caso di guasto o persone bloccate chiama il manutentore: il numero è nei contatti dell''impianto.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Ascensore') and o.tipo = 'storico'
  and trim(o.descrizione) = '';

-- Impianto fotovoltaico · storico
update operazioni o set descrizione = 'Controllo dell''impianto fotovoltaico Huawei: produzione sull''app FusionSolar, stato dell''inverter, pulizia dei pannelli e verifica annuale del tecnico.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Controlla ogni mese sull''app la produzione e l''assenza di allarmi dell''inverter.', 'Dopo neve o polvere verifica che i pannelli siano puliti; per la pulizia usa solo acqua e attrezzi morbidi.', 'Fai fare dal tecnico il controllo annuale di inverter, quadri e collegamenti.', 'Registra l''intervento e annota eventuali cali di produzione.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Impianto fotovoltaico') and o.tipo = 'storico'
  and trim(o.descrizione) = '';

-- Impianto idraulico · storico
update operazioni o set descrizione = 'Controlli dell''impianto idraulico: pressione, perdite, rubinetti e valvole, addolcitore e protezione antigelo dei tubi quando la casa resta chiusa d''inverno.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Controlla la pressione dell''impianto sul manometro e l''assenza di perdite.', 'Apri e chiudi periodicamente le valvole principali perché non si blocchino.', 'Verifica sale e funzionamento dell''addolcitore, se presente.', 'Prima di lasciare la casa al freddo chiudi l''acqua esterna e svuota i tubi esposti al gelo.', 'Registra gli interventi dell''idraulico e i pezzi sostituiti.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Impianto idraulico') and o.tipo = 'storico'
  and trim(o.descrizione) = '';

-- Impianto elettrico · storico
update operazioni o set descrizione = 'Controlli dell''impianto elettrico: prova dei differenziali (salvavita), stato del quadro e verifica periodica dell''impianto di terra.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Ogni mese premi il tasto di prova (T) dei differenziali: devono scattare subito, poi riarmali.', 'Controlla che nel quadro non ci siano segni di surriscaldamento o odore di bruciato.', 'Fai verificare dall''elettricista impianto di terra e quadri ogni anno.', 'Registra gli interventi e conserva la dichiarazione di conformità tra i documenti.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Impianto elettrico') and o.tipo = 'storico'
  and trim(o.descrizione) = '';

-- Antifurto · storico
update operazioni o set descrizione = 'Manutenzione dell''impianto antintrusione secondo la norma CEI 79-3: controllo almeno una volta l''anno (meglio due), verifica di sensori, sirene e batterie.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['Ogni mese prova inserimento e disinserimento e verifica che arrivino le notifiche.', 'Il tecnico controlla centrale, sensori, sirene e combinatore e annota l''intervento nel registro.', 'Verifica l''autonomia delle batterie di centrale e sirene; sostituiscile ogni 2–3 anni o come indica il costruttore.', 'Aggiorna codici e numeri da avvisare quando cambiano.', 'Registra l''intervento e allega il rapporto.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Antifurto') and o.tipo = 'storico'
  and trim(o.descrizione) = '';

-- Giardino · storico
update operazioni o set descrizione = 'Cura del giardino: taglio del prato, potature, irrigazione e preparazione stagionale per l''inverno in montagna.',
    passaggi = case when coalesce(array_length(o.passaggi, 1), 0) = 0 then ARRAY['In primavera riattiva l''irrigazione e controlla irrigatori e programmatore.', 'Da primavera ad autunno taglia il prato con regolarità e concima.', 'Pota siepi e alberi nel periodo adatto (fine inverno o fine estate).', 'Prima del gelo svuota l''impianto di irrigazione e chiudi i rubinetti esterni.', 'Registra gli interventi del giardiniere.']::text[] else o.passaggi end
from sezioni s where o.sezione_id = s.id and lower(trim(s.nome)) = lower('Giardino') and o.tipo = 'storico'
  and trim(o.descrizione) = '';

-- Operazioni ancora senza descrizione: manda questo elenco per completarle.
select s.nome as impianto, o.titolo as operazione, o.tipo
from operazioni o join sezioni s on s.id = o.sezione_id
where trim(o.descrizione) = ''
order by s.ordine, o.ordine;
