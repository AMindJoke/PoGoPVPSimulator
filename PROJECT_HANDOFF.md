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

> Ho letto `PROJECT_HANDOFF.md`: riparto da `main`, con Principle Registry al 100% e fallback ibrido allo 0%. Il Manual Mode mobile è nella fase di rifinitura, non di riscrittura. Dimmi se vuoi continuare con un dettaglio UI o tornare al confronto generale dei matchup.
