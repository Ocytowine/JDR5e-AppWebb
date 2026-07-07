# Contrat handoffs tactique et repos

Statut : `FIGE`

Version : `tactical-rest-handoff/1`

Lot : I-07

Date : 2026-07-07

## Objectif

I-07 ouvre la frontière entre narration, tactique et repos sans donner à la narration l'autorité de résoudre ces domaines.

Le contrat couvre deux familles de processus longs :

- tactique : combat, confrontation, fuite, capture, reddition ou objectif nécessitant le plateau;
- repos : repos court, repos long ou pause mécanique segmentée avec choix, risques et bénéfices.

La règle structurante est :

```text
La narration déclenche et reprend.
Le domaine propriétaire résout.
Le noyau persiste et intègre une seule fois.
```

## Décision sur les routes historiques

La route historique `POST /api/narration` reste un prototype tactique textuel existant. Elle ne devient pas le contrat I-07.

Raisons :

- elle produit du texte, pas un `TacticalOutcome` typé;
- elle ne porte pas d'identités de campagne, versions d'agrégats, clé d'idempotence ou statut de processus;
- elle peut servir à résumer un combat existant, mais pas à appliquer des conséquences de campagne;
- elle mélange rendu et résultat, alors qu'I-07 exige `seed -> process -> outcome -> integration -> render`.

I-07 peut adapter le plateau tactique existant derrière un port, mais le contrat narratif ne doit jamais dépendre directement de `GameBoard.tsx`, de `localStorage` ou des routes tactiques IA historiques.

## Concepts communs

### `ProcessHandoffV1`

Un handoff est une suspension contrôlée de la scène narrative.

Champs conceptuels obligatoires :

- `processId`;
- `campaignId`;
- `sourceOperationId`;
- `sourceSceneId`;
- `processKind`: `TACTICAL_ENCOUNTER` ou `REST`;
- `status`: `PROPOSED`, `ACTIVE`, `SUSPENDED`, `COMPLETED_PENDING_INTEGRATION`, `INTEGRATED`, `FAILED`;
- `createdAtGameSecond`;
- `sourceRefs`;
- `idempotencyKey`;
- `version`.

Un handoff ne crée pas une branche chronologique. Il appartient à la même campagne linéaire.

### `ProcessCheckpointV1`

Un checkpoint sert uniquement à la reprise technique.

Il contient :

- `checkpointId`;
- `processId`;
- dernier événement ou tour appliqué;
- état minimal propriétaire;
- empreinte de l'état;
- horodatage technique;
- références sources.

Il n'est jamais présenté comme sauvegarde sélectionnable au joueur.

### `ProcessOutcomeV1`

Un outcome est le résultat final du processus propriétaire. Il est produit une fois, puis intégré de manière idempotente.

Champs communs :

- `outcomeId`;
- `processId`;
- `campaignId`;
- `sourceOperationId`;
- `status`: `COMPLETED`, `ABORTED`, `INTERRUPTED`, `FAILED`;
- `elapsedGameSeconds`;
- `domainDeltas`;
- `eventDrafts`;
- `narrativeProjection`;
- `uiNotifications`;
- `memoryCandidates`;
- `sourceRefs`;
- `finalStateFingerprint`;
- `integrationIdempotencyKey`;
- `version`.

L'outcome ne remplace pas les agrégats de campagne. Chaque propriétaire valide et applique uniquement ses deltas.

## Handoff tactique

### Déclenchement

La narration demande un handoff tactique lorsque la situation exige au moins un des éléments suivants :

- initiative ou tours;
- positions, portée, vision, couverture ou terrain;
- actions répétées ou réactions;
- gestion fine des ressources, PV, conditions ou munitions;
- objectif tactique mesurable;
- risque d'incapacité, mort, capture, fuite ou reddition;
- hostilités simultanées entre plusieurs acteurs.

Un conflit verbal, une menace ou une violence brève ne déclenchent pas automatiquement le tactique si une résolution narrative bornée suffit.

### `TacticalEncounterSeedV1`

Le seed tactique est une projection d'entrée. Il ne contient pas les agrégats complets.

Champs minimaux :

- `seedId`;
- `processId`;
- `campaignId`;
- `sceneId`;
- `locationRef`;
- `startedAtGameSecond`;
- `rulesetRef`;
- `cause`;
- `stakes`;
- `objectives`;
- `participants`;
- `teams`;
- `tacticalMapRef` ou `mapGenerationRequest`;
- `entryZones`;
- `exitZones`;
- `knownTerrain`;
- `lightingAndVisibility`;
- `weatherAndHazards`;
- `initialPositions`;
- `surpriseState`;
- `allowedEndConditions`;
- `sourceAggregateRefs`;
- `seedFingerprint`.

Chaque participant référence une projection tactique recalculée depuis la campagne : statistiques, actions, ressources, équipement accessible, conditions et apparence. Le plateau ne reçoit pas l'agrégat personnage complet.

### Pendant la session

Le domaine tactique possède l'état transitoire de combat.

Il peut écrire des checkpoints de processus. Il ne modifie pas directement :

- PV de campagne;
- inventaire;
- position mondiale;
- relations;
- connaissances;
- événements narratifs persistants.

Ces conséquences restent dans le journal tactique puis sortent dans `TacticalOutcomeV1`.

### `TacticalOutcomeV1`

Champs obligatoires :

- journal ordonné des tours et événements significatifs;
- état final des participants;
- PV, blessures, morts, incapacités et conditions;
- ressources, sorts, munitions, objets consommés ou endommagés;
- positions finales et séparation éventuelle;
- fuite, reddition, capture, objectif atteint ou retrait;
- temps exact écoulé;
- dommages persistants au lieu;
- paroles engageantes ou connaissances acquises pendant la session;
- butin disponible sans transfert automatique;
- candidats de conséquences sociales, mondiales et narratives;
- références de checkpoints et empreinte finale.

L'intégration d'un outcome tactique doit être idempotente. Si elle échoue après la fin du combat, le processus passe à `COMPLETED_PENDING_INTEGRATION`; le combat ne peut pas être rejoué.

## Handoff repos

### Déclenchement

Un repos mécanique commence seulement sur intention explicite ou décision validée par le ruleset.

Ne déclenchent pas un repos mécanique :

- question méta;
- pause descriptive;
- attente hors jeu;
- simple phrase d'ambiance;
- discussion sur les règles.

### `RestSeedV1`

Champs minimaux :

- `seedId`;
- `processId`;
- `campaignId`;
- `sceneId`;
- `locationRef`;
- `restKind`: `SHORT_REST`, `LONG_REST` ou valeur ruleset maison;
- `startedAtGameSecond`;
- `targetDurationSeconds`;
- `rulesetRef`;
- `participants`;
- `safetyProfile`;
- `availableSupplies`;
- `availableActivities`;
- `watchPlan`;
- `riskSources`;
- `nearbyWorldEvents`;
- `requiredQuestions`;
- `sourceAggregateRefs`;
- `seedFingerprint`.

Les questions au joueur sont dérivées des règles : garde, soins, ressources de récupération, préparation, activité, consommation ou arbitrage entre bénéfices incompatibles.

L'IA peut formuler ces questions dans le flux narratif. Elle ne crée pas de bénéfice mécanique absent.

### Segmentation

Un repos progresse par segments.

Chaque segment peut :

- avancer l'horloge;
- déclencher la simulation mondiale nécessaire;
- consommer les ressources prévues;
- résoudre une activité;
- vérifier une interruption avec graine stable;
- produire un checkpoint.

Une interruption conserve les segments déjà committés. Elle ne transforme pas automatiquement le repos en succès total ou échec total.

### `RestOutcomeV1`

Champs obligatoires :

- statut final : `COMPLETED`, `PARTIAL`, `INTERRUPTED`, `FAILED`;
- temps exact écoulé;
- bénéfices acquis, refusés ou encore possibles;
- PV, fatigue, conditions et ressources modifiés;
- consommations de nourriture, eau, objets ou charges;
- activités accomplies;
- hygiène ou présentation modifiée si applicable;
- événements et conversations vécus;
- conséquences du monde pendant la période;
- raison d'interruption le cas échéant;
- références de règles appliquées;
- empreinte finale.

Les domaines personnage, inventaire, monde, social et mémoire valident leurs propres deltas avant commit coordonné.

## Signaux UI de repos

Le popup de repos est autorisé uniquement comme signal dérivé d'événements committés.

Événements attendus :

- `rest_started`;
- `rest_completed`;
- `rest_interrupted`;
- `rest_failed`.

Contraintes :

- le popup ne contient pas de choix mécanique;
- il ne remplace pas la narration;
- il possède un texte et un repère visuel, la couleur seule étant insuffisante;
- son affichage ne fait pas avancer le temps;
- son contenu doit aussi rester reconstructible dans le fil ou le journal d'interface.

## Intégration des conséquences

L'intégration d'un outcome suit toujours :

```text
ProcessOutcome existant
  -> validation des deltas par domaines propriétaires
  -> commit atomique
  -> passage du process à INTEGRATED
  -> nouveau snapshot narratif
  -> rendu de continuation
```

Le commit d'intégration doit écrire au minimum :

- l'état du processus intégré;
- les événements de résultat;
- les agrégats modifiés par propriétaires;
- l'horloge si du temps s'est écoulé;
- les notifications UI dérivées;
- la clé d'idempotence d'intégration.

Un retry de la même intégration retourne le commit existant.

## États de reprise

| État | Reprise |
|---|---|
| `PROPOSED` | revalider le déclenchement depuis l'état courant |
| `ACTIVE` | reprendre depuis le dernier checkpoint |
| `SUSPENDED` | attendre la décision ou le domaine bloquant |
| `COMPLETED_PENDING_INTEGRATION` | intégrer le même outcome, sans rejouer |
| `INTEGRATED` | restaurer la scène de continuation existante |
| `FAILED` | produire diagnostic et restitution sans mutation cachée |

## Frontières d'implémentation I-07

I-07A peut implémenter :

- types et validateurs `tactical-rest-handoff/1`;
- seeds et outcomes déterministes en fixtures;
- enregistrement d'un processus actif;
- intégration idempotente d'un outcome simulé;
- preuves NAR-ACC-011 et NAR-ACC-012 au niveau contractuel;
- signaux UI de repos comme projections dérivées.

I-07A ne doit pas encore implémenter :

- combat complet dans `GameBoard`;
- IA tactique complète;
- génération de carte tactique automatique;
- repos complet avec toutes les règles de classe;
- progression de personnage;
- butin automatique;
- lecteur UX avancé des checkpoints;
- remplacement global des routes historiques.

Les adaptations du plateau et du moteur de repos peuvent venir en sous-lots suivants, derrière ce contrat.

## Tests obligatoires avant fermeture du premier sous-lot

Le premier sous-lot d'implémentation doit prouver :

- handoff tactique produit un seed typé sans résoudre le combat;
- outcome tactique simulé s'intègre une seule fois;
- retry d'intégration ne double ni dégâts, ni ressources, ni temps;
- panne post-combat avant intégration laisse `COMPLETED_PENDING_INTEGRATION`;
- repos démarre uniquement sur intention explicite;
- `rest_started` et fin/interruption proviennent d'événements committés;
- bénéfice de repos non atteint par durée ou interruption n'est pas accordé;
- aucun appel direct à `/api/narration`, `GameBoard.tsx` ou `localStorage` n'est requis par le module narration.
