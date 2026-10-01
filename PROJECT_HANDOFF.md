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

> Ho letto `PROJECT_HANDOFF.md`: riparto da `main`, con Principle Registry al 100% e fallback ibrido allo 0%. Il Manual Mode mobile è nella fase di rifinitura, non di riscrittura. Dimmi se vuoi continuare con un dettaglio UI o tornare al confronto generale dei matchup.
