# Contrat de persistance IndexedDB

Statut : `FIGE` — contrat technique du lot I-01, version `campaign-storage/1`.

## Objet

Implémenter `IndexedDbCampaignRepository` sans modifier `campaign-core/1`. L'adaptateur doit fournir les mêmes résultats observables que `MemoryCampaignRepository`, survivre à une fermeture brutale et permettre une migration sans remplacer la dernière génération cohérente avant validation complète.

Ce contrat ne crée aucun domaine narratif. Il ne couvre ni wiki, ni personnage, ni règles, ni mémoire, ni IA, ni UI.

## Choix structurants

- IndexedDB natif est l'autorité durable du prototype navigateur.
- Une seule base logique, nommée `jdr5e-narration`, contient toutes les campagnes locales.
- La version physique initiale de la base et `storageSchemaVersion` valent `1`.
- Chaque campagne possède une génération active. Les données métier sont préfixées par `generationId`.
- Chaque transaction d'écriture relit le pointeur actif; une génération mise en sauvegarde ne peut plus recevoir d'écriture.
- Les appels IA, réseau et calculs longs sont interdits dans une transaction IndexedDB.
- `Web Locks` et `BroadcastChannel` peuvent améliorer l'UX, mais ne remplacent ni transaction, ni révision, ni fencing token.
- Aucun wrapper IndexedDB n'est requis : une dépendance supplémentaire devra prouver un avantage que l'API native et les utilitaires locaux ne couvrent pas.

Les noms de base et de stores sont des constantes centralisées. Ils ne sont jamais dispersés dans les domaines ou composants React.

## Enveloppes physiques

Les enregistrements de `campaign-core/1` restent inchangés. Les champs physiques suivants n'entrent pas dans leurs JSON Schema :

```text
StoredRecord<T>
  generationId: GenerationId
  record: T

StoredOutboxTask
  generationId: GenerationId
  campaignId: CampaignId
  claimableAt: null | UtcInstant
  record: OutboxTaskRecord
```

`generationId` est un identifiant opaque globalement unique. `claimableAt` est une projection technique recalculée dans la même transaction que la tâche :

- `PENDING` : `createdAt`;
- `RUNNING` : `leaseExpiresAt`;
- `FAILED_RETRYABLE` : `nextAttemptAt`;
- `COMPLETED` ou `FAILED_FINAL` : `null`.

Cette projection n'est jamais une seconde source de vérité. Une divergence avec `record` constitue une erreur d'intégrité.

## Stores et index physiques

| Store | Clé primaire | Index obligatoires | Responsabilité |
|---|---|---|---|
| `repository_meta` | `key` | aucun | version physique, identifiant d'installation et état d'ouverture |
| `campaign_heads` | `campaignId` | aucun | génération active et état de migration |
| `campaign_generations` | `[campaignId, generationId]` | `[campaignId, status]` | cycle `STAGING`, `ACTIVE`, `BACKUP`, `DISCARDED` |
| `campaign_controls` | `campaignId` | aucun | opération active, writer lease et fencing token monotone |
| `id_directory` | `[entityKind, entityId]` | `campaignId` | résolution des API ne recevant qu'un identifiant et interdiction de réutilisation |
| `campaigns` | `[generationId, record.campaignId]` | aucun | `CampaignRecord` actif ou sauvegardé |
| `aggregates` | `[generationId, record.campaignId, record.aggregateType, record.aggregateId]` | `[generationId, record.campaignId]`, unique `[generationId, record.campaignId, record.aggregateType, record.aggregateId]` | agrégats de campagne et copie bornée |
| `operations` | `[generationId, record.operationId]` | unique `[generationId, record.campaignId, record.idempotencyKey]`, unique `[generationId, record.campaignId, record.operationId]` | demandes durables, résultats et copie bornée |
| `commands` | `[generationId, record.commandId]` | `[generationId, record.campaignId]`, unique `[generationId, record.campaignId, record.commandId]`, `[generationId, record.commitId]` | commandes acceptées |
| `events` | `[generationId, record.eventId]` | unique `[generationId, record.campaignId, record.commitSequence, record.eventSequence]`, unique `[generationId, record.campaignId, record.eventId]`, `[generationId, record.commitId]` | journal ordonné et paginé |
| `commits` | `[generationId, record.commitId]` | unique `[generationId, record.campaignId, record.idempotencyKey]`, unique `[generationId, record.campaignId, record.commitSequence]`, unique `[generationId, record.campaignId, record.commitId]` | résultat atomique et résolution d'issue inconnue |
| `outbox` | `[generationId, record.taskId]` | `[generationId, campaignId, claimableAt, record.taskId]`, unique `[generationId, campaignId, record.taskId]`, `[generationId, record.commitId]` | tâches post-commit, réclamation et copie bornée |

Un index déclaré `unique` doit être créé comme tel par IndexedDB. Une collision produit une erreur structurée et annule toute la transaction.

`id_directory` contient au minimum les identités nécessaires aux méthodes par identifiant seul : opérations, commits et tâches. L'implémentation peut y inscrire toutes les autres identités pour renforcer l'interdiction de réutilisation, sans changer le port public.

## Métadonnées de campagne

```text
CampaignHeadRecord
  campaignId
  activeGenerationId
  storageSchemaVersion
  migration:
    state: IDLE | COPYING | VALIDATING | READY_TO_ACTIVATE | FAILED
    sourceGenerationId: null | GenerationId
    targetGenerationId: null | GenerationId
    ownerId: null | WriterId
    leaseExpiresAt: null | UtcInstant
    lastErrorCode: null | string

CampaignControlRecord
  campaignId
  activeOperationId: null | OperationId
  writerId: null | WriterId
  writerLeaseExpiresAt: null | UtcInstant
  fencingToken: non-negative integer
```

Chaque `CampaignGenerationRecord` conserve aussi les compteurs par store et une `integrityFingerprint`. L'empreinte est recalculée par lots dans un ordre déterministe avant confirmation; elle ne nécessite jamais de charger la génération entière en mémoire.

Le fencing token n'est jamais remis à zéro par fermeture, migration ou suppression d'une sauvegarde. Une campagne en migration refuse les nouvelles écritures métier avec `CAMPAIGN_BUSY`; les lectures utilisent encore la génération source active.

## Frontières transactionnelles

Toutes les transactions sont courtes et listent leurs stores dès l'ouverture. Une méthode ne lance jamais une seconde transaction pour terminer une mutation commencée dans la première.

| Opération | Stores écrits atomiquement |
|---|---|
| bootstrap minimal `createCampaign` de `campaign-core/1` | `campaign_heads`, `campaign_generations`, `campaign_controls`, `id_directory`, `campaigns`, `aggregates` |
| bootstrap métier `campaign-bootstrap/2` | `campaign_heads`, `campaign_generations`, `campaign_controls`, `id_directory`, `campaigns`, `operations`, `aggregates`, `commands`, `events`, `commits`, `outbox` |
| passage en lecture seule | `campaign_heads`, `campaigns` |
| acquisition ou libération de lease | `campaign_heads`, `campaigns`, `campaign_controls` |
| réception d'opération | `campaign_heads`, `campaigns`, `campaign_controls`, `id_directory`, `operations` |
| transition ou complétion sans commit | `campaign_heads`, `campaign_controls`, `id_directory`, `operations` |
| commit | `campaign_heads`, `campaign_controls`, `id_directory`, `campaigns`, `operations`, `aggregates`, `commands`, `events`, `commits`, `outbox` |
| claim, complétion ou échec outbox | `campaign_heads`, `id_directory`, `outbox` |
| activation de migration | `campaign_heads`, `campaign_generations`, `campaign_controls` |

Chaque écriture :

1. charge `CampaignHeadRecord` dans la transaction;
2. vérifie que la migration n'interdit pas l'écriture;
3. résout `activeGenerationId` sans cache autoritaire;
4. relit les révisions, phase, lease et fencing token nécessaires;
5. écrit toutes les collections;
6. attend `transaction.oncomplete` avant de retourner un succès.

`request.onsuccess` ne prouve pas le commit. `transaction.onerror`, `transaction.onabort`, fermeture ou exception retournent `PERSISTENCE_FAILURE`, sauf contrainte reconnue traduite vers un code plus précis. Après une issue inconnue, l'appelant recherche l'idempotencyKey; il ne réexécute pas aveuglément.

## Lectures et absence de parcours global

Une lecture qui résout un pointeur et charge des données utilise une seule transaction `readonly` incluant `campaign_heads` et les stores concernés. Elle ne conserve pas un `activeGenerationId` entre deux méthodes.

- `getOperation` et les méthodes de tâche utilisent `id_directory`, puis la tête de campagne et la génération active.
- `getOperationByIdempotencyKey` et `getCommitByIdempotencyKey` utilisent leurs index uniques.
- `listEvents` ouvre l'index d'ordre avec une borne exclusive après `(commitSequence, eventSequence)` et une limite validée.
- `claimOutboxTasks` borne l'index à `claimableAt <= now`, puis met à jour au plus `limit` tâches dans la même transaction.
- aucune méthode courante ne parcourt toutes les campagnes, tous les événements ou toute l'outbox.

L'ordre de claim est `(claimableAt, taskId)`. L'ordre historique reste exclusivement `(commitSequence, eventSequence)`.

## Multi-onglets et cycle de connexion

- Chaque instance possède un `writerId` distinct et persistant pendant sa session.
- `onversionchange` ferme immédiatement la connexion et invalide l'adaptateur.
- `onblocked` produit un diagnostic exploitable; aucune suppression ou migration n'est annoncée comme réussie.
- `close()` est idempotent et interdit de nouvelles requêtes sur l'instance.
- une transaction annulée par fermeture ne retourne jamais un succès;
- une ancienne instance qui écrit après activation relit la tête et utilise la génération active ou échoue; elle ne peut écrire dans `BACKUP`.

Le verrou logique de campagne et le fencing token restent autoritaires même si le navigateur exécute plusieurs workers ou onglets.

## Migration par générations

La migration d'une campagne suit obligatoirement :

1. vérifier la version source, l'espace disponible et l'absence d'opération ou lease actif;
2. acquérir un lease de migration durable dans `campaign_heads`;
3. créer une génération `STAGING` vide;
4. copier dans des lots bornés, avec curseurs et compteurs durables;
5. appliquer séquentiellement les transformateurs déterministes enregistrés;
6. valider schémas, références, identités, révisions, ordre, projections physiques, comptes et empreinte de génération;
7. marquer la cible `READY_TO_ACTIVATE`;
8. basculer atomiquement le pointeur, la source vers `BACKUP` et la cible vers `ACTIVE`, tout en maintenant le verrou de migration;
9. rouvrir, relire et réempreinter la campagne active, puis libérer le verrou; un échec remet atomiquement la source en `ACTIVE` et écarte la cible;
10. conserver la source jusqu'à confirmation explicite; sa suppression ultérieure est interruptible et ne touche jamais l'active.

Une panne avant l'étape 8 laisse la source active. Une panne après l'étape 8 retrouve la cible par le pointeur atomique. Une cible partielle n'est jamais consultée comme campagne active.

Le lease de migration est renouvelé après chaque lot borné. Après son expiration, une nouvelle instance peut abandonner la génération incomplète et libérer la campagne; l'identité d'un propriétaire disparu ne bloque donc pas définitivement la sauvegarde.

Les étapes de migration possèdent la forme `N -> N+1`, sont idempotentes, sans IA, réseau ou avance du temps de jeu. Une version future est refusée en écriture. Si l'enveloppe peut être lue sûrement, un outil séparé peut proposer une consultation; I-01 n'invente pas de rétrogradation.

La première version publiée ne prétend pas migrer une sauvegarde historique inexistante. I-01 doit néanmoins tester le moteur avec une régénération vers une nouvelle génération, un transformateur de fixture injecté et un échec avant activation. Toute vraie version future ajoutera son transformateur de production avant publication.

## Évolution de la structure IndexedDB

`onupgradeneeded` sert uniquement aux changements physiques courts et déterministes : création additive de stores ou index, métadonnées et compatibilité de structure. Une transformation volumineuse de campagne n'y est jamais exécutée.

Une évolution destructive suit deux publications : création et bascule vers la nouvelle structure, puis suppression de l'ancienne seulement après compatibilité confirmée. L'abandon de la transaction `versionchange` laisse la version précédente intacte.

## Quota et durabilité

- `navigator.storage.persist()` est demandé lorsque disponible; un refus n'empêche pas silencieusement l'utilisation mais reste visible dans le diagnostic.
- `navigator.storage.estimate()` alimente une mesure avant écriture lourde, migration, import et export.
- un avertissement est émis à partir de 70 % du quota estimé;
- aucune estimation n'est présentée comme une garantie : `QuotaExceededError` annule la transaction et devient `PERSISTENCE_FAILURE` avec un détail expurgé;
- une migration n'est pas lancée si la copie source, la marge de travail et la réserve configurée ne tiennent pas dans l'estimation disponible;
- aucun commit n'est tronqué, réparti en succès partiels ou déclaré durable après une erreur de quota.

Le seuil de blocage préventif, la marge de migration et la cible 500 Mo restent des paramètres mesurés en I-08. I-01 implémente les sondes, l'avertissement, le rejet sûr et les tests d'erreur sans prétendre certifier une capacité navigateur universelle.

## Stratégie de test

Les tests emploient une base unique par cas et la suppriment après fermeture de toutes les connexions. Un émulateur IndexedDB peut accélérer les cas purs, mais ne satisfait pas la gate navigateur.

### Suite commune obligatoire

Les 19 tests de `campaign-core/1` sont factorisés et exécutés sans assouplissement contre :

1. `MemoryCampaignRepository`;
2. `IndexedDbCampaignRepository` dans un vrai navigateur Chromium.

### Cas IndexedDB supplémentaires

1. fermeture puis réouverture avec état identique;
2. abort injecté au milieu d'un commit sans écriture partielle;
3. fermeture après commit mais avant réponse, puis résolution par idempotencyKey;
4. deux connexions concurrentes et rejet du fencing token ancien;
5. unicité d'opération et d'idempotencyKey entre onglets;
6. pagination dans un commit et entre plusieurs commits;
7. reclaim outbox après expiration et réouverture;
8. lecture seule persistante;
9. migration réussie avec activation atomique et source conservée;
10. migration invalide ou interrompue laissant la source active;
11. reprise ou abandon contrôlé d'une génération `STAGING`;
12. version future refusée sans mutation;
13. `versionchange` et connexion bloquante;
14. erreur de quota simulée sans succès partiel;
15. ancienne connexion incapable d'écrire dans une génération `BACKUP`.

Un test réel de multi-contexte, fermeture et cycle `versionchange` est obligatoire. `fake-indexeddb` seul ne prouve ni durabilité navigateur, ni comportement multi-onglets, ni blocage de connexion.

## Commandes attendues du lot

Depuis `test-GAME-2D/` :

```text
npm run narration-module:build
npm run narration-module:test:contracts
npm run narration-module:test:indexeddb
npm run build
```

Le script IndexedDB doit échouer si le navigateur cible n'est pas disponible; il ne doit pas se transformer en test factice réussi.

## Gate de sortie I-01

- AF-R03 est représenté par du code et des tests réels;
- les deux adaptateurs passent la même suite contractuelle;
- les quinze cas spécifiques passent dans Chromium;
- aucune mutation de `campaign-core/1` n'est nécessaire, sauf correction de défaut documentée et versionnée;
- aucun parcours global n'existe sur les chemins courants;
- migration, quota, fermeture et multi-onglets échouent de manière atomique;
- le build global passe et `TASKS.md` est actualisé;
- IndexedDB reste un adaptateur du noyau, jamais une dépendance directe de l'UI ou d'un domaine.
