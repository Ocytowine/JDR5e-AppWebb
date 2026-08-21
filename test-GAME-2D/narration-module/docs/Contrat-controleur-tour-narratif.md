# Contrat contrôleur de tour narratif applicatif

Statut : `ACTIF_ETENDU`. Le numéro de contrat reste
`narrative-turn-controller/1`; les restrictions I-06D ci-dessous sont
conservées comme historique du socle initial et ne décrivent plus le runtime
complet.

Version : `narrative-turn-controller/1`.

Date : 2026-07-07.

## Contrat actif

Le contrôleur reçoit toujours une `NarrativeTurnInputV1` libre et non fiable,
mais il orchestre désormais :

```text
opération idempotente
→ interprétation V6 ou fallback diagnostiqué
→ routage local autoritaire
→ planner MJ non autoritaire
→ propriétaire métier ou arrêt explicite
→ performer PNJ conditionnel
→ résultat et projection de rendu persistables
```

Avant chaque interprétation, il fournit la scène visible, les référents
publics, la projection minimale `interpreter-character-context/1`, les focus et
tours sémantiques récents ainsi que `interpreter-runtime-context/1`. La
projection personnage est relue depuis les agrégats courants ; elle n'est pas
une copie mémorisée de la fiche. Une garde locale transforme un alias personnage
encore ambigu en clarification sans commit ni temps de jeu.
`restoreRenderedThread()` reconstruit aussi les cinq derniers tours sémantiques
depuis les opérations `narrative.turn.input` complétées. La reprise du fil et la
reprise du contexte de compréhension forment donc une même frontière
applicative.

Le contrôleur n'accorde aucune autorité supplémentaire à l'IA. Les commits, le
temps, les règles, les secrets, les handoffs et les mutations restent validés
par le registre et les domaines propriétaires.

## Objectif historique I-06D

Ce contrat fixe le premier contrôleur applicatif entre la saisie libre de la surface narration et le noyau de campagne.

I-06D ne résout pas encore une action de jeu. Il prouve la chaîne sûre :

```text
saisie libre
  -> OperationRecord durable
  -> réponse NO_COMMIT_RESPONSE
  -> DisplayPacketV1
  -> surface narration
```

## Périmètre historique I-06D

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

## Décision historique

I-06D autorisait uniquement le contrôleur applicatif prototype sans commit
métier. Cette restriction a été levée par les lots ultérieurs sans changer le
numéro du contrat enveloppe ; elle ne doit plus être interprétée comme l'état
du build principal.
