# Contrat mémoire, snapshot et contextes

Statut : `FIGE` — autorise l'implémentation I-04 après fermeture d'I-03.

Version du contrat : `memory-context/1`

Ce document résout AF-R08 et AF-R09 pour le lot I-04. Il fixe les unités de mémoire, les index reconstruisibles, les requêtes de rappel, le `TurnSnapshot`, les `RoleContextPack`, les budgets, les traces et l'obsolescence. Il ne branche aucun fournisseur IA réel.

## 1. Résultat attendu

I-04 doit permettre de construire, depuis une campagne persistée, un contexte court, sourcé et vérifiable pour un rôle donné.

Le module reçoit :

- un `campaignId`;
- une révision de campagne observée;
- une opération ou intention de tour;
- une scène ou un processus actif;
- une perspective demandée;
- une politique de contexte versionnée;
- un budget de contexte;
- des déclencheurs de rappel.

Il produit :

- un `TurnSnapshotV1` immuable;
- une ou plusieurs requêtes de rappel;
- des capsules de mémoire sourcées;
- un `RoleContextPackV1` par rôle demandé;
- une `ContextBuildTraceV1`;
- un statut d'obsolescence vérifiable au retour d'un consommateur.

Une erreur de budget, de visibilité, de source absente ou de dépendance obsolète produit un diagnostic structuré et aucun paquet présenté comme fiable.

## 2. Frontières d'autorité

La mémoire n'est pas une vérité parallèle. Elle indexe, condense ou rappelle des sources autoritaires :

- `CampaignRecord`;
- `AggregateRecord`;
- `EventRecord`;
- `CommitRecord`;
- `OperationRecord`;
- contenu lore épinglé;
- règles et décisions versionnées;
- futures interactions validées.

Une capsule, un résumé, un embedding, un score ou un paquet de contexte est dérivé. Sa suppression ne doit jamais supprimer la source, la causalité ou l'engagement.

Le snapshot est une photographie de lecture. Il ne mute rien. Le contexte est une projection temporaire. Il ne peut pas être réutilisé comme source d'un futur état métier.

## 3. AF-R08 — Mémoire

### 3.1 Références de source

```ts
type MemorySourceKindV1 =
  | "AGGREGATE"
  | "EVENT"
  | "COMMIT"
  | "OPERATION"
  | "CONTENT_ENTRY"
  | "LORE_FRAGMENT"
  | "RULE"
  | "ADJUDICATION"
  | "INTERACTION";

interface MemorySourceRefV1 {
  schemaVersion: 1;
  sourceKind: MemorySourceKindV1;
  sourceId: string;
  campaignId: string | null;
  ownerDomain: string;
  version: number | string;
  path: string | null;
  fingerprint: `sha256:${string}` | null;
}
```

`path` désigne le champ exact lorsque la mémoire provient d'une partie de payload. Un extrait sans `sourceRef` est invalide.

### 3.2 Unité de mémoire

```ts
type MemoryValidityV1 =
  | "CURRENT_TRUE"
  | "PAST_TRUE"
  | "SUPERSEDED"
  | "INVALIDATED"
  | "SUBJECTIVE_BELIEF"
  | "HYPOTHESIS"
  | "UNKNOWN";

type MemoryRecallCycleV1 = "ACTIVE" | "RELEVANT" | "DORMANT" | "ARCHIVED";

type MemoryVisibilityV1 =
  | "SYSTEM_ONLY"
  | "PLAYER_CHARACTER"
  | "PLAYER_META"
  | "ACTOR_SCOPED"
  | "DIAGNOSTIC";

interface MemoryUnitV1 {
  schemaVersion: 1;
  memoryId: string;
  campaignId: string;
  sourceRefs: MemorySourceRefV1[];
  unitType:
    | "FACT"
    | "EVENT_SUMMARY"
    | "ACTOR_MEMORY"
    | "RELATION"
    | "PLOT_COMMITMENT"
    | "LOCATION_STATE"
    | "ITEM_HISTORY"
    | "TRANSCRIPT_EXCERPT";
  validity: MemoryValidityV1;
  recallCycle: MemoryRecallCycleV1;
  visibility: MemoryVisibilityV1;
  actorScope: string[];
  anchors: MemoryAnchorV1[];
  importance: {
    systemic: number;
    narrative: number;
  };
  gameTimeRange: {
    from: number | null;
    to: number | null;
  };
  text: string;
  summary: string | null;
  supersedesMemoryIds: string[];
  supersededByMemoryId: string | null;
  createdByEventId: string | null;
}

interface MemoryAnchorV1 {
  kind: "ACTOR" | "LOCATION" | "ITEM" | "FACTION" | "PLOT" | "RULE" | "TOPIC" | "TIME" | "PROCESS";
  id: string;
  strength: "PRIMARY" | "SECONDARY";
}
```

Contraintes :

- `importance.systemic` et `importance.narrative` sont des entiers de 0 à 100;
- `actorScope` est vide sauf si `visibility` vaut `ACTOR_SCOPED`;
- une mémoire `SYSTEM_ONLY` ne peut jamais entrer dans un paquet `PLAYER_CHARACTER` ou `PLAYER_META`;
- `summary` est dérivé; `text` doit rester assez court pour être indexable mais ne remplace pas la source;
- une croyance ou hypothèse ne peut pas être promue en vérité sans événement ou commande propriétaire.

### 3.3 Index reconstruisible

```ts
interface MemoryIndexEntryV1 {
  schemaVersion: 1;
  indexId: string;
  campaignId: string;
  memoryId: string;
  sourceRefs: MemorySourceRefV1[];
  channel: "STRUCTURED" | "GRAPH" | "TEXT" | "SEMANTIC";
  keys: string[];
  visibility: MemoryVisibilityV1;
  actorScope: string[];
  recallCycle: MemoryRecallCycleV1;
  rootFingerprint: `sha256:${string}`;
  policyVersion: string;
}
```

Les index sont des caches. I-04 doit fournir un port permettant :

- reconstruire les index depuis sources et `MemoryUnitV1`;
- supprimer un index sans perdre de vérité;
- vérifier l'empreinte d'une entrée;
- isoler les secrets avant toute recherche joueur.

La recherche sémantique peut être absente dans l'implémentation initiale. Dans ce cas, les canaux structuré, graphe et texte doivent rester fonctionnels.

### 3.4 Requête de rappel

```ts
interface MemoryRecallQueryV1 {
  schemaVersion: 1;
  queryId: string;
  campaignId: string;
  baseCampaignRevision: number;
  perspective: ContextPerspectiveV1;
  purpose:
    | "RETURN_TO_PLACE"
    | "PLAYER_MENTION"
    | "ACTIVE_SCENE"
    | "PLOT_CONTINUITY"
    | "RULE_CONTEXT"
    | "DIAGNOSTIC";
  strongTriggers: MemoryTriggerV1[];
  secondaryTriggers: MemoryTriggerV1[];
  requiredSourceRefs: MemorySourceRefV1[];
  candidateBudget: {
    structured: number;
    graph: number;
    text: number;
    semantic: number;
  };
  outputBudgetUnits: number;
}

interface MemoryTriggerV1 {
  kind: "ACTOR" | "LOCATION" | "ITEM" | "FACTION" | "PLOT" | "TEXT" | "TOPIC" | "TIME" | "PROCESS";
  id: string | null;
  text: string | null;
  strength: "STRONG" | "SECONDARY";
}

type ContextPerspectiveV1 =
  | { kind: "SYSTEM_MJ" }
  | { kind: "PLAYER_CHARACTER"; actorId: string }
  | { kind: "PLAYER_META" }
  | { kind: "NPC"; actorId: string }
  | { kind: "DIAGNOSTIC" };
```

Le rappel retourne des candidats validés ou un diagnostic. Il ne fabrique jamais un souvenir.

### 3.5 Capsule de mémoire

```ts
interface MemoryCapsuleV1 {
  schemaVersion: 1;
  capsuleId: string;
  memoryIds: string[];
  sourceRefs: MemorySourceRefV1[];
  perspective: ContextPerspectiveV1;
  inclusionLevel:
    | "MANDATORY"
    | "STRUCTURED_DIRECT"
    | "CAUSAL_STRONG"
    | "TEXTUAL_ALIAS"
    | "SEMANTIC_VALIDATED"
    | "WEAK_SUGGESTION";
  reason: string;
  validity: MemoryValidityV1;
  certainty: "CONFIRMED" | "LIKELY" | "UNCERTAIN" | "FALSE_BELIEF" | "UNKNOWN";
  text: string;
  tokenEstimate: number;
}
```

Une capsule groupée doit conserver toutes ses sources. Regrouper plusieurs rumeurs ne crée pas un fait confirmé.

## 4. AF-R09 — Snapshot et contextes

### 4.1 Snapshot de tour

```ts
interface TurnSnapshotV1 {
  schemaVersion: 1;
  snapshotId: string;
  campaignId: string;
  turnId: string;
  operationId: string;
  baseCampaignRevision: number;
  capturedAt: string;
  gameTimeSecond: number;
  contentPackage: {
    packageId: string;
    packageVersion: number;
    rootFingerprint: `sha256:${string}`;
  };
  ruleset: {
    rulesetId: string;
    rulesetVersion: number;
    rootFingerprint: `sha256:${string}`;
  };
  sourceManifest: SnapshotSourceManifestEntryV1[];
  sections: {
    turnInput: SnapshotSectionV1 | null;
    sceneContinuity: SnapshotSectionV1 | null;
    worldFrame: SnapshotSectionV1;
    playerFrame: SnapshotSectionV1;
    actorRefs: SnapshotSectionV1;
    activeProcess: SnapshotSectionV1 | null;
    mandatoryConstraints: SnapshotSectionV1;
    retrievalSeeds: SnapshotSectionV1;
  };
  snapshotFingerprint: `sha256:${string}`;
}

interface SnapshotSourceManifestEntryV1 {
  sourceRef: MemorySourceRefV1;
  mode: "EMBEDDED" | "REFERENCED";
  maxVisibility: MemoryVisibilityV1;
}

interface SnapshotSectionV1 {
  schemaVersion: 1;
  sectionId: string;
  sourceRefs: MemorySourceRefV1[];
  payload: Record<string, unknown>;
  payloadFingerprint: `sha256:${string}`;
}
```

Le snapshot est immuable. Après commit, les conséquences passent par un résultat committé ou un nouveau snapshot.

### 4.2 Paquet de contexte de rôle

```ts
type ContextRoleV1 =
  | "intent_interpreter"
  | "mj_planner"
  | "player_expression_adapter"
  | "npc_performer"
  | "rules_adjudicator"
  | "coherence_critic"
  | "scene_writer"
  | "clarification_writer";

interface RoleContextPackV1 {
  schemaVersion: 1;
  packId: string;
  snapshotId: string;
  campaignId: string;
  role: ContextRoleV1;
  task: string;
  perspective: ContextPerspectiveV1;
  baseCampaignRevision: number;
  dependencyVersions: ContextDependencyV1[];
  creativeScope: CreativeScopeV1;
  budget: ContextBudgetV1;
  blocks: ContextBlockV1[];
  outputContractId: string;
  packFingerprint: `sha256:${string}`;
}

interface ContextDependencyV1 {
  sourceRef: MemorySourceRefV1;
  properties: string[];
}

interface ContextBlockV1 {
  blockId: string;
  blockKind:
    | "TURN_INPUT"
    | "SCENE"
    | "WORLD"
    | "PLAYER"
    | "ACTOR"
    | "PROCESS"
    | "CONSTRAINT"
    | "MEMORY_CAPSULE"
    | "COMMITTED_RESULT"
    | "REVEAL_ENVELOPE";
  sourceRefs: MemorySourceRefV1[];
  visibility: MemoryVisibilityV1;
  actorScope: string[];
  text: string;
  payload: Record<string, unknown>;
  tokenEstimate: number;
}
```

### 4.3 Permissions créatives

```ts
interface CreativeScopeV1 {
  mayCreate: string[];
  mayReference: string[];
  mayProposeCommands: string[];
  mayReveal: {
    reveal: string[];
    hint: string[];
    withhold: string[];
  };
  mustPreserve: string[];
  mustNotCreate: string[];
  mustNotModify: string[];
  noveltyConstraints: string[];
}
```

`withhold` contient seulement des identifiants opaques. Il ne transporte pas la vérité cachée brute.

### 4.4 Budget

```ts
interface ContextBudgetV1 {
  unit: "MODEL_TOKENS_ESTIMATE";
  maximum: number;
  reservedForInstructionsAndSchema: number;
  reservedForOutput: number;
  reservedForInput: number;
  reservedForMandatory: number;
  consumedByBlocks: number;
  remainingMargin: number;
  reductionStepsApplied: string[];
}
```

Le contrat impose l'ordre de réduction :

1. exemples stylistiques et ornements;
2. résumés dérivés redondants;
3. lore secondaire sans dépendance;
4. suggestions faibles;
5. capsules `DORMANT` puis `ARCHIVED` non obligatoires;
6. remplacement par références résolues si le rôle peut les résoudre avant appel.

Si le socle obligatoire dépasse le budget, le constructeur retourne `CONTEXT_BUDGET_EXCEEDED`. Il ne produit pas de paquet incomplet.

### 4.5 Trace et obsolescence

```ts
interface ContextBuildTraceV1 {
  schemaVersion: 1;
  traceId: string;
  packId: string;
  snapshotId: string;
  policyVersion: string;
  channelsUsed: Array<"STRUCTURED" | "GRAPH" | "TEXT" | "SEMANTIC">;
  included: TraceEntryV1[];
  excluded: TraceEntryV1[];
  condensed: TraceEntryV1[];
  budget: ContextBudgetV1;
  warnings: string[];
  traceFingerprint: `sha256:${string}`;
}

interface TraceEntryV1 {
  sourceRefs: MemorySourceRefV1[];
  reason: string;
  visibility: MemoryVisibilityV1;
  actorScope: string[];
  tokenEstimate: number;
}

type ContextStalenessStatusV1 =
  | "CURRENT"
  | "REPROJECT_REQUIRED"
  | "REVALIDATE_REQUIRED"
  | "STALE";
```

Au retour d'un consommateur, le contrôle compare uniquement les dépendances utiles. Un changement non lié ne doit pas invalider automatiquement tout le paquet. Un changement de scène, cible, autorité ou engagement critique le rend `STALE`.

## 5. Ports I-04

```ts
interface MemoryRepositoryV1 {
  upsertMemoryUnits(units: MemoryUnitV1[]): Promise<void>;
  queryMemory(query: MemoryRecallQueryV1): Promise<MemoryCapsuleV1[]>;
  rebuildIndexes(campaignId: string, policyVersion: string): Promise<MemoryIndexRebuildReportV1>;
}

interface TurnSnapshotBuilderV1 {
  buildSnapshot(input: BuildTurnSnapshotInputV1): Promise<TurnSnapshotV1>;
}

interface RoleContextBuilderV1 {
  buildRoleContext(input: BuildRoleContextInputV1): Promise<RoleContextPackV1>;
}
```

L'implémentation initiale peut être mémoire pure et IndexedDB si nécessaire, mais elle doit rester derrière ces ports. Aucun composant React, fournisseur IA, route serveur ou cache UI ne devient source d'autorité.

## 6. Preuves exigées pour fermer I-04

- NAR-ACC-004 : retrouver un souvenir par paraphrase avec source et sans voisins inutiles;
- NAR-ACC-005 : retour aux Archives après ellipse, état actuel prioritaire, différences perceptibles et secrets exclus;
- NAR-ACC-015 : budget réduit dans l'ordre prévu, puis erreur explicite si le socle obligatoire dépasse;
- perspective de NAR-ACC-006 : vérité cachée disponible au `system_mj` ciblé mais absente du paquet joueur;
- reconstruction d'index après suppression sans perte de vérité;
- même snapshot et même politique produisent les mêmes blocs obligatoires et empreintes;
- paquet `PLAYER_CHARACTER` refusant tout secret non appris;
- obsolescence `CURRENT`, `REPROJECT_REQUIRED`, `REVALIDATE_REQUIRED` et `STALE` couverte par fixtures;
- build global et suites I-00 à I-03 restent verts.

## 7. Hors périmètre I-04

- fournisseur IA réel;
- embeddings distants;
- certification de qualité de prose;
- UI de conversation;
- création dynamique de PNJ, intrigue ou lieu;
- moteur tactique et repos jouable;
- benchmark long NFR-ACC-001 complet;
- migration physique vers un stockage externe.

Ces exclusions n'empêchent pas de prévoir les ports. Elles empêchent I-04 de devenir le pipeline IA complet.
