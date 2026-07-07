# Contrat contrôleur de tour narratif applicatif

Statut : `FIGE` pour le sous-lot I-06D.

Version : `narrative-turn-controller/1`.

Date : 2026-07-07.

## Objectif

Ce contrat fixe le premier contrôleur applicatif entre la saisie libre de la surface narration et le noyau de campagne.

I-06D ne résout pas encore une action de jeu. Il prouve la chaîne sûre :

```text
saisie libre
  -> OperationRecord durable
  -> réponse NO_COMMIT_RESPONSE
  -> DisplayPacketV1
  -> surface narration
```

## Périmètre autorisé I-06D

I-06D peut produire :

- un contrôleur TypeScript pur;
- un bootstrap de campagne prototype en mémoire;
- réception idempotente d'une saisie libre;
- complétion sans commit métier;
- `DisplayPacketV1` de réception;
- intégration de ce contrôleur à `NarrativeAppSurface`;
- tests de non-avance temporelle, idempotence et séparation tactique.

I-06D n'autorise pas :

- appel IA;
- interprétation d'intention;
- résolution sociale, règle, temps ou inventaire;
- commit métier;
- mutation d'agrégat autre que le bootstrap campagne;
- handoff tactique;
- stockage durable IndexedDB;
- route HTTP.

## Entrée

```ts
interface NarrativeTurnInputV1 {
  schemaVersion: 1;
  clientRequestId: string;
  rawInput: string;
}
```

`rawInput` reste une donnée non fiable. Le contrôleur ne déduit pas encore action, parole ou méta. Il enregistre seulement la demande.

## Repository

Le contrôleur utilise `CampaignRepository`.

Pour le prototype applicatif, il peut créer une campagne en mémoire avec :

- contenu `prototype.narration`;
- ruleset `prototype.rules`;
- calendrier `prototype.calendar`;
- horloge à `0`.

Cette campagne prototype ne prétend pas être une campagne joueur importée depuis I-02.

## Opération

Chaque saisie produit ou retrouve une opération :

- `operationKind`: `narrative.turn.input`;
- `requestPayloadSchemaVersion`: `1`;
- `requestPayload.rawInput`: texte exact reçu;
- `requestPayload.noGameTime`: `true`;
- `requestPayload.prototypeOnly`: `true`.

La même `clientRequestId` et le même texte retournent la même opération. Le même `clientRequestId` avec un texte différent doit produire un conflit d'idempotence.

## Résultat

La complétion utilise `NO_COMMIT_RESPONSE`.

Le résultat contient :

- `DisplayPacketV1`;
- `operationId`;
- `clientRequestId`;
- `noCommit: true`;
- `noGameTime: true`.

Le paquet affiché doit clairement indiquer qu'aucune résolution, aucun temps et aucun appel IA n'ont été déclenchés.

## Preuves minimales de sortie I-06D

La fermeture d'I-06D exige :

- saisie libre reçue comme opération durable;
- résultat `NO_COMMIT_RESPONSE`;
- même demande idempotente;
- conflit si même idempotence avec texte différent;
- horloge inchangée;
- `NarrativeAppSurface` utilise le contrôleur sans réseau ni stockage local;
- build global réussi.

## Décision

`narrative-turn-controller/1` autorise uniquement le contrôleur applicatif prototype sans commit métier. Le prochain sous-lot devra auditer l'interprétation d'intention et les clarifications réelles avant toute résolution narrative.
