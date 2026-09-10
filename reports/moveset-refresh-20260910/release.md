# Aggiornamento mosse del 10 settembre 2026

## Risultati

| Pokemon | Set principale | Score standard | Score contro Smart | Rank aggiornato |
|---|---|---:|---:|---:|
| Rillaboom | Scratch / Earth Power / Drum Beating | 513 | 513 | 140 |
| Vigoroth | Scratch / Brick Break / Rock Slide | 546 | 523 | 11 |
| Vigoroth Shadow | Scratch / Brick Break / Rock Slide | 533 | 517 | 35 |

Con Scratch, Body Slam + Rock Slide totalizza rispettivamente 500 e 503 contro
Smart per Vigoroth normale e Shadow. Il vantaggio del nuovo set quindi resiste
al confronto completo contro Smart, pur essendo minore rispetto alla baseline.
Rillaboom con Drum Beating + Frenzy Plant totalizza 506 contro Smart.

Smart e' un controllo di sensibilita' e un criterio di scelta dei set, non una
prova di gioco ottimale. Il ranking mantiene la precedente policy standard per
tutti i Pokemon: non sono stati mescolati score prodotti da policy differenti.
Nessun incremento artificiale dei pesi o delle posizioni. Rillaboom migliora ma
rimane fuori dalla top100 con questi pesi.

## Aggiornamento coerente

- 27.720 nuove celle, entrambe le direzioni e confronti fra i tre set aggiornati.
- 7.128.666 celle aggregate per ranking e dettagli; 1.542 specie senza duplicati.
- Default e statistiche delle mosse allineati ai set selezionati.
- Alternative visibili nelle schede, senza nuove righe o peso aggiuntivo.
- Cache locali aggiornate; celle sostituite archiviate localmente per rollback.
- Versione PWA `2026-09-10-v34-scratch-movesets`.

## Verifiche

Dataset VALID; test di pubblicazione, moveset-refresh, cache-score-parity,
bootstrap della stagione, season-generation, PWA e selezione per durata superati.
Controllo browser: set principali, alternative, nessun errore console.
Layout mobile della sezione alternative controllato e separato dagli stili
della riga principale.

## Prossimo lavoro

Estendere l'audit dei default ad altre mosse aggiornate. Valutare separatamente
la policy degli scudi e il rischio di farm-down, senza concludere che Smart
sia sempre ottimale. Aggiornare eventualmente la top100 di riferimento solo
dopo questi confronti, mantenendo questa pubblicazione come baseline.
