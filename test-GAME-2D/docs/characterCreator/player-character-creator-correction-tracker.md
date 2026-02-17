# PlayerCharacterCreator - Plan de correction (tracker)

Ce document suit les corrections necessaires pour garder un module **100% data-driven**
et eviter toute logique speciale par classe/sous-classe.

## Objectif

1. Supprimer les points de couplage qui obligent a toucher du code a chaque nouvelle classe/feature.
2. Uniformiser la projection des `grants` entre creator et runtime.
3. Stabiliser le systeme de ressources (id/pool/scaling) avec des regles explicites.

## Probleme constates (baseline)

1. `src/game/featureCatalog.ts` est mappe en dur (imports + objet statique), donc pas "JSON only".
2. `buildDerivedGrants` (creator) ne projette pas tous les `grant.kind` (`action`, `reaction`, `resource`, `passif` absents).
3. Le scaling ressource runtime depend de conventions implicites (`feature.tags`).
4. Le support meta des ressources est partiel (pool/recharge/evolutions peu exposes).

## Statuts

1. `todo`
2. `in_progress`
3. `blocked`
4. `done`

## Phases

```json
{
  "feature": "player-character-creator-corrections",
  "version": 1,
  "phases": [
    {
      "id": "catalog-data-driven",
      "status": "in_progress",
      "deliverables": [
        "chargement features sans mapping manuel par id",
        "process de generation/documentation mis a jour"
      ]
    },
    {
      "id": "creator-grants-parity",
      "status": "in_progress",
      "deliverables": [
        "projection creator alignee sur toute la taxonomie grants",
        "derived structure stable pour action/reaction/resource/passif"
      ]
    },
    {
      "id": "runtime-resource-model",
      "status": "done",
      "deliverables": [
        "modele explicite id/pool/scaling dans les metas",
        "deriveRuntimeFromFeatures sans heuristique fragile"
      ]
    },
    {
      "id": "ui-sync",
      "status": "done",
      "deliverables": [
        "affichage coherent des nouvelles projections dans les tabs",
        "sheet recap et validation conformes"
      ]
    },
    {
      "id": "qa-regression",
      "status": "todo",
      "deliverables": [
        "scenario cleric channel divinity valide",
        "ajout d une nouvelle feature sans code special valide"
      ]
    }
  ]
}
```

## Taches detaillees

### Phase 1 - catalog-data-driven
- [x] Definir la source unique pour l index des features.
- [x] Supprimer la dependance aux imports manuels par feature.
- [x] Garantir qu une feature JSON ajoutee est resolue sans edition de TS metier.
- [ ] Documenter la commande de generation/verification associee.

### Phase 2 - creator-grants-parity
- [x] Etendre `derived.grants` pour couvrir la taxonomie utile runtime:
- [x] `actions`, `reactions`, `resources`, `passifs` (en plus des champs deja existants).
- [x] Verifier que classe + sous-classe + race + background s accumulent de facon deterministe.
- [x] Conserver retro-compatibilite des donnees deja sauvegardees.

### Phase 3 - runtime-resource-model
- [x] Formaliser `grant.meta` pour `resource` (ex: `maxByLevel`, `pool`, `recharge`).
- [x] Eviter le deduit implicite par tags quand une source explicite est disponible.
- [x] Aligner la cle runtime avec `resourceKey(pool,name)` et conventions docs.
- [x] Tester la consommation/restauration via operations generiques engine.

### Phase 4 - ui-sync
- [x] Verifier tabs (`Classes`, `Magic`, `Sheet`) sur les nouveaux champs derives.
- [x] Assurer lock/unlock/pending choices sans regressions.
- [x] Confirmer que `buildCharacterSave` persiste toutes les projections.

### Phase 5 - qa-regression
- [ ] Valider `channel-divinity` (charges, recuperation repos court/long, usage action).
- [ ] Valider ajout d une feature de test sans branche `if classId`.
- [ ] Executer checks contenu + smoke test creation -> sauvegarde -> combat.

## Criteres d acceptation

1. Ajouter une nouvelle feature de classe ne demande pas de modifier du code metier specifique a cette classe.
2. Les grants declares en JSON sont visibles dans `derived` et appliques runtime.
3. Les ressources sont configurees par data (`id/pool/meta`) et executees par ops generiques.
4. UI creator et runtime combat restent synchronises apres save/load.

## Journal d avancement

### 2026-02-12
- Baseline documentee.
- Phases et checklist initialisees.
- Phase `catalog-data-driven` passee en `in_progress`.
- `src/game/featureCatalog.ts` migre vers chargement automatique (`import.meta.glob`) base sur `src/data/characters/features/index.json`.
- Phase `creator-grants-parity` passee en `in_progress`.
- `buildDerivedGrants` etendu avec normalisation des `grant.kind` (singulier/pluriel/alias) et projection de `actions`, `reactions`, `resources`, `passifs`.
- Phase `runtime-resource-model` passee en `done`.
- `deriveRuntimeFromFeatures` migre vers un scaling explicite via `grant.meta.scale` + fallback `progressionHistory` (source classe/sous-classe), sans heuristique sur `feature.tags`.
- Support `grant.meta.pool` branche sur `resourceKey(pool,name)`.
- Validation de la chaine ressource: `usage.resource.pool` + ops `SpendResource/RestoreResource` + `getResourceAmount(name,pool)` confirmee.
- Phase `ui-sync` passee en `done`.
- `SheetTab` affiche maintenant explicitement la projection `derived.grants` (features/actions/reactions/resources/passifs/spells) pour verifier la coherence creator -> runtime.
- Extension du flux `startClassDefine` avec un support generique de `feature choices` base sur `feature.rules.choices` (aucun branchement dedie `fighter`).
- Ajout d un stockage canonique des choix de features de classe dans `choiceSelections.classFeatures`.
- Synchronisation save pipeline: les choix de features de classe sont maintenant projetes dans `derived.grants` et traces dans `progressionHistory` (`kind: class-feature-option`).
- Cas Guerrier branche en data pure: `fighting-style` expose un choix declaratif + options mappees vers des features partagees (`src/data/characters/features/shared/*`) indexees dans `src/data/characters/features/index.json`.
- Runtime etendu avec un support generique de `feature.rules.modifiers` (combatStat/attack/damage) applique sans condition de classe.
- Runtime etendu avec un support generique de `feature.rules.modifiers` (combatStat/attack/damage/damageReroll) applique sans condition de classe.
- Styles de combat branches en data: `archery`, `defense`, `dueling`, `great-weapon-fighting` actifs via modificateurs declaratifs.
- Styles non encore couverts par les hooks actuels (`protection`, `interception`, `two-weapon-fighting`) conserves en description et traces pour phase QA/mecanique.
