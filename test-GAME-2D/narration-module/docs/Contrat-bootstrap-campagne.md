# Contrat de bootstrap de campagne

Statut : `FIGE` — remplace `campaign-bootstrap/1` avant toute implémentation d'I-02.

Version du contrat : `campaign-bootstrap/2`

Ce document résout les prérequis AF-R04 à AF-R07 du lot I-02. Il fixe le paquet de contenu, l'ingestion du wiki, l'import du personnage, le registre des règles et l'écriture atomique nécessaires pour créer une campagne. La version 2 corrige l'incompatibilité entre le bootstrap métier complet et `createCampaign` de `campaign-core/1`, puis étend le lore auteur aux espèces, cultures, PNJ et à l'histoire. Il ne livre pas encore leur implémentation.

## 1. Résultat attendu

Le bootstrap reçoit exactement :

- un `campaignId` alloué avant toute écriture et conservé lors d'une reprise;
- l'identifiant et la version d'un paquet de contenu installé;
- l'identifiant et la version d'un ruleset installé;
- une fiche personnage exportée par l'éditeur ou fournie en JSON;
- un identifiant de lieu initial présent dans le paquet;
- un identifiant de requête et une clé d'idempotence.

Il valide toutes les dépendances, importe le personnage, recalcule les valeurs dérivées, produit les projections initiales et crée la campagne par une unique transaction de bootstrap spécialisée. Cette transaction réutilise les invariants de `campaign-core/1`, mais n'appelle pas d'abord `createCampaign`, qui n'autorise que l'horloge initiale. Elle ne lit jamais `localStorage`, l'état React, le cache du `map-module` ou les fichiers du wiki.

Une erreur de contenu, de règle, de fiche ou de référence produit un diagnostic structuré et aucun état de campagne partiel.

## 2. Constat d'audit

### 2.1 Wiki

Le corpus `wiki/lore/` contient actuellement 27 fichiers :

- 26 entités possèdent un `id` unique et un `type` parmi `batiment`, `faction`, `meta`, `quartier`, `region`, `royaume`, `territoire` et `ville`;
- `wiki/lore/gouvernances/primauté` est un document brut sans front matter;
- le parseur du `map-module` accepte un sous-ensemble permissif de YAML, ignore certaines lignes invalides et écrase silencieusement un doublon d'identifiant;
- aucune version de schéma, empreinte de contenu ou validation référentielle ne protège le corpus actuellement servi à l'interface carte.

Ce parseur reste utilisable par l'éditeur de carte tant qu'il n'est pas migré, mais il n'est pas une autorité acceptable pour une campagne.

### 2.2 Fiche personnage

L'éditeur sauvegarde un objet riche dans `jdr5e_saved_sheets` et sélectionne une fiche avec `jdr5e_active_sheet`. Le type `Personnage` accepte des propriétés arbitraires, les sauvegardes ne portent pas de version de schéma et plusieurs valeurs dérivées sont calculées à des endroits différents de l'éditeur et du plateau tactique.

Le fichier `src/data/models/character-model.json` décrit la fiche, mais n'est pas un schéma exécutable. Les valeurs visibles, l'inventaire, les emplacements, la monnaie et les statistiques de combat doivent donc être normalisés avant d'entrer dans une campagne.

### 2.3 Règles

Les règles actives sont réparties entre les catalogues JSON, les validateurs, l'éditeur, `GameBoard.tsx` et le moteur tactique. Certains catalogues sont versionnés, mais il n'existe ni manifeste global de ruleset ni registre permettant de citer la règle et sa version.

I-02 doit extraire les calculateurs communs requis par le bootstrap. Il est interdit de recopier leur formule dans un troisième emplacement.

## 3. AF-R04 — Paquet de contenu immuable

### 3.1 Identité et immutabilité

Un paquet publié est identifié par le couple `(packageId, packageVersion)`. Ce couple désigne toujours les mêmes octets normalisés. Toute modification, même corrective, produit une nouvelle version entière strictement supérieure.

Le premier paquet cible est `jdr5e.base-content@1`. Son identifiant définitif peut changer avant sa première génération, mais pas après qu'une campagne l'a épinglé.

```ts
interface ContentPackageManifestV1 {
  schemaVersion: 1;
  packageId: string;
  packageVersion: number;
  minimumRuntimeContract: "campaign-bootstrap/2";
  entries: ContentEntryDescriptorV1[];
  rootFingerprint: `sha256:${string}`;
}

interface ContentEntryDescriptorV1 {
  entryId: string;
  entryKind: "LORE_ENTITY" | "GAME_CATALOG_ENTRY";
  entityType: string;
  payloadSchemaVersion: number;
  sourcePath: string;
  sourceFingerprint: `sha256:${string}`;
  payloadFingerprint: `sha256:${string}`;
  references: ContentReferenceV1[];
}

interface ContentReferenceV1 {
  targetId: string;
  relation: string;
  strength: "REQUIRED" | "OPTIONAL";
}
```

Règles de génération :

1. les chemins utilisent `/`, sont relatifs à la racine du dépôt et ne participent jamais à l'identité métier;
2. les descripteurs sont triés par `entryKind`, `entityType`, puis `entryId` avant calcul;
3. `sourceFingerprint` porte sur les octets UTF-8 de la source;
4. `payloadFingerprint` porte sur le JSON canonique de la projection validée;
5. `rootFingerprint` porte sur le manifeste canonique sans son propre champ d'empreinte;
6. une date de génération peut exister dans un rapport externe, jamais dans le calcul d'identité;
7. deux entrées de même `entryKind` et `entryId`, une empreinte fausse ou une référence requise absente invalident tout le paquet.

Les créations de l'IA et les overrides propres à une partie ne modifient pas ce paquet. Ils vivent dans les agrégats de campagne avec leur provenance et la référence du contenu initial qu'ils complètent ou remplacent.

### 3.2 Résolution

```ts
interface ContentPackageResolver {
  resolveManifest(packageId: string, packageVersion: number): Promise<ContentPackageManifestV1 | null>;
  resolveEntry(
    packageId: string,
    packageVersion: number,
    entryKind: ContentEntryDescriptorV1["entryKind"],
    entryId: string
  ): Promise<Readonly<unknown> | null>;
}
```

Le résolveur retourne uniquement la version demandée. Il n'applique ni « dernière version », ni fallback réseau, ni lecture directe des sources. Une campagne dont le paquet n'est plus installé s'ouvre en lecture seule avec un diagnostic d'intégrité; elle ne bascule pas sur une autre version.

Une migration de paquet est une opération de campagne explicite : validation du nouveau paquet, plan de références, copie/migration, commit et journal. Les événements historiques gardent leurs références d'origine.

### 3.3 Contenu de la version 1

Le paquet V1 inclut :

- les entités lore normalisées nécessaires aux Archives de Lysenthe et leur chaîne géographique;
- les catalogues référencés par la fiche prête à jouer : races, historiques, classes, sous-classes, actions, sorts, compétences, langues, objets, armes, armures et emplacements;
- les définitions nécessaires au calcul du personnage et à sa projection tactique.

Le paquet ne contient ni sauvegarde de joueur, ni état courant du monde, ni règle exécutable. Le ruleset peut référencer ses catalogues par identifiant, mais possède sa propre version.

## 4. AF-R05 — Ingestion stricte du wiki

### 4.1 Source acceptée

Une source lore est un fichier UTF-8 comportant un front matter YAML délimité par `---`, suivi d'un corps Markdown. Les extensions `.md`, `.yaml`, `.yml` et l'absence d'extension sont acceptées pendant la migration. Le nom du fichier ne fournit jamais l'identifiant.

Tout fichier situé sous une racine d'ingestion est soit :

- déclaré comme source et validé;
- déclaré dans une liste d'exclusion versionnée avec une raison;
- signalé comme erreur bloquante.

Le document `gouvernances/primauté` ne peut donc plus être ignoré implicitement. La solution préférée est sa conversion en entité lore; une exclusion temporaire devra être explicite et testée.

### 4.2 Clés communes et types

Chaque source doit fournir :

```yaml
schema_version: 1
type: batiment
id: archives_de_lysenthe
nom: Archives de Lysenthe
```

Contraintes communes :

- `id` respecte `^[a-z][a-z0-9_]{2,127}$` et est unique dans le paquet;
- `type` appartient à la liste versionnée des types lore;
- `nom` est non vide;
- les nombres de pourcentage ou de niveau sont des entiers de 0 à 100;
- une liste est réellement une liste et non une chaîne séparée par des virgules;
- une clé inconnue est une erreur, pas une donnée abandonnée;
- les commentaires et le corps Markdown sont conservés comme sources, jamais interprétés comme instructions système.

Le schéma auteur `lore-authoring/1` conserve les clés actuellement observées et ajoute les types nécessaires au contexte narratif. Sa structure détaillée, ses niveaux de connaissance et ses règles de fragmentation sont définis dans [`Contrat-contenu-lore.md`](Contrat-contenu-lore.md). Ajouter une clé ou changer sa structure exige une nouvelle version du schéma d'entité.

| Type | Relations requises | Relations optionnelles principales |
|---|---|---|
| `batiment` | `territoire`, `region`, `ville`, `quartier` | `factions_residentes`, `proprietaire_faction`, `lieux_connectes` |
| `quartier` | `territoire`, `region`, `ville` | profils locaux |
| `ville` | `territoire`, `region` | `quartiers`, `batiments_importants`, `factions_presentes`, `liaisons` |
| `region` | `territoire` | `villes_principales`, `factions_actives`, `lieux_remarquables` |
| `faction` | aucune universelle | `territoire`, `region`, `ville`, `autorite_tutelle`, `siege_pouvoir` |
| `territoire`, `royaume`, `meta` | aucune | liens déclarés par leur schéma |
| `espece` | aucune | catalogue mécanique, cultures, langues et régions de présence |
| `culture` | aucune | espèces, langues, territoires, régions, factions et événements historiques |
| `pnj` | aucune | espèce, culture, lieu initial, factions, autres PNJ et connaissances initiales |
| `periode_historique` | aucune | période parente, territoires, cultures et événements historiques |
| `evenement_historique` | aucune | période, lieux, participants, causes et conséquences |

Une relation marquée requise doit résoudre une entité du type attendu. Une relation optionnelle peut viser une entité absente uniquement si elle est écrite sous forme externe explicite, par exemple `external:collegium_des_archivistes`; une chaîne locale non résolue reste une erreur.

### 4.3 Projection normalisée

```ts
interface LoreEntityV1 {
  schemaVersion: 1;
  entityId: string;
  entityType: string;
  displayName: string;
  attributes: Readonly<Record<string, JsonValue>>;
  relations: LoreRelationV1[];
  searchTerms: string[];
  body: string;
  provenance: LoreProvenanceV1;
}

interface LoreRelationV1 {
  relation: string;
  targetId: string;
  targetType: string | null;
  strength: "REQUIRED" | "OPTIONAL";
}

interface LoreProvenanceV1 {
  packageId: string;
  packageVersion: number;
  sourcePath: string;
  sourceFingerprint: `sha256:${string}`;
}
```

`attributes` n'est pas une échappatoire permissive : sa forme est validée par le schéma correspondant à `entityType` avant construction de `LoreEntityV1`.

### 4.4 Fragments sourcés

La recherche et les futurs paquets de contexte utilisent des fragments, jamais un fichier brut :

```ts
interface LoreFragmentV1 {
  schemaVersion: 1;
  fragmentId: string;
  entityId: string;
  fieldPath: string;
  text: string;
  tags: string[];
  provenance: LoreProvenanceV1;
}
```

Un fragment doit permettre de retrouver exactement l'entité et le champ qui l'ont produit. Le découpage est déterministe et stable pour une même empreinte de payload. Le Markdown importé est une donnée inerte : ses formulations ne peuvent modifier les règles, le rôle système ou les autorisations d'un appel IA.

### 4.5 Diagnostics

Chaque diagnostic possède `code`, `severity`, `sourcePath`, `jsonPath`, `messageKey` et `details`. Les codes minimaux sont :

- `WIKI_FILE_UNDECLARED`;
- `WIKI_FRONT_MATTER_MISSING`;
- `WIKI_SCHEMA_VERSION_UNSUPPORTED`;
- `WIKI_UNKNOWN_KEY`;
- `WIKI_INVALID_VALUE`;
- `WIKI_DUPLICATE_ID`;
- `WIKI_REFERENCE_MISSING`;
- `WIKI_REFERENCE_TYPE_MISMATCH`;
- `WIKI_UNSAFE_CONTENT`.

Toute sévérité `ERROR` empêche la génération du paquet. Les avertissements n'autorisent jamais une perte de champ.

## 5. AF-R06 — Import du personnage

### 5.1 Frontière d'import

Le module reçoit une valeur JSON déjà extraite de l'interface. Un adaptateur UI séparé peut lire la fiche active depuis `localStorage`, mais le bootstrap et `CharacterDomain` n'en connaissent ni les clés ni le format de stockage.

```ts
interface CharacterImportEnvelopeV1 {
  schemaVersion: 1;
  sourceKind: "CHARACTER_CREATOR_LEGACY" | "CHARACTER_CREATOR_V1";
  sourceSchemaVersion: number;
  sourceFingerprint: `sha256:${string}`;
  character: unknown;
}

interface CharacterImportResultV1 {
  character: CharacterAggregatePayloadV1;
  tacticalProjection: TacticalCharacterProjectionV1;
  narrativeProjection: NarrativeCharacterProjectionV1;
  diagnostics: CharacterImportDiagnosticV1[];
}
```

L'adaptateur legacy reconnaît la fiche prête à jouer fournie pendant la conception. Il ne conserve aucune propriété inconnue dans l'agrégat normalisé; une propriété inconnue produit au minimum un diagnostic afin d'éviter une perte silencieuse.

La fixture exécutable `tests/fixtures/character/valid/creator-ready.json` suit la sortie actuelle de `buildCharacterSave` et résout ses références contre les catalogues réellement chargés par le créateur. Elle matérialise armure, arme, contenant et monnaie par `instanceId`; `sampleCharacter` reste un fallback tactique historique et n'est pas une source normative d'import.

`importLegacyCharacterV1` reçoit exclusivement l'enveloppe et un snapshot de catalogues explicite. Il ne lit ni `localStorage`, ni composant React. Il recalcule niveau, modificateurs, maîtrise, PV maximum, CA et perception passive, rejette les contradictions mutables et retourne séparément agrégat, projection tactique et projection narrative. Les champs dérivés legacy divergents restent des diagnostics tant qu'ils ne masquent pas une donnée mutable impossible.

### 5.2 Autorités de données

| Donnée | Autorité après import | Traitement des doublons legacy |
|---|---|---|
| identité, description, choix, classes | champs source normalisés | validation des références catalogue |
| scores FOR/DEX/CON/INT/SAG/CHA | scores de base normalisés | les `mod*` source sont ignorés puis comparés |
| niveau global | somme des niveaux de classe | `niveauGlobal` est comparé au résultat |
| bonus de maîtrise, CA, PV max, attaque, perception passive | calculateurs du ruleset | valeurs source comparées, jamais reprises comme autorité |
| PV actuels, PV temporaires, fatigue, ressources consommables | état mutable source validé | bornage interdit silencieusement; une valeur impossible est rejetée |
| inventaire | instances normalisées identifiées par `instanceId` | références objet, quantité, conteneur et emplacement validés |
| équipement visible | projection des instances équipées et du catalogue | `materielSlots` doit être cohérent avec `equippedSlot` |
| monnaie | instances physiques de monnaie | `argent` doit correspondre; sinon rejet ciblé |
| sorts et capacités | choix/grants validés contre les catalogues | les listes dérivées sont reconstruites |
| propreté et état de tenue | état de campagne explicite | absence = `UNKNOWN`, jamais « propre » inventé |

Le format legacy peut référencer un conteneur par son `instanceId` ou par l'emplacement qui le porte. L'import résout toujours cette référence vers l'`instanceId` canonique. Un cycle de conteneurs, un conteneur absent, un objet dans deux emplacements ou deux objets dans un emplacement exclusif sont des erreurs.

Si `argent` existe sans instances physiques correspondantes, l'adaptateur ne choisit pas seul un contenant. L'import est suspendu avec une correction explicite à appliquer dans l'éditeur ou un assistant de migration UI.

### 5.3 Agrégat et projections

`CharacterAggregatePayloadV1` conserve les données nécessaires à la progression future : identité, scores, espèces/historique/classes, choix verrouillés, compétences, maîtrises, langues, ressources courantes, inventaire par instances, sorts par source, historique de progression et personnalisation. Il conserve aussi l'empreinte de la source et le ruleset utilisé pour les calculs.

La projection tactique contient uniquement les données exigées par le plateau : identifiant, niveau, modificateurs, PV, CA, déplacement, vision, actions, réactions, ressources, armes, sorts et apparence de jeton. Elle est reconstruisible depuis l'agrégat, le paquet et le ruleset; elle n'est jamais une seconde autorité.

La projection narrative contient uniquement ce qui peut être utile au MJ : identité, langues, traits, objectifs, défauts, apparence physique, équipement effectivement visible, état observable, compétences pertinentes et références de capacités. Elle distingue :

- `observable` : descriptible sans test ni souvenir;
- `knownToPlayer` : connu du joueur mais pas nécessairement visible;
- `privateMechanical` : utilisable par les règles, jamais exposé comme observation.

Les beaux vêtements, signes d'unité, symboles sacrés, armes visibles, salissures et dégradations peuvent fournir des facteurs contextuels à une résolution sociale. Ils ne changent pas le score ni le modificateur de Charisme. La règle sociale doit citer les facteurs réellement observables et peut produire avantage, désavantage, seuil ou réaction selon le ruleset; la prose ne crée pas ce bonus.

### 5.4 Recalcul unique

Les calculateurs suivants deviennent des fonctions pures partagées par l'import, l'éditeur et le plateau :

- modificateur de caractéristique;
- niveau global et bonus de maîtrise;
- PV maximum;
- classe d'armure depuis les instances équipées;
- perception passive;
- bonus d'attaque et statistiques de magie;
- grants, ressources et emplacements de sorts;
- visibilité, accessibilité et capacité des conteneurs.

Chaque calcul retourne sa valeur et les références de règles/catalogues utilisées. Une divergence avec un champ dérivé de la source est un diagnostic `WARNING` si la source reste migrable, une erreur si elle révèle une contradiction sur une donnée mutable ou un choix.

### 5.5 Rejets minimaux

Les tests couvrent au minimum : fiche valide fournie, version future, JSON non objet, identifiant manquant, score hors limites, classe ou objet inconnu, niveau incohérent, `instanceId` dupliqué, conteneur absent ou cyclique, emplacement incohérent, monnaie incohérente, capacité/action/sort absent du paquet et ressource courante supérieure à son maximum.

La suite exécutable couvre ces rejets par 16 mutations ciblées de la fixture, vérifie aussi l'abandon des propriétés inconnues avec avertissement et exige des projections déterministes.

## 6. AF-R07 — RuleRegistry MVP

### 6.1 Manifeste et définition

```ts
interface RulesetManifestV1 {
  schemaVersion: 1;
  rulesetId: string;
  rulesetVersion: number;
  compatibleContentPackages: Array<{ packageId: string; minimumVersion: number; maximumVersion: number }>;
  rules: Array<{ ruleId: string; ruleVersion: number; fingerprint: `sha256:${string}` }>;
  rootFingerprint: `sha256:${string}`;
}

interface RuleDefinitionV1 {
  schemaVersion: 1;
  ruleId: string;
  ruleVersion: number;
  title: string;
  normativeText: string;
  kind: "SYSTEM_INVARIANT" | "GENERAL" | "HOUSE" | "CONTENT_SPECIFIC" | "CAMPAIGN_OPTION";
  ownerDomain: string;
  status: "ACTIVE" | "DEPRECATED" | "REPLACED";
  execution: "DETERMINISTIC" | "ADJUDICATION_REQUIRED" | "DESCRIPTIVE";
  executorId: string | null;
  parameters: Readonly<Record<string, JsonValue>>;
  scope: Readonly<Record<string, JsonValue>>;
  overrides: Array<{ ruleId: string; ruleVersion: number }>;
  specializes: Array<{ ruleId: string; ruleVersion: number }>;
  incompatibleWith: Array<{ ruleId: string; ruleVersion: number }>;
  examples: RuleExampleV1[];
  acceptanceScenarioIds: string[];
}
```

Une règle déterministe référence un `executorId` enregistré par le domaine propriétaire. Le registre contient la norme et les paramètres; le code exécute cette norme. Un exécuteur absent, une relation de remplacement invalide, un conflit actif ou une incompatibilité de paquet invalide le ruleset au chargement.

Une règle `ADJUDICATION_REQUIRED` autorise une proposition d'arbitrage mais aucune mutation directe. Une règle `DESCRIPTIVE` peut guider une explication ou une mise en scène sans produire d'effet mécanique.

### 6.2 Inventaire obligatoire de la V1

Le ruleset MVP doit posséder des entrées versionnées couvrant au moins :

1. limites et modificateurs des caractéristiques;
2. niveau global et bonus de maîtrise;
3. PV maximum et validation des PV courants;
4. classe d'armure et boucliers;
5. perception passive et bonus de compétence/expertise;
6. disponibilité des actions, réactions, sorts et ressources;
7. inventaire physique, conteneurs, accès, capacité et emplacements exclusifs;
8. monnaie physique et atomicité d'une transaction;
9. projection de l'équipement visible et de son état;
10. influence contextuelle de l'apparence sans mutation du Charisme;
11. refus d'une action impossible avant jet ou consommation;
12. priorité explicite des règles maison sur toute connaissance générique de D&D.

Les identifiants initiaux sont figés comme suit. `—` signifie que la règle est un invariant de sélection ou un contrat d'arbitrage et non un calcul autonome.

| Règle V1 | Exécution | Exécuteur V1 | Norme minimale |
|---|---|---|---|
| `core.character.ability-modifier` | déterministe | `character.compute-ability-modifier` | `floor((score - 10) / 2)` après validation du score |
| `core.character.global-level` | déterministe | `character.compute-global-level` | somme des niveaux de classe validés, comprise entre 1 et 20 pour le format legacy |
| `core.character.proficiency-bonus` | déterministe | `character.compute-proficiency-bonus` | 2 aux niveaux 1–4, puis +1 par tranche de quatre niveaux, maximum 6 au niveau 20 |
| `core.character.maximum-hit-points` | déterministe | `character.compute-maximum-hit-points` | calcul depuis classes, dés de vie, niveaux et Constitution; premier niveau et multiclassage suivent les paramètres du ruleset |
| `core.character.armor-class` | déterministe | `character.compute-armor-class` | meilleure armure valide équipée, modificateur DEX borné par l'armure, puis boucliers et effets déclarés |
| `core.character.passive-perception` | déterministe | `character.compute-passive-perception` | base 10 + SAG + maîtrise ou expertise applicable |
| `core.character.capability-availability` | déterministe | `character.resolve-capability-availability` | une capacité absente, non préparée ou sans précondition ne peut être utilisée |
| `core.inventory.containment` | déterministe | `inventory.validate-containment` | instances uniques, graphe sans cycle, contenant existant et accessible |
| `core.inventory.equipment-slots` | déterministe | `inventory.validate-equipment-slots` | compatibilité de slot et exclusivité selon le catalogue |
| `core.inventory.physical-currency` | déterministe | `inventory.resolve-physical-currency` | seule la monnaie matérialisée et accessible peut être transférée |
| `core.transaction.atomicity` | invariant | — | une résolution multidonnée réussit entièrement ou n'écrit rien |
| `core.character.visible-appearance` | déterministe | `character.project-visible-appearance` | seuls corps, état et instances visibles effectivement équipées sont descriptibles |
| `house.social.observable-appearance` | arbitrage requis | — | l'apparence observable est un facteur contextuel sans modifier FOR/DEX/CON/INT/SAG/CHA |
| `house.action.impossible-before-roll` | invariant | — | une impossibilité établie est refusée avant jet, coût ou commit |
| `house.rules.local-authority` | invariant | — | le ruleset épinglé prévaut sur toute connaissance générique du modèle |

Chaque identifiant ci-dessus commence en `ruleVersion: 1`. Les paramètres encore variables, notamment dés de vie de classe, plafonds d'armure, capacités de conteneur et effets d'objet, viennent des entrées épinglées du paquet; ils ne sont ni codés en dur dans le prompt, ni déduits de D&D.

Les moteurs tactiques existants restent propriétaires de leurs résolutions internes. Pour I-02, leurs règles nécessaires au bootstrap sont exposées par des exécuteurs communs; le lot ne prétend pas convertir tout le moteur d'actions en registre déclaratif.

### 6.3 Conflits et citations

L'ordre n'est jamais déduit d'une priorité numérique globale. Les liens `overrides`, `specializes` et la portée doivent produire un ensemble non ambigu. Deux règles actives applicables et contradictoires provoquent `RULESET_CONFLICT`; l'IA ne choisit pas.

Toute décision mécanique conserve :

- les couples `ruleId@ruleVersion` appliqués;
- les paramètres effectifs;
- les références de contenu utilisées;
- l'identifiant de l'exécuteur et sa version de contrat;
- le résultat ou le code de refus.

L'implémentation `RuleRegistryV1` recalcule les empreintes de chaque définition et du manifeste, vérifie la compatibilité exacte du paquet, exige l'inventaire des quinze règles V1 et refuse exécuteur absent, relation manquante, cycle ou incompatibilité active. `resolveActiveRules` applique uniquement les relations `overrides` et `specializes`; aucune priorité numérique implicite n'existe. Une exécution déterministe retourne un `RuleDecisionV1` citant règle, version, paramètres, références de contenu, exécuteur et version de contrat.

Le manifeste MVP est construit par `createMvpRulesetManifestV1`. Onze règles disposent d'exécuteurs purs dans le module narration; les trois invariants descriptifs ne mutent rien et `house.social.observable-appearance` reste explicitement `ADJUDICATION_REQUIRED`.

### 6.4 Arbitrage ponctuel

```ts
interface AdjudicationRecordV1 {
  schemaVersion: 1;
  adjudicationId: string;
  campaignId: string;
  caseFingerprint: `sha256:${string}`;
  status: "ACCEPTED" | "REJECTED" | "SUPERSEDED";
  question: string;
  assumptions: string[];
  citedRules: Array<{ ruleId: string; ruleVersion: number }>;
  ruling: Readonly<Record<string, JsonValue>>;
  scope: Readonly<Record<string, JsonValue>>;
  acceptedAtGameSecond: number | null;
  supersedesAdjudicationId: string | null;
}
```

`caseFingerprint` porte sur la question structurée, l'état mécanique pertinent et les versions citées. Un arbitrage accepté constitue un précédent de cette campagne seulement. Il ne modifie ni `RuleDefinition`, ni `RulesetManifest`, ni l'historique. Sa promotion éventuelle exige une nouvelle règle, une nouvelle version de ruleset et des tests.

## 7. Persistance atomique du bootstrap

### 7.1 Port spécialisé

`campaign-core/1` reste inchangé. I-02 ajoute un port spécialisé implémenté par les mêmes adaptateurs mémoire et IndexedDB :

```ts
interface CampaignBootstrapRepository {
  bootstrapCampaign(
    request: CampaignBootstrapPersistenceRequestV1
  ): Promise<Result<CampaignBootstrapPersistenceResultV1>>;
}
```

La forme exécutable de la requête persiste des enregistrements finaux entièrement alloués :

```ts
interface CampaignBootstrapPersistenceRequestV1 {
  schemaVersion: 1;
  campaign: CampaignRecord;
  operation: OperationRecord;
  initialAggregates: AggregateRecord[];
  acceptedCommands: AcceptedCommandRecord[];
  events: EventRecord[];
  outboxTasks: OutboxTaskRecord[];
  commit: CommitRecord;
}
```

Le repository revalide les schémas communs et les cohérences croisées avant publication. La campagne fournie est déjà à la révision `1`, l'opération en `COMMITTED_PENDING_RENDER`, tous les agrégats à la révision `0` et toutes les références portent le même commit initial. Les horodatages sont donc stables pendant une reprise d'issue inconnue.

La requête contient uniquement des données déjà validées : identités de campagne et d'opération, clé d'idempotence, empreinte complète, dépendances épinglées, horloge, agrégats initiaux, commandes acceptées, événement `campaign.bootstrapped` et éventuelles tâches d'outbox. Elle ne contient ni fichier source, ni cache UI, ni fonction de calcul.

Le `campaignId`, l'`operationId`, le `clientRequestId`, l'`idempotencyKey` et le `commitId` sont alloués avant l'appel et restent identiques pendant toute reprise. Le repository n'invente pas une nouvelle identité après une issue inconnue.

### 7.2 Frontière avec `campaign-core/1`

`createCampaign` reste l'opération minimale de `campaign-core/1` et continue de créer uniquement une campagne à la révision `0` et son horloge. Elle n'est pas utilisée par `campaign.bootstrap`.

Le port spécialisé applique dans une même transaction les validations communes de schéma, taille, identité, références, idempotence, révisions, ordre d'événements et monotonie de l'horloge. Il crée directement :

- les métadonnées physiques de campagne;
- la campagne persistée à la révision `1`;
- l'opération en `COMMITTED_PENDING_RENDER`;
- l'horloge et tous les agrégats initiaux à la révision `0`;
- les commandes acceptées;
- le commit initial, avec `previousCampaignRevision: 0`, `campaignRevision: 1` et `commitSequence: 1`;
- l'événement `campaign.bootstrapped`, puis les tâches d'outbox éventuelles.

Tous les agrégats initiaux, y compris l'horloge, référencent le commit initial dans `updatedByCommitId`. Aucun état de campagne à la révision `0` n'est observable entre deux transactions.

Une présentation ou redirection UI peut compléter ensuite l'opération par `completePresentation`. Son échec ne remet pas en cause la campagne committée et la reprise retrouve `COMMITTED_PENDING_RENDER`.

### 7.3 Idempotence et issue inconnue

Une retransmission portant le même `campaignId`, la même `idempotencyKey` et la même empreinte retourne le commit initial existant, même si le lease technique d'origine a expiré. Le même `campaignId` ou la même clé avec une empreinte différente produit `IDEMPOTENCY_CONFLICT`.

Le client conserve l'enveloppe de création, notamment `campaignId` et `idempotencyKey`, jusqu'à résolution certaine. La future interface de création devra rendre cette enveloppe durable avant l'appel; cette responsabilité n'autorise pas le domaine à lire la fiche active ou d'autres caches UI.

### 7.4 Frontière transactionnelle IndexedDB

L'adaptateur IndexedDB écrit dans une seule transaction les stores déjà définis par `campaign-storage/1` : têtes, générations, contrôles, répertoire d'identités, campagnes, opérations, agrégats, commandes, événements, commits et outbox. Aucun nouveau store n'est requis pour la version 2.

L'adaptateur mémoire prépare une copie complète de son état et ne la publie qu'après toutes les validations. Les deux adaptateurs exécutent la même suite contractuelle du bootstrap.

L'implémentation mémoire est `MemoryCampaignBootstrapRepository`, spécialisation de l'adaptateur mémoire I-00. La même suite contractuelle s'exécute contre `IndexedDbCampaignRepository` dans Chromium et injecte une panne après campagne, opération, agrégats, commandes, événements, outbox et commit, puis juste avant publication. Un contrôle supplémentaire ferme et rouvre IndexedDB avant de relire campagne, commit et événement.

## 8. Séquence métier du bootstrap

L'opération `campaign.bootstrap` suit cet ordre sans écrire avant l'étape 8 :

1. valider l'enveloppe et son empreinte;
2. résoudre exactement le paquet et vérifier toutes ses empreintes;
3. résoudre exactement le ruleset et vérifier sa compatibilité;
4. vérifier le lieu initial et sa chaîne géographique;
5. importer la fiche et produire les diagnostics;
6. recalculer les dérivés et construire les projections;
7. préparer campagne, horloge, personnage, position initiale et références épinglées;
8. persister atomiquement campagne, opération, agrégats, commit et événement `campaign.bootstrapped` avec `CampaignBootstrapRepository`;
9. retourner le résultat idempotent existant en cas de répétition identique.

Les empreintes de l'enveloppe, du paquet, du ruleset et de la source personnage participent au `requestFingerprint`. Une même clé d'idempotence avec une empreinte différente est refusée.

L'implémentation `CampaignBootstrapServiceV1` suit cette séquence derrière deux ports de résolution. Elle vérifie l'identité et la racine du manifeste, chaque source et payload, la parité des entités lore et de leur provenance, ainsi que la présence des entrées de catalogue utilisées par l'import. Elle recalcule niveau, modificateurs, maîtrise, points de vie, classe d'armure et perception passive via le `RuleRegistry`, puis remet une seule requête au `CampaignBootstrapRepository`.

La suite `narration-module:test:orchestration` couvre le démarrage aux Archives de Lysenthe, les six agrégats initiaux, l'événement, le rejeu idempotent et huit frontières de rejet sans campagne partielle. Les jonctions UI, créateur et plateau restent volontairement hors de ce service.

## 9. Preuves exigées pour fermer I-02

- génération déterministe deux fois du même paquet avec empreintes identiques;
- échec sur fichier wiki brut non déclaré, doublon, clé inconnue et référence requise absente;
- import des Archives de Lysenthe avec provenance jusqu'au fichier et au champ;
- import de la fiche prête à jouer, sans lecture de `localStorage` par le domaine;
- égalité des projections recalculées entre import et plateau tactique;
- rejets ciblés de la section 5.5;
- chargement du ruleset, détection d'un conflit et citation des versions;
- NAR-ACC-008 : impossibilité refusée avant jet et consommation;
- checkpoint A de NAR-ACC-009 : apparence visible et inventaire issus de la projection autoritaire;
- NAR-ACC-021 : règle maison prioritaire et arbitrage ponctuel non promu;
- bootstrap atomique, idempotent et relisible après fermeture/réouverture IndexedDB;
- panne injectée à chaque étape d'écriture sans campagne partielle observable;
- reprise d'une issue inconnue avec les identités originales et restitution du même commit;
- build global et suites I-00/I-01 toujours verts.

## 10. Hors périmètre d'I-02

- recherche sémantique et mémoire longue;
- appel à un fournisseur IA;
- création dynamique de lieu, PNJ, événement ou intrigue;
- progression de niveau complète dans l'interface;
- résolution d'un tour tactique;
- influence sociale équilibrée en valeurs définitives;
- migration automatique d'une campagne vers un nouveau paquet ou ruleset.

Ces exclusions n'empêchent pas les schémas d'être compatibles avec les lots ultérieurs. Elles empêchent I-02 de devenir une réécriture simultanée du wiki, de l'éditeur et du moteur tactique.
