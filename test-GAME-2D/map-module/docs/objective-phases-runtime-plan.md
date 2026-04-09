# Objective Phases Runtime Plan

## Statut

Document de reference actif.

Ce document fige la cible produit et technique pour l'integration des phases d'objectif dans `map-module`.

Regle de gouvernance :

- ce document est la source de verite sur la mecanique cible ;
- les choix d'implementation doivent converger vers ce modele ;
- la roadmap en bas du document doit etre mise a jour a chaque lot significatif ;
- on ne maintient pas de second plan concurrent dans un autre fichier.

## But

Transformer les `phases` d'objectif en mecanique runtime reelle.

Concretement :

- une phase doit restreindre les actions possibles ;
- une phase doit pouvoir porter ses propres prerequis ;
- une phase doit pouvoir definir une cible locale d'execution ;
- une phase doit avoir ses propres conditions de completion ;
- le passage de phase doit etre calcule par le runtime ;
- l'echec de phase doit pouvoir bloquer ou faire echouer l'objectif ;
- l'editeur doit afficher la phase active et ses contraintes runtime.

## Positionnement

Les phases ne remplacent pas les objectifs.

Le bon niveau de responsabilite est :

- l'objectif = intention strategique globale ;
- la phase = etape operationnelle active ;
- la faction = porteur strategique de l'objectif ;
- le mobile = executant concret principal ;
- la ville / le quartier / la route / la region = referentiel spatial ;
- l'ancrage = prerequis local d'execution ;
- la pression = facteur de faisabilite et de score ;
- la logistique = capacite de projection.

## Invariants

Contraintes non negociables :

1. `world-simulation` reste l'unique runtime.
2. La carte et `layout.simulation` restent la source de donnees.
3. Les phases ne sont pas purement editoriales.
4. Le moteur ne doit pas ignorer `currentPhaseIndex`.
5. Une action ne doit plus etre choisie seulement sur l'objectif global si une phase active existe.
6. Une phase doit etre lisible dans la trace runtime.
7. Une phase doit pouvoir etre `ready`, `blocked`, `completed` ou `failed` sans perdre la coherence de l'objectif global.
8. Le systeme doit rester compréhensible sur la sandbox existante.

## Probleme Actuel

Etat actuel constate dans le code :

- `phases` et `currentPhaseIndex` sont charges dans `SpecialObjective` ;
- `objectiveReadiness.ts` ne calcule pas la readiness de phase ;
- `engine.ts` ne lit pas la phase active pour filtrer les actions ;
- `engine.ts` ne fait jamais avancer `currentPhaseIndex` ;
- `progress` est la seule vraie progression runtime ;
- `onSuccess` fonctionne au niveau objectif ;
- `onFailure` n'est pas un mecanisme complet ;
- les factions runtime restent branchees sur `objectiveHints` derives, tandis que les mobiles utilisent les objectifs explicites de l'editeur.

Conclusion :

- les phases sont presentes en donnees ;
- elles ne sont pas encore presentes en comportement.

## Modele Cible

### SpecialObjective

Le type runtime `SpecialObjective` doit evoluer pour inclure une vraie representation de phase.

Modele cible :

```ts
type ObjectivePhaseState = "planned" | "active" | "blocked" | "completed" | "failed";

type ObjectivePhaseCompletionMode =
  | "progress_threshold"
  | "action_count"
  | "presence"
  | "anchor_established";

type ObjectivePhaseFailureMode =
  | "score_threshold"
  | "fatal_condition";

type ObjectivePhaseRuntime = {
  id: string;
  label: string;
  description?: string;
  state: ObjectivePhaseState;
  localTarget?: EntityRef;
  zoneIds: EntityId[];
  compatibleActionIds: WorldActionId[];
  requiredAnchorId?: EntityId;
  requiredAnchorType?: string;
  progress: number;
  progressWeight: number;
  completionMode: ObjectivePhaseCompletionMode;
  completionThreshold: number;
  actionCountById?: Partial<Record<WorldActionId, number>>;
  requiredPresenceRef?: EntityRef;
  failureScore: number;
  maxFailureScore: number;
  failureMode: ObjectivePhaseFailureMode;
  fatalFailureConditions: string[];
  notes?: string[];
};

type SpecialObjective = {
  id: EntityId;
  category: ObjectiveCategory;
  owner: EntityRef;
  target?: EntityRef;
  priority: number;
  state: ObjectiveState;
  progress: number;
  zoneIds: EntityId[];
  phases: ObjectivePhaseRuntime[];
  currentPhaseIndex: number;
  phaseHistory: Array<{
    phaseId: string;
    enteredAtTick: number;
    exitedAtTick?: number;
    outcome: "advanced" | "blocked" | "failed";
  }>;
  obstacles: string[];
  compatibleActionIds: WorldActionId[];
  requiredAnchorId?: EntityId;
  requiredAnchorType?: string;
  failureScore: number;
  maxFailureScore: number;
  fatalFailureConditions: string[];
  onSuccess: ConsequenceTemplate[];
  onFailure: ConsequenceTemplate[];
  tags: string[];
};
```

## Interpretation Runtime

### Objectif global

L'objectif global reste responsable de :

- l'intention ;
- la priorite globale ;
- la cible logique globale ;
- la completion finale ;
- l'echec final ;
- les consequences finales `onSuccess` et `onFailure`.

### Phase active

La phase active devient responsable de :

- la cible locale d'execution ;
- la zone locale d'action ;
- les actions autorisees ;
- les prerequis locaux ;
- la progression locale ;
- l'echec local ;
- la decision de passage a la phase suivante.

## Relation Avec Les Autres Mecaniques

### Factions

La faction porte la strategie mais ne doit pas court-circuiter la phase.

Regle :

- le score strategique reste au niveau objectif ;
- la selection d'action se fait au niveau de la phase active ;
- une faction doit chercher a servir la phase active, pas seulement l'objectif abstrait.

### Mobiles

Le mobile est l'executant principal des phases.

Regle :

- un mobile lie a un objectif doit agir selon la phase active ;
- la phase doit pouvoir orienter le besoin de projection, d'escorte, de patrouille, d'investigation ou de recrutement ;
- les sorties de trace doivent permettre de voir quel mobile sert quelle phase.

### Villes / Quartiers / Routes / Regions

Ces entites restent les referentiels spatiaux.

Regle :

- l'objectif conserve sa cible logique ;
- la phase peut redefinir une cible locale plus precise ;
- la readiness et la logistique doivent raisonner d'abord sur la cible locale si elle existe ;
- sinon fallback sur la cible logique de l'objectif.

### Ancrages

L'ancrage devient d'abord une contrainte de phase.

Regle :

- si la phase active exige un ancrage, c'est elle qui bloque ;
- l'ancrage d'objectif global ne doit servir que de fallback si la phase n'en declare pas.

### Pressions

Les pressions continuent d'influencer le score d'action, mais la phase peut changer quelles actions sont eligibles.

Regle :

- on ne recode pas le systeme de pressions dans ce chantier ;
- on exploite d'abord la phase pour restreindre les actions, les cibles et les prerequis ;
- un raffinement de ponderation par phase pourra venir apres si necessaire.

### Logistique

La logistique doit servir la phase active.

Regle :

- le plan logistique doit viser la cible locale de phase si elle existe ;
- sinon il vise la cible globale d'objectif.

## Readiness Cible

La readiness doit etre calculee par phase active.

Ordre de resolution :

1. recuperer l'objectif ;
2. recuperer la phase active ;
3. resoudre la cible d'execution de phase ;
4. verifier l'ancrage de phase ;
5. verifier les prerequis de phase ;
6. si la phase est invalide, la marquer `blocked` ;
7. si aucune phase n'est active, l'objectif est invalide ;
8. si la phase est prete, l'objectif peut rester `planned` ou `active`.

La trace doit exposer au minimum :

- `objectiveId`
- `phaseId`
- `phaseStateBefore`
- `phaseStateAfter`
- `executionTargetRef`
- `matchedAnchorId`
- `reasons`

## Selection D'Action Cible

Le moteur doit choisir les actions a partir de la phase active.

Regle de filtrage :

1. si l'objectif a une phase active :
   - utiliser `activePhase.compatibleActionIds`
2. sinon :
   - utiliser `objective.compatibleActionIds`
3. dans tous les cas :
   - l'action doit rester compatible avec la categorie d'objectif

Regle de cible :

1. si la phase a `localTarget` :
   - la cible de phase est prioritaire
2. sinon :
   - on reprend la cible d'objectif

## Progression Cible

Le systeme doit distinguer deux progressions :

- `objective.progress` = progression globale ;
- `activePhase.progress` = progression locale de la phase courante.

Regles :

1. une action reussie peut faire monter la progression de phase ;
2. cette progression contribue aussi a la progression globale selon `progressWeight` ;
3. une action ratee peut faire monter `phase.failureScore` ;
4. quand la phase atteint sa condition de completion :
   - `phase.state = completed`
   - passage a la phase suivante ;
5. quand la derniere phase est terminee :
   - `objective.state = completed`
   - `onSuccess` s'applique.

## Echec Cible

Le systeme doit gerer l'echec local avant l'echec global.

Regles :

1. un echec d'action ne fait pas automatiquement echouer l'objectif ;
2. il peut augmenter `phase.failureScore` ;
3. si `phase.failureScore >= phase.maxFailureScore` :
   - la phase devient `failed` ou `blocked` selon sa configuration ;
4. si la phase est fatale pour l'objectif :
   - l'objectif passe `failed` ;
5. si `objective.failureScore >= objective.maxFailureScore` :
   - l'objectif passe `failed` ;
6. `onFailure` s'applique seulement au niveau objectif final.

## Regles De Transition De Phase

Regles cibles :

1. `currentPhaseIndex` pointe toujours vers une phase valide.
2. Une seule phase peut etre `active`.
3. Les phases precedentes sont `completed`.
4. Les phases suivantes sont `planned`.
5. La transition se fait uniquement via le runtime.
6. L'editeur n'impose pas directement la phase active sans validation runtime.

## Representation Editoriale Cible

Le format editeur doit converger vers des phases structurees, pas des labels seuls.

Format cible dans `layout.simulation.specialObjectives` :

```ts
type WorldMapSimulationObjectivePhase = {
  id: string;
  label: string;
  description?: string;
  localTargetKind?: SimulationObjectiveTargetKind;
  localTargetId?: string;
  zoneIds?: string[];
  compatibleActionIds: string[];
  requiredAnchorId?: string;
  requiredAnchorType?: string;
  completionMode: "progress_threshold" | "action_count" | "presence" | "anchor_established";
  completionThreshold: number;
  maxFailureScore?: number;
  fatalFailureConditions?: string[];
};
```

Regle :

- a terme, `phases: string[]` ne doit plus etre le modele d'edition cible.

## Decision Importante Sur Les Factions

Le branchement actuel des factions sur `objectiveHints` ne doit pas rester le modele principal pour les objectifs de simulation explicites.

Decision cible :

- les factions runtime doivent pouvoir referencer les `specialObjectives` explicites du layout ;
- les `objectiveHints` restent editoriaux ou secondaires ;
- un objectif de la carte ne doit pas vivre principalement dans les mobiles pendant que la faction porteuse l'ignore.

Cette correction fait partie du chantier phases, car sinon la phase active ne pilote qu'une partie du systeme.

## Fichiers Cibles

Le chantier concerne en priorite :

- `test-GAME-2D/map-module/data/worldMapLayout.ts`
- `test-GAME-2D/map-module/world-simulation/types.ts`
- `test-GAME-2D/map-module/world-simulation/mapAdapter.ts`
- `test-GAME-2D/map-module/world-simulation/objectiveReadiness.ts`
- `test-GAME-2D/map-module/world-simulation/engine.ts`
- `test-GAME-2D/map-module/world-simulation/definitions.ts`
- `test-GAME-2D/map-module/world-simulation/preflight.ts`
- `test-GAME-2D/map-module/ui/WorldMapEditorScreen.tsx`

## Roadmap

### Lot 1 - Type System Et Mapping Runtime

Statut : `completed`

But :

- introduire la structure de phase runtime reelle ;
- brancher le mapping depuis `layout.simulation`.

Travail :

- ajouter les types de phase cote layout et runtime ;
- retirer la dependance produit au simple `string[]` ;
- mettre a jour `mapAdapter.ts` ;
- aligner `preflight.ts`.

Definition of done :

- les objectifs runtime possedent des phases structurees ;
- la sandbox charge ce format sans ambiguite.

### Lot 2 - Readiness Et Cible Locale De Phase

Statut : `completed`

But :

- rendre la readiness dependante de la phase active.

Travail :

- calcul de `activePhase` ;
- resolution de `localTarget` ;
- verification des ancrages et prerequis de phase ;
- enrichissement de la trace.

Definition of done :

- une phase peut etre `blocked` meme si l'objectif global existe ;
- la trace explique pourquoi.

### Lot 3 - Selection D'Action Par Phase

Statut : `completed`

But :

- faire en sorte que la phase active controle les actions eligibles.

Travail :

- filtrer les actions via `activePhase.compatibleActionIds` ;
- cibler `localTarget` quand il existe ;
- verifier que la logistique vise la phase active.

Definition of done :

- changer de phase change effectivement les actions candidates retenues.

### Lot 4 - Progression Et Transition De Phase

Statut : `completed`

But :

- faire avancer automatiquement les phases.

Travail :

- ajouter `phase.progress` ;
- ajouter les conditions de completion ;
- faire avancer `currentPhaseIndex` ;
- tracer les transitions.

Definition of done :

- une phase peut etre completee ;
- l'objectif passe a la suivante sans intervention manuelle.

### Lot 5 - Echec De Phase Et Echec Global

Statut : `completed`

But :

- donner une vraie mecanique d'echec.

Travail :

- ajouter `failureScore` de phase ;
- definir les conditions fatales ;
- brancher `objective.failed` ;
- appliquer `onFailure`.

Definition of done :

- on peut lire pourquoi une phase ou un objectif a echoue.

### Lot 6 - Alignement Factions / Mobiles / Objectifs Explicites

Statut : `completed`

But :

- faire converger tout le systeme vers les objectifs explicites de la carte.

Travail :

- brancher les factions runtime sur les `specialObjectives` pertinents ;
- reduire le role primaire des `objectiveHints` ;
- verifier que factions et mobiles poursuivent la meme intention strategique.

Definition of done :

- un objectif explicite est partage de facon coherente entre porteur strategique et executants.

### Lot 7 - Editeur Et Debug

Statut : `completed`

But :

- rendre la mecanique observable et editable.

Travail :

- edition structuree des phases ;
- affichage de la phase active ;
- affichage des prerequis, actions autorisees et score d'echec ;
- lecture de trace dans l'UI.

Definition of done :

- l'editeur montre clairement quelle phase tourne et pourquoi.

## Ordre D'Execution Immediat

Ordre retenu :

1. Lot 1
2. Lot 2
3. Lot 3
4. Lot 4
5. Lot 5
6. Lot 6
7. Lot 7

## Verification Minimale

Apres chaque lot :

- lancer `npm run build` dans `test-GAME-2D` ;
- verifier la sandbox `simulation_sandbox.json` ;
- verifier qu'un objectif avec phases reste lisible dans l'editeur ;
- verifier que `currentPhaseIndex` a un effet observable si le lot le concerne ;
- verifier les sorties `trace` du tick.

## Etat Initial Au Moment Du Gel

Etat du code lors de la redaction de ce document :

- preview carte des objectifs : en cours ;
- phases runtime : types et mapping structures implementes ;
- readiness par phase : implemente ;
- selection d'action par phase : implemente ;
- transitions de phase : implementees ;
- echec de phase et echec global : implementes ;
- alignement factions sur objectifs explicites : implemente ;
- editeur structure de phases et debug runtime : implementes.
