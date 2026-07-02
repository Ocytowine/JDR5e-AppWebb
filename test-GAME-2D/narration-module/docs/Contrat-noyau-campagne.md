# Contrat figé du noyau de campagne

Statut : `FIGE` — contrat normatif du premier lot d'implémentation, version `campaign-core/1`.

## Objet

Définir le plus petit noyau persistant capable de recevoir une opération, garantir son unicité, committer atomiquement commandes, agrégats, événements et outbox, puis reprendre après une issue inconnue.

Ce contrat est indépendant de React, IndexedDB, d'un fournisseur IA et des domaines narratifs concrets. Toute implémentation du premier lot doit le respecter avant d'ajouter une capacité métier.

## Portée du premier lot

Le premier lot implémente uniquement :

- types et validateurs du présent contrat;
- cycle d'une opération;
- contrôle optimiste des révisions;
- écrivain logique et fencing token;
- commit atomique et idempotent;
- journal ordonné de commandes et événements;
- agrégats enveloppés et versionnés;
- horloge minimale comme agrégat propriétaire du `WorldDomain`;
- outbox post-commit idempotente;
- port `CampaignRepository`;
- `MemoryCampaignRepository` et tests contractuels communs.

Sont explicitement exclus : IndexedDB, wiki, import de personnage, règles de jeu, mémoire narrative, contexte IA, fournisseur IA, scène, interface, carte, tactique, repos et créations dynamiques.

## Vocabulaire normatif

`DOIT`, `INTERDIT` et `NE PEUT PAS` sont normatifs. Un champ non déclaré est rejeté, sauf dans un objet `extensions` explicitement prévu. Une valeur `undefined`, `NaN`, infinie, une fonction ou une référence cyclique n'est jamais une valeur JSON valide.

## Types primitifs

```text
JsonScalar = null | boolean | string | finite number
JsonValue  = JsonScalar | JsonValue[] | { [key: string]: JsonValue }
JsonObject = { [key: string]: JsonValue }
Revision   = integer in [0, Number.MAX_SAFE_INTEGER]
GameSecond = integer in [0, Number.MAX_SAFE_INTEGER]
UtcInstant = RFC 3339 UTC string with millisecond precision
```

Les durées et ordres métier n'utilisent jamais `UtcInstant`. Le temps réel sert aux diagnostics, délais techniques et leases; `GameSecond` sert à la chronologie fictionnelle.

## Identifiants opaques

Un identifiant persistant :

- est une chaîne ASCII de 3 à 128 caractères;
- respecte `^[a-z][a-z0-9._:-]{2,127}$`;
- reste stable pendant toute la vie de l'objet;
- n'est jamais réutilisé après suppression ou archivage;
- ne fournit aucun ordre métier par sa forme.

Les générateurs de production utilisent un préfixe de type et une composante aléatoire résistante aux collisions. Les tests injectent un `IdGenerator` déterministe. TypeScript emploie des types marqués distincts pour empêcher de confondre `CampaignId`, `OperationId`, `CommandId`, `EventId`, `CommitId`, `AggregateId`, `TaskId`, `RequestId`, `IdempotencyKey`, `WriterId`, `WorkerId` et `IncidentId`.

Les identifiants lisibles des exemples existants restent acceptables s'ils respectent le motif. Aucun code ne parse leur préfixe pour déterminer leur type.

## Versionnement

Tous les enregistrements persistants du noyau portent :

```text
schemaVersion: 1
```

Une enveloppe de transport ou de domaine porte en plus un identifiant de contrat :

```text
contractId: namespaced lowercase string
contractVersion: positive integer
```

Une version inconnue est rejetée en écriture. Une migration travaille sur une copie et ne remplace la source qu'après validation complète.

## Bornes physiques de sécurité

La taille est mesurée sur la représentation JSON canonique UTF-8 :

- `requestPayload` : 256 Kio maximum;
- `resultPayload` : 1 Mio maximum;
- `CoreError.details` : 64 Kio maximum;
- chaque payload de commande, événement ou tâche : 256 Kio maximum;
- chaque payload d'agrégat : 2 Mio maximum;
- un `CommitRequest` complet : 8 Mio maximum;
- 1 024 commandes, événements, écritures d'agrégats ou tâches au maximum par collection de commit.

Un adaptateur peut imposer une limite inférieure documentée, jamais une limite supérieure sans nouvelle version de contrat. Un dépassement produit `VALIDATION_FAILED` avant toute écriture.

## Empreinte canonique d'une requête

`requestFingerprint` possède la forme `sha256:` suivie de 64 caractères hexadécimaux minuscules. Il est calculé sur la représentation JSON canonique de la demande initiale : clés d'objet triées lexicographiquement, ordre des tableaux conservé, encodage UTF-8 et valeurs non JSON interdites.

Une même `idempotencyKey` avec une empreinte différente produit `IDEMPOTENCY_CONFLICT`. Une retransmission avec la même clé et la même empreinte retrouve l'opération existante.

## CampaignRecord

```text
CampaignRecord
  schemaVersion: 1
  campaignId: CampaignId
  campaignRevision: Revision
  status: ACTIVE | READ_ONLY
  clockAggregateId: AggregateId
  dependencies:
    contentPackageId: string
    contentPackageVersion: positive integer
    rulesetId: string
    rulesetVersion: positive integer
    calendarId: string
    calendarVersion: positive integer
  writeBlock: null | {
    code: CAMPAIGN_INTEGRITY_FAILURE | MANUAL_LOCK
    incidentId: null | IncidentId
  }
  lastCommitId: null | CommitId
  createdAt: UtcInstant
  updatedAt: UtcInstant
```

Une campagne commence à la révision `0`. Chaque commit réussi l'incrémente exactement de `1`. `READ_ONLY` interdit toute nouvelle opération en écriture mais autorise lecture et export.

## AggregateRecord

```text
AggregateRecord
  schemaVersion: 1
  campaignId: CampaignId
  aggregateType: namespaced lowercase string
  aggregateId: AggregateId
  aggregateRevision: Revision
  payloadSchemaVersion: positive integer
  payload: JsonObject
  updatedByCommitId: null | CommitId
```

Le noyau garantit enveloppe, version et concurrence. Le domaine propriétaire valide le contenu de `payload` avant le commit.

La création attend `expectedAggregateRevision: null` et produit la révision `0`. Une mise à jour attend la révision courante et produit exactement la suivante. Une écriture aveugle est interdite.

`updatedByCommitId` peut être nul uniquement pour l'horloge créée atomiquement par le bootstrap de campagne. Toute autre création ou mise à jour d'agrégat référence son commit.

## CampaignClockPayload

L'agrégat référencé par `clockAggregateId` est unique dans la campagne :

```text
aggregateType: world.clock
payloadSchemaVersion: 1
payload:
  elapsedGameSeconds: GameSecond
  calendarId: string
  calendarVersion: positive integer
```

`elapsedGameSeconds` ne diminue jamais. Le repository vérifie cette monotonie, mais seul le futur `WorldDomain` pourra proposer sa modification. Le temps réel, les retries et les opérations sans commit ne le modifient pas.

## OperationRecord

```text
OperationRecord
  schemaVersion: 1
  operationId: OperationId
  campaignId: CampaignId
  clientRequestId: RequestId
  idempotencyKey: IdempotencyKey
  requestFingerprint: string
  operationKind: namespaced lowercase string
  requestPayloadSchemaVersion: positive integer
  requestPayload: JsonObject
  phase:
    RECEIVED
    | PREPARING
    | READY_TO_COMMIT
    | COMMITTED_PENDING_RENDER
    | COMPLETED
    | SUSPENDED
    | FAILED
    | STALE
    | CANCELLED
  observedCampaignRevision: Revision
  commitId: null | CommitId
  completionMode: null | COMMITTED_RENDERED | COMMITTED_DEGRADED | NO_COMMIT_RESPONSE
  resultPayloadSchemaVersion: null | positive integer
  resultPayload: null | JsonObject
  failure: null | CoreError
  receivedAt: UtcInstant
  updatedAt: UtcInstant
```

### Transitions autorisées

```text
RECEIVED -> PREPARING | CANCELLED
PREPARING -> READY_TO_COMMIT | SUSPENDED | FAILED | STALE | CANCELLED
SUSPENDED -> PREPARING | CANCELLED
READY_TO_COMMIT -> COMMITTED_PENDING_RENDER | FAILED | STALE | CANCELLED
COMMITTED_PENDING_RENDER -> COMPLETED
RECEIVED | PREPARING -> COMPLETED avec NO_COMMIT_RESPONSE
```

`COMPLETED`, `FAILED`, `STALE` et `CANCELLED` sont terminaux. Après commit, l'opération ne peut devenir ni `FAILED`, ni `STALE`, ni `CANCELLED`.

Une campagne possède au plus une opération principale dans une phase non terminale. Une nouvelle identité reçoit `CAMPAIGN_BUSY`; une retransmission avec la même idempotencyKey rejoint l'opération existante.

`requestPayload` est la demande durable nécessaire à une reprise; elle reste une donnée non fiable sans autorité métier. Son empreinte couvre au minimum `operationKind`, sa version et son contenu canonique.

`commitId` est non nul uniquement dans `COMMITTED_PENDING_RENDER` ou dans `COMPLETED` avec un mode committé. `failure` est non nul uniquement pour `FAILED`. Une clarification utilise `SUSPENDED` et ne contient aucune mutation.

Les deux champs de résultat sont soit tous deux nuls, soit tous deux renseignés. Ils ne sont renseignés que dans `COMPLETED`. Le résultat est une restitution ou projection non autoritaire et déjà filtrée pour son destinataire : il ne peut ajouter aucun fait, événement, commande ou mutation absent d'un commit, ni contenir diagnostic privé ou secret MJ. Pour `NO_COMMIT_RESPONSE`, il contient uniquement la réponse à l'opération sans effet.

## AcceptedCommandRecord

Seules les commandes validées par leur domaine entrent dans un commit :

```text
AcceptedCommandRecord
  schemaVersion: 1
  contractId: namespaced lowercase string
  contractVersion: positive integer
  commandId: CommandId
  campaignId: CampaignId
  operationId: OperationId
  commitId: CommitId
  commandType: namespaced lowercase string
  target:
    aggregateType: namespaced lowercase string
    aggregateId: AggregateId
    expectedAggregateRevision: null | Revision
  payloadSchemaVersion: positive integer
  payload: JsonObject
  acceptedAtGameSecond: GameSecond
```

Une proposition IA n'est pas une commande acceptée. Après validation, le domaine produit un `AcceptedCommandDraft`; le repository le transforme en `AcceptedCommandRecord` uniquement dans le commit réussi.

## EventRecord

```text
EventRecord
  schemaVersion: 1
  eventId: EventId
  campaignId: CampaignId
  commitId: CommitId
  operationId: OperationId
  eventType: namespaced lowercase string
  origin:
    PLAYER_INTENT
    | RULE
    | WORLD_SIMULATION
    | AI_PROPOSAL
    | PROCESS
    | SCHEDULED_EFFECT
    | SYSTEM
  causation:
    kind: COMMAND | EVENT | OPERATION
    id: opaque identifier
  aggregateRefs: non-empty array of {
    aggregateType: namespaced lowercase string
    aggregateId: AggregateId
    aggregateRevision: Revision
  }
  visibility:
    scope: SYSTEM | MJ_PRIVATE | PLAYER_VISIBLE | ACTOR_SCOPED
    actorIds: string[]
  occurredAtGameSecond: GameSecond
  recordedAt: UtcInstant
  commitSequence: positive integer
  eventSequence: non-negative integer
  payloadSchemaVersion: positive integer
  payload: JsonObject
```

Pour `ACTOR_SCOPED`, `actorIds` est non vide; pour les autres scopes, il est vide. `recordedAt` ne départage jamais deux événements. L'ordre total est `(commitSequence, eventSequence)`.

`AI_PROPOSAL` indique l'origine d'une proposition validée; il ne donne aucune autorité supplémentaire à l'IA.

### EventDraft

Un `EventDraft` possède exactement les champs d'`EventRecord`, sauf `commitId`, `recordedAt`, `commitSequence` et `eventSequence`, attribués par le repository. Ses `aggregateRefs` portent les révisions qui résulteront du commit.

## OutboxTaskRecord

```text
OutboxTaskRecord
  schemaVersion: 1
  taskId: TaskId
  campaignId: CampaignId
  commitId: CommitId
  taskType: namespaced lowercase string
  sourceEventIds: non-empty EventId[]
  status: PENDING | RUNNING | COMPLETED | FAILED_RETRYABLE | FAILED_FINAL
  attemptCount: non-negative integer
  lockedBy: null | WorkerId
  leaseExpiresAt: null | UtcInstant
  nextAttemptAt: null | UtcInstant
  lastError: null | CoreError
  payloadSchemaVersion: positive integer
  payload: JsonObject
  createdAt: UtcInstant
  updatedAt: UtcInstant
```

La création de la tâche appartient au commit source. Son exécution est au moins une fois et son consommateur doit être idempotent. Elle ne produit jamais à nouveau l'événement source.

### OutboxTaskDraft

```text
OutboxTaskDraft
  schemaVersion: 1
  taskId: TaskId
  taskType: namespaced lowercase string
  sourceEventIds: non-empty EventId[]
  payloadSchemaVersion: positive integer
  payload: JsonObject
```

Le repository ajoute campagne, commit, statut `PENDING`, `attemptCount: 0`, champs de lease nuls et timestamps.

Une tâche `PENDING` ou `FAILED_RETRYABLE` arrivée à `nextAttemptAt` peut être réclamée. La réclamation la place en `RUNNING`, renseigne worker et expiration, puis incrémente `attemptCount`. Une tâche `RUNNING` dont le lease a expiré peut être réclamée à nouveau. Seul le worker détenteur du lease courant peut la terminer ou l'échouer.

`failOutboxTask` utilise `FAILED_RETRYABLE` et un `retryAt` non nul lorsque `error.retry` autorise une reprise; sinon il utilise `FAILED_FINAL` avec `retryAt: null`. Terminaison et échec libèrent le lease.

## CommitRecord

```text
CommitRecord
  schemaVersion: 1
  commitId: CommitId
  campaignId: CampaignId
  operationId: OperationId
  idempotencyKey: IdempotencyKey
  requestFingerprint: string
  previousCampaignRevision: Revision
  campaignRevision: Revision
  commitSequence: positive integer
  commandIds: CommandId[]
  eventIds: non-empty EventId[]
  aggregateWrites: non-empty array of {
    aggregateType: string
    aggregateId: AggregateId
    previousRevision: null | Revision
    aggregateRevision: Revision
  }
  outboxTaskIds: TaskId[]
  committedAt: UtcInstant
```

`campaignRevision = previousCampaignRevision + 1`. Un commit sans événement ou sans écriture d'agrégat est interdit. Une opération sans mutation se termine avec `NO_COMMIT_RESPONSE` et ne crée pas de `CommitRecord`.

Dans `campaign-core/1`, `commitSequence` est égal à `campaignRevision`. Il n'existe pas de second compteur d'ordre concurrent.

## WriterLease

```text
WriterLease
  campaignId: CampaignId
  writerId: WriterId
  fencingToken: positive integer
  acquiredAt: UtcInstant
  expiresAt: UtcInstant
```

Chaque nouveau lease accepté reçoit un token strictement supérieur au précédent. Le commit vérifie writer, token et expiration. Un token ancien produit `STALE_FENCING_TOKEN`, même si l'appelant croit encore posséder un verrou UI.

L'expiration du lease repose sur le temps réel et ne modifie pas l'horloge de campagne.

Le repository, et non l'appelant, évalue acquisition et expiration à partir de son horloge technique injectée.

## CommitRequest et atomicité

```text
CommitRequest
  campaignId: CampaignId
  operationId: OperationId
  commitId: CommitId
  idempotencyKey: IdempotencyKey
  requestFingerprint: string
  expectedCampaignRevision: Revision
  writerLease: WriterLease
  acceptedCommands: AcceptedCommandDraft[]
  aggregateWrites: non-empty array of {
    aggregateType: string
    aggregateId: AggregateId
    expectedAggregateRevision: null | Revision
    payloadSchemaVersion: positive integer
    payload: JsonObject
  }
  events: non-empty EventDraft[]
  outboxTasks: OutboxTaskDraft[]
```

Un `AcceptedCommandDraft` possède exactement les champs d'`AcceptedCommandRecord`, sans `commitId`. Le repository lui ajoute le `commitId` de la demande. En conséquence, `AcceptedCommandRecord` persistant porte aussi `commitId: CommitId`.

Dans une seule transaction, le repository :

1. vérifie campagne, opération, idempotencyKey et empreinte;
2. recherche un commit existant et le retourne immédiatement si l'empreinte correspond;
3. pour un nouveau commit seulement, vérifie statut de campagne, phase, lease et fencing token;
4. vérifie révision de campagne et révisions d'agrégats;
5. vérifie identifiants, schémas, références et monotonie de l'horloge;
6. écrit commandes, agrégats, événements, outbox et commit;
7. incrémente la révision de campagne;
8. place l'opération en `COMMITTED_PENDING_RENDER`.

Une erreur avant la fin n'écrit rien. Une retransmission identique retourne le `CommitRecord` existant même si le lease d'origine a expiré; elle n'autorise aucune nouvelle écriture. Une issue inconnue est résolue par lecture de l'idempotencyKey, jamais par création d'une nouvelle identité.

## CoreError

```text
CoreError
  code:
    NOT_FOUND
    | ALREADY_EXISTS
    | VALIDATION_FAILED
    | INVALID_TRANSITION
    | CAMPAIGN_BUSY
    | CAMPAIGN_READ_ONLY
    | STALE_VERSION
    | STALE_FENCING_TOKEN
    | IDEMPOTENCY_CONFLICT
    | PERSISTENCE_FAILURE
    | CAMPAIGN_INTEGRITY_FAILURE
  category: VALIDATION | CONCURRENCY | PERSISTENCE | INTEGRITY
  retry: NEVER | SAME_REQUEST | AFTER_REFRESH
  messageKey: namespaced lowercase string
  details: JsonObject
  incidentId: null | IncidentId
```

`details` ne contient ni secret, ni stack trace, ni payload complet. Une exception d'adaptateur est convertie en `PERSISTENCE_FAILURE` ou `CAMPAIGN_INTEGRITY_FAILURE`; elle n'est pas présentée comme un résultat métier valide.

## Résultat explicite

Toutes les méthodes du port retournent :

```text
Result<T> = { ok: true, value: T } | { ok: false, error: CoreError }
```

`NOT_FOUND`, conflit et échec ne sont jamais représentés par `null`, une chaîne vide ou un HTTP 200 contenant un message d'erreur textuel.

## Port CampaignRepository

Le port expose conceptuellement les opérations suivantes; les noms TypeScript pourront suivre les conventions du dépôt sans changer leurs préconditions :

```text
createCampaign(record, initialClockPayload) -> Result<CampaignRecord>
getCampaign(campaignId) -> Result<CampaignRecord>
setCampaignReadOnly(campaignId, writeBlock) -> Result<CampaignRecord>

acquireWriterLease(campaignId, writerId, ttlMs) -> Result<WriterLease>
releaseWriterLease(lease) -> Result<void>

receiveOperation(record) -> Result<OperationRecord>
getOperation(operationId) -> Result<OperationRecord>
getOperationByIdempotencyKey(campaignId, idempotencyKey) -> Result<OperationRecord>
transitionOperation(operationId, expectedPhase, nextPhase, patch) -> Result<OperationRecord>
completeWithoutCommit(operationId, resultSchemaVersion, resultPayload) -> Result<OperationRecord>
completePresentation(operationId, COMMITTED_RENDERED | COMMITTED_DEGRADED, resultSchemaVersion, resultPayload) -> Result<OperationRecord>

getAggregate(campaignId, aggregateType, aggregateId) -> Result<AggregateRecord>
commit(request) -> Result<CommitRecord>
getCommit(commitId) -> Result<CommitRecord>
getCommitByIdempotencyKey(campaignId, idempotencyKey) -> Result<CommitRecord>
listEvents(campaignId, after: null | { commitSequence, eventSequence }, limit) -> Result<EventRecord[]>
claimOutboxTasks(campaignId, workerId, limit, leaseMs) -> Result<OutboxTaskRecord[]>
completeOutboxTask(taskId, workerId) -> Result<OutboxTaskRecord>
failOutboxTask(taskId, workerId, error, retryAt) -> Result<OutboxTaskRecord>
```

`createCampaign` crée atomiquement la campagne à la révision `0` et son unique agrégat `world.clock` à la révision `0`, avec `updatedByCommitId: null`. Aucun autre agrégat n'est autorisé dans ce bootstrap.

`setCampaignReadOnly` est une protection technique idempotente : elle ne modifie ni `campaignRevision`, ni horloge, ni agrégat métier, conserve un `incidentId` lorsqu'il existe et ne peut pas réactiver une campagne. La levée d'un verrou relève d'un futur outil de réparation ou de migration explicite.

Le bootstrap est la seule création d'agrégat métier hors `CommitRecord`. Les transitions d'opération, de lease, d'outbox et le verrou de lecture seule sont des écritures techniques de coordination explicitement autorisées; elles ne peuvent modifier aucun agrégat, événement, commande ou temps de campagne. Toute autre mutation métier passe par `commit`.

`transitionOperation` ne peut modifier que phase, `failure` et `updatedAt`. Les méthodes de complétion sont seules autorisées à renseigner mode et résultat. Identités, requête, empreinte, type, version observée et `commitId` sont immuables hors transaction de commit. `receiveOperation` retrouve l'opération existante lorsque campagne, idempotencyKey et empreinte correspondent, même si l'appelant propose un nouvel `operationId`.

Les opérations complétées forment la source reconstructible du futur `InteractionLog`. Celui-ci reste une projection et son absence ne supprime ni entrée brute, ni résultat durable de l'opération.

`limit` est strictement positif et borné par l'adaptateur. Le curseur d'événements est exclusif et reprend après la paire fournie. Les listes sont ordonnées et paginées; aucune méthode du chemin courant ne charge l'historique complet.

## Tests contractuels obligatoires

La même suite doit pouvoir s'exécuter contre tout adaptateur :

1. création d'une campagne et de son horloge à zéro;
2. rejet d'un identifiant, champ ou schéma invalide;
3. réception puis retransmission de la même opération;
4. conflit entre même idempotencyKey et empreinte différente;
5. rejet d'une transition d'opération interdite;
6. commit atomique de plusieurs agrégats, événements et tâches;
7. incrément exact des révisions et séquences;
8. rejet d'une révision de campagne ou d'agrégat obsolète;
9. rejet d'un fencing token obsolète;
10. rejeu identique retournant le commit existant;
11. panne injectée avant fin de transaction sans écriture partielle;
12. récupération après issue inconnue par idempotencyKey;
13. monotonie de l'horloge et absence d'avance lors d'une opération sans commit;
14. ordre stable des événements simultanés;
15. campagne en lecture seule refusant les écritures;
16. outbox réclamable après expiration d'un worker sans duplication de l'événement source;
17. achèvement dégradé post-commit sans modification du commit;
18. reprise d'une opération depuis son payload durable et restitution du même résultat;
19. pagination sans parcours global implicite.

## Conditions de sortie du premier lot

- le contrat possède des représentations JSON Schema et TypeScript générées ou vérifiées depuis une source unique;
- `MemoryCampaignRepository` passe toute la suite contractuelle;
- aucune dépendance à React, OpenAI, IndexedDB ou `map-module` n'existe dans le noyau;
- les erreurs et identifiants sont inspectables sans exposer de contenu sensible;
- `git diff` ne contient aucun runtime narratif supplémentaire hors de ce périmètre;
- `TASKS.md` et la documentation proche reflètent les commandes de test réellement ajoutées.

## Règle de modification

Toute modification normative après gel exige une nouvelle version de contrat, une entrée dans le journal des décisions, une migration ou justification de compatibilité et une mise à jour des tests contractuels. Une simple modification d'exemple ne change jamais ce contrat.
