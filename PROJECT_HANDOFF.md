# PoGoPVPSimulator — Handoff operativo

Questo documento serve a riprendere il progetto su un altro PC senza rileggere la conversazione precedente.

## Stato del repository

- Repository: `AMindJoke/PoGoPVPSimulator`
- Branch di lavoro e deploy: `main`
- Il deploy Vercel segue i push su `main`; l'utente verifica spesso anche dal telefono.
- Il simulatore locale usato dall'utente è normalmente `PogoPvp.html`.
- Il file applicativo principale è [`PogoPvp.html`](PogoPvp.html). Gran parte di UI, simulazione e Manual Mode vivono lì.
- Ultimo cambiamento applicativo prima di questo handoff: `092380f`.

## Come collaborare con Alessio

- Parlare in italiano, in modo diretto e concreto.
- Prima di usare strumenti, inviare un breve aggiornamento in `commentary`.
- Se una modifica è completata, testarla, committarla e pusharla su `main` salvo indicazione contraria.
- Dopo un commit/push, riportare hash e risultato in modo conciso.
- Non dichiarare che qualcosa è uguale a PvPoke se non è stato verificato; distinguere sempre ciò che è implementato da ciò che è solo ipotesi.
- Non nominare PvPoke nell'interfaccia utente o nei testi del Manual Mode.
- Preservare modifiche non correlate presenti nella worktree.

## Regola fondamentale del planner

Il **Principle Registry è il planner**. Il precedente hybrid planner è solo un fallback storico e il suo utilizzo runtime deve restare a `0%`.

- Migrazione attuale: `100%`.
- Hybrid fallback: `0%`.
- Ogni commit deve includere nel body:

  ```text
  Planner migration: 100% -> 100%; hybrid fallback: 0% -> 0%.
  ```

- Non aggiungere nuove feature, mapping o documentazione del planner se non riducono direttamente un eventuale uso del fallback. Questa eccezione non limita documenti di passaggio esplicitamente richiesti dall'utente.

## Manual Mode: comportamento già consolidato

- Modalità A manuale/B automatica, B manuale/A automatica o entrambi manuali; l'impostazione deve sopravvivere a cambio versione/branch.
- Original simulation e Current manual edit sono timeline distinte; l'originale è read-only.
- Undo/redo, branch, restart della timeline e Resume/Continue Automatically sono già presenti.
- Il restart ritorna all'inizio della timeline manuale; non deve cambiare silenziosamente modalità di controllo.
- Gli scudi del Manual Mode sono una risorsa della sessione manuale: non devono riportare al matchup automatico. Sono modificabili prima della prima azione e poi bloccati per non invalidare la timeline.
- Le decisioni scudo usano una dialog dedicata; nessun cambiamento alla battle logic è autorizzato da un lavoro solo UI.
- Hover su veloce/caricate nel Manual Mode mostra una preview non distruttiva del danno sulla barra HP avversaria.

## UI Manual Mode: stato recente

### Desktop

- HUD ampio con Pokémon ai lati e asse centrale più spazioso per VS, turn e phase.
- Barre HP più spesse/squadrate con il valore dentro.
- Selettori scudo grandi e viola, coerenti con quelli del simulatore automatico.

### Mobile

Il layout mobile del battle HUD è stato appena ristrutturato, non solo ritoccato:

1. Sprite + nome + typing per ciascun lato.
2. Barra HP su una riga trasversale del proprio lato.
3. Riga separata con le due orb delle caricate e valore `Energy`.
4. Selettore scudi sotto il lato corrispondente.
5. Colonna centrale leggera con asse verticale, VS, turn e phase.

Decisioni recenti da preservare:

- Anche il Pokémon B ha sprite, nome e typing allineati a sinistra, come A.
- Gli scudi mobili usano la stessa griglia delle corsie di battaglia, quindi devono essere centrati rispetto a barra HP e orb, non rispetto alla metà generica del contenitore.
- Non mostrare label ridondanti come `Pokémon A`, `Pokémon B` o `Shields` vicino ai selettori mobili.
- Non mettere una linea divisoria orizzontale tra HUD dei Pokémon e scudi mobili.

L'utente ha detto che questa area è "quasi" a posto: non avviare una nuova riscrittura senza prima osservare uno screenshot aggiornato o una richiesta precisa.

## Matchup e matrice: contesto importante

- La matrice deve usare il medesimo percorso canonico del simulatore; in passato cache/percorso divergente creava risultati diversi dalla timeline.
- I pareggi, inclusi i KO simultanei da Fast, devono apparire come draw anche nella matrice.
- I planner decision mismatch vanno affrontati come regole generali e verificabili, non con fix hard-coded sul singolo matchup/IV.
- Gestione buff/debuff self/opponent mantenuta dal simulatore: non sostituirla senza confronto esplicito.
- Se si torna sul planner, proporre prima un confronto riproducibile con una differenza di decisione concreta, poi identificare il principio generale mancante.

## Verifica standard

Runtime Node già usato su questo PC:

```powershell
$node='C:\Users\alinn\Downloads\Tools\node.exe'
@(
  'tools/test-manual-mode-model.js',
  'tools/test-manual-mode-legality.js',
  'tools/test-manual-mode-runtime.js',
  'tools/test-manual-mode-charged.js',
  'tools/test-manual-mode-timeline-editing.js',
  'tools/test-manual-mode-branching.js',
  'tools/test-manual-mode-import-export.js',
  'tools/test-manual-mode-snapshots.js',
  'tools/test-manual-mode-hybrid.js',
  'tools/test-manual-mode-ui-contract.js'
) | ForEach-Object {
  & $node $_
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
git diff --check
```

Sul PC di casa usare `node` se è nel PATH oppure aggiornare la variabile `$node` al percorso del runtime Node disponibile. Per piccole sole modifiche UI, almeno `tools/test-manual-mode-ui-contract.js` e `git diff --check` devono passare; per comportamento Manual Mode eseguire la suite completa.

## Git e deploy

Flusso normale concordato con l'utente:

```powershell
git add <file mirati>
git commit -m "Descrizione concisa" -m "Planner migration: 100% -> 100%; hybrid fallback: 0% -> 0%."
git push origin main
```

Prima di modificare, controllare sempre `git status --short`. Non usare reset distruttivi. Dopo il push, l'utente può avere bisogno di attendere il deploy Vercel o fare un hard refresh del browser mobile.

## Primo messaggio consigliato per riprendere

### Funzioni aggiunte il 1 ottobre 2026

- Team Builder: sezione `Opponent team` con roster separato, mosse/IV modificabili, caricamento dalla libreria e scudi indipendenti. Confronto fino a 36 matchup individuali, full HP e zero energia; ogni cella apre Battle con entrambi i build. Su mobile roster e risultati mantengono 3 righe da 2 card, con un avversario per pagina. Non è una simulazione di un incontro completo 3v3.
- Il draft avversario usa `pvpeak-opponent-team-v1`. Svuotare il roster offre `Undo clear`; la libreria può salvare e caricare anche squadre avversarie.
- Preferiti Pokémon condivisi nei selettori Battle/Team Builder: stelle e filtro Favorites, salvati in `pvpeak-pokemon-favorites-v1` sul dispositivo.
- Fast Count: `Practice mistakes` registra i nuovi errori in `pvpeak-fast-count-mistakes-v1`, ricrea mosse ed energia iniziale, esclude esercizi diventati incompatibili con i dati correnti e termina il ripasso quando recuperati. Le vecchie statistiche aggregate restano; non contenevano gli esercizi precedentemente sbagliati.
- Moduli: `src/team-builder/team-builder-opponent.js`, `src/ui/team-opponent.js/css`, `src/ui/pokemon-favorites.js/css`, `src/training/fast-count-practice.js`. Il motore di Battle resta invariato.
- Test aggiunti: `tools/test-team-opponent.js`, `tools/test-pokemon-favorites.js`, `tools/test-fast-count-practice.js`; estesa la parità Team Builder → Battle a 5 scenari scudi con build personalizzati su entrambi i lati.

### Preparazione del trio e confronto condiviso, 1 ottobre 2026

- `Opponent team` ora comprende `Your trio`: selezione manuale di 3 Pokémon, copertura e risposte di riserva contro il roster avversario, nomi senza una risposta vincente e pareggi distinti. La matrice conserva tutti i matchup e evidenzia le colonne selezionate. Mobile: 3 righe da 2.
- `Suggested trios` è chiuso inizialmente. Confronta fino a 20 combinazioni complete, ordinate per copertura vincente, risultato più debole, risposte di riserva e rating medio. Mostra le tre migliori. È analisi di matchup individuali, non una simulazione di incontro 3v3 o una scelta automatica dei ruoli.
- `Starting energy` consente 0–100 energia per ciascun lato, applicata a tutti i matchup del confronto. Le chiavi cache includono i valori non nulli; energia zero conserva le vecchie chiavi. Battle riceve gli stessi valori iniziali; motore e planner invariati.
- `Copy matchup link` conserva entrambe le squadre, mosse/IV, scudi indipendenti, energia, trio e stagione. Modulo `src/team-builder/team-matchup-share.js`, hash `teamMatchup`. Sono condivisibili anche i draft. Entrambe le squadre sono validate prima di applicarle; link errati mantengono il draft corrente.
- Trio ed energia persistono nello stesso `pvpeak-opponent-team-v1`, con zero energia e trio vuoto come default per i vecchi salvataggi. Sostituire/rimuovere un membro elimina dal trio solo il Pokémon non più presente.
- Test: `tools/test-team-matchup-share.js`; estesi `test-team-opponent.js` e `test-navigation-matchup-parity.js` (20 scenari avversario → Battle con mosse/IV personalizzati, 5 combinazioni di scudi e 4 combinazioni energetiche).

### Farm dopo una sconfitta, 1 ottobre 2026

- `Your trio` comprende `Farm after a loss`, chiuso inizialmente e disponibile con tre membri selezionati. Dopo aver preparato i matchup, `Check farm routes` calcola su richiesta i recuperi con ciascuno degli altri due compagni. Il riepilogo mostra fino a sei opportunità, dando precedenza ai farm sicuri; tutte le route e le condizioni iniziali sono apribili.
- Il primo matchup usa lo stesso percorso canonico di Battle. Dopo il KO, l'avversario conserva HP, energia, scudi, buff/debuff, forma e cooldown; il compagno entra con HP pieni, zero energia e gli scudi rimasti alla squadra. Gli attacchi pendenti diretti al Pokémon KO non vengono trasferiti al nuovo bersaglio. L'avversario resta in campo: non è una simulazione completa 3v3.
- Il compagno usa solo Fast attraverso il meccanismo esistente di azioni esplicite; l'avversario mantiene il planner canonico. `Safe farm` richiede un KO senza alcuna finestra legale di Charged avversaria. Sono distinti rischio di Charged, caricate effettivamente ricevute, farm fallito e risultato non risolto. Il riepilogo indica numero di Fast, energia accumulata e HP rimasti; i dettagli indicano anche gli scudi consumati. Il bottone Battle apre esplicitamente il primo matchup, non la continuazione con HP parziali.
- Il calcolo usa un worker dedicato, cancellabile e isolato da Battle/matrice. Cambiare trio, build o condizioni invalida il risultato e impedisce risposte tardive; cache in memoria limitata a 12 scenari. La classifica dei trii resta basata sulla copertura individuale già documentata.
- `tools/test-team-farm.js`: 21 scenari reali, trasferimento delle risorse, isolamento da simulazioni successive, cancellazione, risposte tardive, errore/retry e cache. Passate 20 suite pertinenti, inclusi parità navigazione, continuation isolation, contratti UI/PWA. Verifica browser desktop e mobile 360 px senza overflow o errori console. Cache applicativa v80.

### Costo, timeline e matchup successivo dopo il farm, 1 ottobre 2026

- Il riepilogo di ogni farm indica gli scudi consumati. Aprire la route mostra una mini timeline con due corsie, Fast risolte, caricate avversarie e scudi, ricavata dagli eventi canonici. Sono visibili HP/energia/scudi prima e dopo il recupero; gli attacchi pendenti o negati sono esclusi.
- Nelle route con un farmer sopravvissuto, `Use the energy · Next matchup` è chiuso inizialmente. Permette di scegliere un altro membro del roster avversario, escludendo quello già KO. Il farmer conserva HP, energia, scudi, buff/debuff, forma e cooldown; il nuovo avversario entra full HP/zero energia con gli scudi rimasti alla squadra. Entrambi possono usare caricate con il planner canonico.
- `After farm` è confrontato con `Fresh start`: stesso build originale del farmer e stessi scudi rimasti su entrambi i lati, ma farmer full HP/zero energia/buff iniziali. L'interfaccia mostra esito e HP/energia finali di entrambe le linee; non presume che l'energia accumulata migliori sempre il risultato. È una sequenza specifica con avversari che restano in campo, non un incontro completo 3v3 con switch.
- Il matchup successivo usa un worker dedicato su richiesta, annullabile; cambi di target/scenario invalidano le risposte tardive. Cache limitata a 36 risultati; apertura dei dettagli e selezione avversario vengono preservate durante il calcolo. Il pulsante Battle continua ad aprire esclusivamente il primo matchup.
- Estesi `tools/test-team-farm.js`: timeline coerente con Fast/caricate/scudi, 21 setup reali, 13 continuazioni riuscite, trasferimento di risorse e cooldown, confronto fresco, determinismo, cancellazione/cache/risposte tardive. Passate 7 suite pertinenti, inclusi parità navigazione e continuation isolation. Verifica browser desktop e mobile 360 px senza overflow/errori console. Cache v84.

### Riepilogo farm visivo, 1 ottobre 2026

- Le route usano sprite dell'avversario, Pokémon KO e farmer, freccia di ingresso e badge di sicurezza; HP/energia/scudi consumati sono tre valori distinti con barra HP e icone. Il numero di Fast e il nome della mossa restano visibili. Desktop: fino a tre card affiancate; mobile: una per riga. Il roster/trio mantiene la griglia mobile 3×2.
- Timeline con sprite nelle due corsie, caricate/scudi rappresentati da icone e HP finali con barre; il matchup successivo mostra il farmer contro lo sprite del target selezionato e due card di esito `After farm`/`Fresh start`, con barre HP e energia. L'energia di un Pokémon KO è mostrata come non utilizzabile, non come una risorsa conservata.
- Spiegazioni, condizioni di partenza e buff/debuff sono nei dettagli `Farm conditions`, `Matchup conditions` e `How it works`, chiusi inizialmente. Il riepilogo non contiene più paragrafi esplicativi; il pulsante inerte `Checked` è rimosso. Selettore target, calcolo, cache, annullamento e apertura Battle mantengono il comportamento precedente.
- Modifica di presentazione: motore, planner e calcoli invariati. Passati controllo sintassi JS e contratti UI Team Builder/presentazione/PWA. Verificati in browser desktop e mobile 360 px: sprite, assenza overflow, confronto Win/Loss, cambio target, cache e apertura persistente dei dettagli. Cache applicativa v87.


### Gerarchia e allineamenti del farm, 1 ottobre 2026

- La scena principale mostra farmer contro avversario sopravvissuto, con sprite e nomi allineati e HP iniziali (`Start`) su entrambi i lati. Il Pokémon KO resta un contesto secondario. Verdetto più evidente; farm con caricate evidenzia gli scudi effettivamente consumati, senza presentarli come un requisito garantito.
- Riepilogo con HP rimasti, energia e scudi usati; confronto successivo `After farm`/`Fresh start` con tre righe identiche HP/energia/scudi rimasti. Sprite, nomi, VS e risorse iniziali del nuovo matchup rispettano le stesse altezze.
- Il confronto fresco acquisisce anche lo stato finale degli scudi, tramite l'osservazione terminale già esistente. Nessuna modifica al planner o alla classifica dei trii. Dettagli delle condizioni chiusi inizialmente; nessuna nuova funzione di tap sugli eventi Charged.
- Passate suite farm (21 setup, 13 continuazioni), parità navigazione, continuation isolation, contratti UI Team Builder/presentazione/PWA/Manual Mode e controllo sintassi. Verificati desktop e mobile 360 px: nessun overflow/errori console, farm con consumo scudi, next matchup Win/Loss e cambio target. Cache v88.

### Farmer affiancati, caricate pronte e apertura dello stato reale, 1 ottobre 2026

- Le route sono raggruppate per lo stesso primo KO e avversario sopravvissuto: un'intestazione comune e i due farmer affiancati, anche su mobile. Sono visibili anche alternative fallite; il riepilogo iniziale mostra fino a tre gruppi con una route riuscita. Selezionare un farmer apre timeline e azioni sotto entrambe le card. Roster e trio conservano la griglia mobile 3×2.
- `Charged after farm` usa le mosse e l'energia del combatant realmente sopravvissuto, comprese le forme: `Ready` oppure `+N Fast`. Il conteggio indica solo l'energia necessaria; non garantisce che il farmer sopravviva o possa evitare una carica avversaria. Typing e nomi delle mosse seguono lo stile Meta/Quick Matchup.
- `Open farm in Battle` apre farmer e avversario con HP, energia, scudi, buff/debuff, forma e cooldown reali. Il farmer usa solo Fast, l'avversario il planner canonico. `Open next matchup in Battle` trasferisce lo stato del farmer contro il nuovo target, con caricate abilitate. Il primo matchup resta apribile separatamente.
- I link `tbFarm` contengono una ricetta validata, vincolata a stagione e versione del motore. Un worker dedicato ricostruisce gli stati attraverso le simulazioni canoniche; nessun combatant arbitrario viene importato dall'URL. Il caricamento è annullato da cambi di setup, con protezione da risposte tardive e timeout. `Copy Battle link` conserva la ricetta e le risorse iniziali dell'eventuale preview; `Use standard setup` rimuove contesto e vincolo Fast.
- Matrice, timeline e snapshot Manual Mode conservano il contesto del farm. Cache distinte dalle simulazioni ordinarie; il worker riceve anche cooldown iniziali e vincolo Fast sul solo lato A. Nessuna modifica alla classifica dei trii o al Principle Registry; migrazione 100%, fallback 0%.
- Nuovi moduli `src/team-builder/team-farm-battle-link.js` e `team-farm-presentation.js`; test `tools/test-team-farm-links.js` e `test-team-farm-battle-ui.js`. Suite farm estesa a 27 setup reali, 23 sconfitte eleggibili e 13 continuazioni, con parità dei replay e casi di cambio forma. Passate suite pertinenti di navigazione, isolamento, UI/PWA, cache offline e l'intera suite Manual Mode. Verificati desktop e mobile 360 px senza overflow; replay farm e successivo coerenti con il riepilogo. Cache applicativa v92.
- Limite di verifica preesistente: `tools/test-special-form-mechanics.js:69` attende danno 52 per Aegislash e riceve 47. Riprodotto identico anche leggendo `PogoPvp.html` da HEAD precedente alle modifiche. Il motore non è stato alterato per correggere quel test; i nuovi replay con forme sono verificati separatamente.

### Ruoli e alternative di trio contro il roster avversario, 1 ottobre 2026

- `Suggested trios` contiene `Find roles & trios`: analisi su richiesta di tutti i build presenti contro tutti gli avversari, a HP pieni/zero energia. Non eredita gli eventuali bonus energetici della matrice ordinaria. Lead: 1–1 e 2–2; switch: 0–0/1–1/2–2 con ritardo di reazione avversario 0–4 turni (default 2); closer: 0–0 e 1–0. Due turni non sono due Fast né un bonus energetico: entrambi sono in campo e il counter comincia ad agire più tardi. Durate, impatti pendenti e decisioni seguono il motore canonico. È uno scenario di risposta, non una simulazione completa dello switch tra due avversari diversi.
- Vittorie/pareggi/sconfitte/risultati non risolti sono distinti. `Even spend` indica non aver consumato più scudi dell'avversario, distinto dagli scudi pari alla partenza; le classifiche mostrano anche quanti matchup restano imbattuti senza maggiore consumo. Ogni avversario ha pari peso, senza probabilità di lead inventate.
- Fino a 120 ordini dei 20 trii. Tre alternative distinte: `Balanced`, `Switch resilience`, `Shield closer`; copertura a 1–1, qualità delle risposte, resa nei ruoli, lead negativi non coperti dallo switch, dipendenza da una singola risposta e debolezze condivise contribuiscono ai confronti, senza un punteggio opaco unico. Gli ordini con molti lead negativi non vengono premiati solo perché hanno più recuperi.
- Riepilogo: tre sprite Lead/Switch/Closer, resa nelle condizioni indicate, recuperi del lead e avversari senza risposta o con una sola risposta. `Why & matchups` contiene motivazioni verificabili e matchup cliccabili. `Best Pokémon by role` confronta tutti i membri nei diversi scenari, con risultati separati per numero di scudi. Selezione del trio evidenziata; ordine dei ruoli conservato nell'ordine dei `trioIds` già condivisi/salvati. La matrice ordinaria e i suoi suggerimenti di copertura restano disponibili prima della nuova analisi.
- Le sconfitte del lead a 1–1 vengono osservate con la funzione farm già esistente: nei dettagli possono comparire farm sicuri con zero scudi aggiuntivi, energia e HP rimasti, solo con un compagno presente nel trio. Queste opportunità non determinano la classifica e non modificano la sezione farm esistente.
- Worker dedicato e cancellabile, timeout per job, invalidazione su build/stagione/condizioni/ritardo, protezione da risposte tardive, cache di sei analisi complete. Le sette condizioni per ciascun matchup vengono riutilizzate tra i trii; ritardo zero deduplica quelle equivalenti. I farm dei matchup non persi vengono saltati. Il lavoro non blocca la UI.
- Battle link: campo facoltativo validato `reactionDelayTurns` (0–4). Timeline, matrice, snapshot Manual Mode e `Copy Battle link` conservano il ritardo; `Use standard setup` o una modifica al setup lo eliminano. I link farm rifiutano un primo matchup con questo campo non nullo perché la loro ricetta non lo supporta. Nessuna modifica al Principle Registry: migrazione 100%, fallback 0%.
- Moduli `team-builder-roles.js`, `team-role-analysis.js`, `src/ui/team-roles.js/css`; suite `tools/test-team-roles.js`: classifiche con ruoli distinti, pareggi ad alto rating, scudi consumati, dipendenze, alternative, risultati parziali, cancellazione/cache/retry, 24 confronti canonici con Fast di durate diverse e import/copia link Battle. Passate anche parità navigazione, farm (27 setup/13 continuazioni), contratti UI/PWA, cache offline e suite completa Manual Mode. Verifica browser desktop/mobile 360 px e replay dello switch. Cache v97 (asset con versioni specifiche v94/v95/v96/v97).

### Verifica e rifinitura delle funzioni esistenti, 2 ottobre 2026

- Nessuna nuova feature: audit di ruoli/trii, farm, apertura Battle, libreria/condivisione, preferiti e ripasso Fast Count. Il modello ruoli passa a `roles-v2`.
- Affidabilità dello switch: intersezione degli stessi avversari imbattuti a 0–0, 1–1 e 2–2, senza usare più scudi. Non è il minimo di tre conteggi con avversari diversi. Questo dato precede il numero massimo di sconfitte nella classifica Switch resilience; contribuisce anche a Balanced e Shield closer. Pareggi inclusi solo nell'imbattibilità, mai nelle vittorie. La tabella Best Pokémon by role usa lo stesso criterio.
- Card: Switch indica il conteggio imbattuto con pari consumo; Lead conserva le vittorie a 1–1 e Closer a 1–0. Nei dettagli risultati visivi divisi per scudi, eccezioni dello switch con sprite, vittorie guadagnate dal ritardo solo se presenti e label del ruolo/condizioni su ogni riga dei matchup. Le sconfitte del lead non risolte dallo switch restano visibili anche quando altre sono coperte. I vecchi suggerimenti di copertura sono nascosti durante il nuovo calcolo.
- Mobile 360 px: matchup dei ruoli in tre colonne/due righe per membro, senza scroll laterale, bersagli 82×48 px nel caso verificato. Roster e picker trio mantengono 3×2. Desktop conserva tre alternative affiancate. Le condizioni scudi/energia del confronto ordinario compaiono vicino alla copertura del trio per distinguere quella dai suggerimenti a zero energia.
- Cache ruoli: firma include slot proprio e avversario oltre a build/stagione/motore. Evitato riuso di risultati assegnati a vecchie posizioni. Il roster Meta statico è preinstallato nella cache offline, disponibile anche prima della prima visita al Team Builder; test con provider reale e rete assente.
- Passate 18 suite pertinenti: roles, opponent, matchup share, farm, farm links, farm Battle UI, navigation parity, favorites, Fast Count practice, Team Builder UI, presentation UI, PWA, service-worker cache, Manual Mode UI, team library, library export, meta provider e analysis. Estesi casi di avversari diversi tra gli scenari, ranking con consumo scudi, lead coperti/scoperti e spostamento degli slot. Sintassi JS e diff mirato verificati. Resta il limite preesistente del test Aegislash documentato sopra; nessuna modifica al motore/planner/farm.
- Browser: annullamento/riavvio, selezione trio, cambio ritardo e cache, dettaglio dei ruoli, assenza overflow/errori/immagini mancanti a 360 px e desktop. Clodsire contro Mimikyu a 1–1/+2 aperto in Battle: Clodsire KO, Mimikyu 45 HP/2 energia, coerente con l'eccezione. Nel roster di prova Mimikyu switch vince 6/6 a 1–1/+2 ma resta affidabile nei tre scenari con pari consumo contro 2/6; Clodsire 5/6. Draft originale Melmetal/Mimikyu/Altaria, scudi 2–1 ed energia 20/8 ripristinato. Cache applicativa v100; runtime locale riavviato sulla porta 8772.

### Suggested trios e contesto avversario, 2 ottobre 2026

- Risolta l'ambiguità di `unbeaten · even spend`: il valore principale Switch mostra vittorie a 1–1 con il ritardo selezionato; la consistenza è un conteggio distinto degli stessi avversari contro cui vince/pareggia senza scudi extra in tutti gli scenari 0–0, 1–1 e 2–2. Sei sprite con ✓/! mostrano subito quali avversari soddisfano il criterio. Anche Best Pokémon by role usa etichette esplicite. Lead-loss recovery e unica risposta diventano sequenze di sprite e frecce.
- Nuovo `team-opponent-context.js`: simula i ruoli anche invertendo i roster, con Pokémon avversari reali a sinistra e propri a destra, scudi/energia/ritardo canonici. Con sei membri considera 20 insiemi distinti avversari e conserva le tre opzioni più forti secondo i criteri sul roster completo. Sono ipotesi del modello, senza probabilità di scelta. I suggerimenti propri danno priorità alla copertura minima contro queste tre opzioni, poi al criterio di ruolo (Balanced/Switch/Closer), infine ai criteri originali sul roster completo. Nessuna simulazione integrale 3v3.
- Nei dettagli: risultati contro le tre opzioni; risposta avversaria più forte al trio selezionato, ricercata tra tutti gli insiemi avversari a 1–1; hard counter (sconfitta con rating ≤250), risposte forti nel proprio roster (vittoria con rating ≥751) e presenza nelle opzioni del modello. Il counter resta disponibile anche se molti propri Pokémon lo battono. La risposta più forte è un controllo separato, non un'ulteriore probabilità o fattore nascosto del ranking.
- Vecchi suggerimenti solo copertura: sprite/nome dei tre membri, `opponents answered` e `with two or more answers`; tolto il numero opaco weakest. Ruoli non assegnati dichiarati esplicitamente. Farm, motore e planner invariati. `roles-v3`, cache applicativa v103; worker annullabile, risposte tardive scartate, cache completa limitata a sei condizioni.
- Passate 12 suite: roles (24 scenari canonici), opponent context, opponent, matchup share, farm (27 setup/13 continuazioni), farm links, farm Battle UI, navigation parity, Team Builder UI, presentation UI, PWA, service-worker cache. Verifica browser desktop e 360 px: due roster, opzioni/dettagli, selezione condizioni, annullamento/cache, sprite caricati, nessun overflow e matchup da 81.7×48 px. Test iniziale ha mostrato un errore di avvio non riprodotto nei successivi caricamenti puliti; aggiunta diagnostica della creazione/invio worker e mantenuto Retry.
- Caso riprodotto con le mosse/IV propri forniti da Alessio (Empoleon/Florges/Ninetales Shadow/Sableye Shadow/Vigoroth/Altaria) e build di riferimento dei sei avversari indicati; il link fornito era `team`, non `teamMatchup`, quindi mosse/IV avversari non confermati. Con ritardo 2: Altaria vince 5/6 a 1–1 ma consistenza 0/6; Florges 6/6 vittorie a 1–1 e consistenza 5/6. Questi valori non sono una replica esatta degli screenshot avversari. Preview separata su 8773, draft utente su 8772 preservato.

### Risposta allo stesso lead con energia accumulata, 2 ottobre 2026

- Corretto il collegamento Lead → Against → Switch wins: non usa più il matchup contro un counter fresco ritardato. Nuovo scenario `stay1`, 1–1, entrambi a HP pieni, nostro Pokémon a zero energia e avversario con l'energia di una sua Fast, senza ritardo di reazione. È un controllo conservativo sull'energia, non una simulazione della sequenza iniziale: niente danno del lead, Fast parziali o cooldown trasferiti. Non affermare recupero garantito nella partita reale.
- `recovery`, `uncoveredLead` e relativo spareggio `unrecovered` ora dipendono da questo controllo anche nel ranking dei trii propri/avversari. Solo vittorie effettive entrano nella freccia; pareggi e risultati parziali non sostituiscono la verifica. Scenari di ruolo Switch/+reaction restano riferiti a un nuovo counter fresco e sono etichettati `wins vs counter` / `Counter · 0/1/2 shields`.
- `applyScenario` condiviso dal coordinatore e dal lancio Battle: la stessa Fast del foe fornisce l'energia, senza consumare scudi o inventare danno. Cache separata tramite `:foe-fast-energy`, modello `roles-v4`; UI mostra `Energy check · foe +1 Fast · 1–1` e le eccezioni, con quarta riga nei matchup `Switch · foe stays` apribile in Battle. Cache applicativa v104.
- Nel caso di riferimento Altaria/Florges, Florges avversario viene escluso dai recuperi (Stunfisk resta). Replay reale del mirror: A energia iniziale 0, B 9, ritardo 0; A KO, B 42 HP/4 energia, coerente con il risultato del controllo. Il nuovo counter fresco a +2 turni produce invece una vittoria del nostro Florges: i due casi sono distinti.
- Passate 12 suite pertinenti. Estesi test ruoli: 4 controlli reali di energia con Fast diverse, inversione del mirror, parità con Battle e link, distinzione cache, indipendenza dal ritardo, pareggio ad alto rating, risultato mancante, job su entrambi i roster. Verifica browser desktop/mobile 360 px senza overflow/errori/immagini mancanti; quarta riga matchup con bersagli 81.7×48 px, roster 3×2 preservato. Nessun cambiamento a motore, planner o farm.

> Ho letto `PROJECT_HANDOFF.md`: riparto da `main`, con Principle Registry al 100% e fallback ibrido allo 0%. Il Manual Mode mobile è nella fase di rifinitura, non di riscrittura. Dimmi se vuoi continuare con un dettaglio UI o tornare al confronto generale dei matchup.

### Leggibilità e verifica di tutti i trii avversari, 2 ottobre 2026

- Modello `roles-v5`: ogni trio ordinato proprio viene confrontato con tutti gli insiemi avversari distinti (20 con sei Pokémon), riutilizzando i matchup già simulati. Le tre opzioni visualizzate sono esempi, non l'intero campo valutato e non probabilità di scelta.
- Ordine dei suggerimenti: copertura vincente minima su tutti i trii a 1–1; minore numero massimo di propri membri esposti a una risposta avversaria forte; criterio del ruolo (Balanced: minimo dei tre ruoli, Switch: consistenza, Closer: vittorie a 1–0); forza della risposta avversaria e criteri originali. Forte richiede esito vincente e rating almeno 751 nelle simulazioni con roster invertito. Nessuna stima di vittoria in un game completo; HP/energia di apertura e forme seguono gli scenari già documentati.
- Schede: vittorie e icona scudi distinti, closer esplicitamente con +1 scudo; punto forte, switch affidabile con sei sprite, recuperi verificati con foe +1 Fast, eccezioni e risposte uniche. Stessi Pokémon con ruoli diversi sono etichettati. Testo principale a 12 px; dettagli divisi in Role matchups, Why this trio / opponent replies e Conditions & results. Selezionare un trio conserva le disclosure aperte. Su desktop sono riservati spazi coerenti per le annotazioni; su mobile gli spazi vuoti sono rimossi.
- Recheck matchups ora invalida e ricalcola solo il piano avversario interamente già pronto. Prima riproponeva la cache senza rifare nulla. I piani parziali conservano i risultati validi e ripartono dai mancanti; altre cache restano disponibili. Nel browser di prova una vecchia cache di tutti pareggi è stata ricalcolata correttamente (6/6 coperti, 5/6 backup nel trio originale).
- Test: 13 suite pertinenti passate (roles, opponent context, builder analysis, opponent, matchup share, navigation parity, builder UI, presentation UI, PWA, service worker cache, farm, farm links, farm Battle UI). Caso nuovo con counter escluso dalle tre opzioni mostrate: tutte le 20 combinazioni abbassano la consistenza e cambiano realmente il suggerimento; pareggi ad alto rating non diventano risposte vincenti. Test del recheck: ricalcolo completo, ripresa parziale, persistenza dell'invalidazione, conservazione dei risultati estranei.
- Browser: fixture con mosse/IV propri dal link utente e build avversari di riferimento; desktop e mobile 360 px senza overflow o sprite mancanti, bersagli matchup circa 82×48 px, griglie roster/trio 3×2, selezione e disclosure coerenti. Mirror Florges con foe 9 energia aperto in Battle: proprio KO, avversario 42 HP/4 energia; esito coerente. Nessuna modifica al motore, al planner o alla logica del farm. Migrazione 100%, fallback 0%. Cache applicativa v107.

### Scudi viola nelle schede ruolo, 2 ottobre 2026

- Le condizioni dei ruoli riutilizzano lo stesso `shieldSvg()` esagonale di Battle e della matrice, con viola #b245c5 e dimensione 18×18 px. I numeri scudi e gli scenari restano gli stessi; modifica di presentazione. Cache v108.
- Verifica sintassi e contratti UI Team Builder/presentazione/PWA; controllo visivo desktop e mobile 360 px.
