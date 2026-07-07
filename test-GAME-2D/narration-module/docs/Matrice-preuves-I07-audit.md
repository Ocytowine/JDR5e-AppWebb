# Matrice de preuves I-07 audit — tactique et repos

Date : 2026-07-07

Contrat figé :

- [`Contrat-handoffs-tactique-repos.md`](Contrat-handoffs-tactique-repos.md), version `tactical-rest-handoff/1`

Statut : `AUDIT_TERMINE`

## Synthèse

L'audit I-07 résout les blocages AF-R13 et AF-R14 au niveau contractuel :

- AF-R13 : tactique — décision sur `/api/narration`, schémas de handoff et outcome;
- AF-R14 : repos — schémas de processus, checkpoints et événements UI.

Décision principale :

```text
La route historique /api/narration ne devient pas le contrat tactique du module narration.
```

I-07 s'appuie sur des processus typés :

```text
seed -> process/checkpoints -> outcome -> intégration idempotente -> scène de continuation
```

## Preuves documentaires

| Risque | Décision | Document |
|---|---|---|
| Texte tactique pris comme résultat métier | `/api/narration` reste historique et non autoritaire | `Contrat-handoffs-tactique-repos.md` |
| Combat rejoué après panne | état `COMPLETED_PENDING_INTEGRATION` et intégration idempotente | `Contrat-handoffs-tactique-repos.md` |
| Narration qui applique dégâts/ressources | outcome validé par domaines propriétaires | `Contrat-handoffs-tactique-repos.md` |
| Repos accordé par prose | repos segmenté, bénéfices issus des règles et événements committés | `Contrat-handoffs-tactique-repos.md` |
| Popup de repos trompeur | signal UI dérivé de `rest_started`, `rest_completed`, `rest_interrupted` ou `rest_failed` | `Contrat-handoffs-tactique-repos.md` |
| Checkpoint assimilé à sauvegarde joueur | checkpoint réservé à la reprise technique | `Contrat-handoffs-tactique-repos.md` |

## Autorisation limitée

Le prochain sous-lot autorisé est `I-07A`.

Il couvre uniquement :

- types et validateurs `tactical-rest-handoff/1`;
- fixtures déterministes de seed/outcome tactique;
- fixtures déterministes de seed/outcome repos;
- persistance d'un processus actif;
- intégration idempotente d'un outcome simulé;
- preuves contractuelles NAR-ACC-011 et NAR-ACC-012.

Il n'autorise pas :

- combat jouable complet;
- adaptation profonde de `GameBoard.tsx`;
- IA tactique complète;
- génération automatique de carte tactique;
- repos complet avec toutes les règles de classe;
- progression de personnage;
- butin automatique;
- remplacement global des routes historiques;
- UX finale des checkpoints.

## Gate de fermeture attendue pour I-07A

Commandes ou preuves attendues :

```powershell
npm run narration-module:build
npm run narration-module:test:contracts
npm run narration-module:test:indexeddb
npm run build
```

Un script dédié devra être ajouté, par exemple :

```powershell
npm run narration-module:test:tactical-rest-handoff
```

Il devra prouver au minimum :

- seed tactique valide sans résolution du combat;
- outcome tactique simulé intégré une seule fois;
- retry d'intégration sans double conséquence;
- état `COMPLETED_PENDING_INTEGRATION` après panne d'intégration;
- repos déclenché uniquement par intention explicite;
- `rest_started` et fin/interruption issus d'événements committés;
- bénéfice de repos non atteint refusé;
- absence de dépendance directe à `/api/narration`, `GameBoard.tsx` ou `localStorage`.

## Impact sur le plan

I-07 est ouvert uniquement comme contrat et sous-lot I-07A.

Les sous-lots ultérieurs pourront traiter :

1. adaptation progressive du plateau tactique réel;
2. module repos complet;
3. retour narratif enrichi après outcome réel;
4. intégration UX des signaux et diagnostics;
5. certification verticale NAR-ACC-011/012 dans le parcours complet.
