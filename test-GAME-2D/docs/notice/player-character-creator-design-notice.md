# Notice de conception - PlayerCharacterCreator

Ce document sert de reference complete pour modifier **l UI** et **les mecaniques de creation** sans casser le pipeline runtime.

Objectif principal:
- Eviter le code special classe/sous-classe.
- Faire passer les nouvelles regles via donnees JSON (`grants`, `features`, `actions`, `resources`) et resolvers generiques.

## 1) Perimetre du module

Module principal:
- `src/PlayerCharacterCreator/CombatSetupScreen.tsx`

Sous-composants UI importants:
- `src/PlayerCharacterCreator/tabs/ClassesTab.tsx`
- `src/PlayerCharacterCreator/tabs/MagicTab.tsx`
- `src/PlayerCharacterCreator/tabs/SheetTab.tsx`

Point de handoff vers le combat:
- `src/GameBoard.tsx`

Types contractuels:
- `src/types.ts`
- `src/game/classTypes.ts`
- `src/game/featureTypes.ts`

## 2) Source of truth et catalogues

### 2.1 Catalogues classes/sous-classes

Le creator charge classes/sous-classes via:
- `src/PlayerCharacterCreator/catalogs/classCatalog.ts`

Ce fichier est auto-genere depuis:
- `src/data/characters/classes/index.json`

Commande:
- `npm run gen:class-catalog`

### 2.2 Catalogues actions/materiel

Auto-generation au `dev/build`:
- `scripts/gen-action-catalog.js`
- `scripts/gen-materiel-catalog.js`
- `scripts/gen-class-catalog.js`

Defini dans:
- `package.json` scripts `dev` et `build`.

### 2.3 Features

Les features runtime sont chargees via:
- `src/game/featureCatalog.ts`
- `src/data/characters/features/index.json`

Important: une feature doit etre presente dans l index. Le catalog runtime la charge ensuite automatiquement (pas de mapping manuel par id).

## 3) Etat canonique du personnage

Type principal:
- `Personnage` dans `src/types.ts`

Champs critiques utilises par le creator:
- `classe`: slots de classes (`1`, `2`) avec `{ classeId, subclasseId, niveau }`.
- `niveauGlobal`.
- `choiceSelections`: etat transitoire + choix utilisateur (ASI, magie, pending locks, etc.).
- `choiceSelections.classFeatures`: selections de choix de features de classe/sous-classe (data-driven, par `rules.choices`).
- `creationLocks`: lock des sections (`species`, `backgrounds`, `classes`, `magic`, etc.).
- `classLocks`: lock par slot de classe (`primary`, `secondary`).
- `actionIds`, `reactionIds`: base explicite non derivee.
- `spellcastingState`: projection finale de la magie.
- `derived`: projection derivee des grants (traits/features/spells/etc.).
- `progressionHistory`: historique declaratif de ce qui a ete gagne/choisi.

Regle:
- `choiceSelections` contient le "work in progress" UI.
- `derived` + `spellcastingState` + `progressionHistory` sont reconstruits au save (`buildCharacterSave`).

## 4) Flux UI de creation

### 4.1 Locks

Deux couches de lock:
1. `creationLocks[section]` pour les grandes sections.
2. `classLocks.primary/secondary` pour verrouiller les classes par slot.

Fonctions cle:
- `setSectionLock` / `toggleSectionLock`
- `setClassLockForSlot`
- `buildClassLockCharacter`
- `startClassDefine`
- `resetClassImpactsForSlot`

### 4.2 Pending choices (avant lock final)

Quand une section a des choix obligatoires non resolves:
- stocker dans `choiceSelections.pendingLocks`.
- lancer les modals/choix requis.
- locker seulement quand les choix sont completes.

Exemple classes:
- `startClassDefine(slot)` ouvre choix sous-classe/feature choices/ASI restants.
- puis `buildClassLockCharacter` applique equipement auto + sorts imposes + lock.

### 4.3 Reset

Les fonctions de reset doivent:
- retirer impacts de la source (skills, tools, ASI, equip auto, inventaire auto, etc.).
- remettre le lock cible a false.
- nettoyer `pendingLocks` correspondants.

### 4.4 Harmonisation d'items (one-click)

L'onglet equipement expose un bouton d'harmonisation direct (1 clic) dans l'inventaire, a cote des actions item (vente, etoile arme principale, etc.).

Comportement:
1. Le bouton n'apparait que pour les items harmonisables (`weapon/armor/object` avec `harmonisable: true`).
2. Le clic toggle `harmoniser/desharmoniser` sans ouvrir de modal.
3. Le creator met a jour les marqueurs sur l'item d'inventaire et la table globale `character.attunements`.

Marqueurs ecrits par le creator:
1. `inventoryItem.harmonized`
2. `inventoryItem.isHarmonized`
3. `inventoryItem.attuned`
4. `inventoryItem.attunement` (`state`, `harmonizedAt`)
5. `character.attunements` (cles `instanceId`, `instance:<id>`, `itemId`, `item:<id>`)

But:
1. Faciliter le debug des bonus d'equipement conditionnes a l'harmonisation.
2. Rester compatible avec le resolver runtime qui accepte plusieurs conventions de marquage.

## 5) Progression et grants (coeur adaptatif)

### 5.1 Collecte

`collectProgressionGrantEntries(progression, level, source)`:
- lit les niveaux <= niveau courant.
- extrait `grants[]` de chaque niveau.
- retourne des entrees normalisees `{ source, level, kind, ids }`.

`collectProgressionSources()` harmonise la collecte des sources:
- `race:<id>` et `background:<id>` avec `niveauGlobal`.
- `class:<id>` et `subclass:<id>` avec niveau de classe.

Regle:
- une nouvelle source de progression doit passer par cette collecte commune,
- ne pas dupliquer des boucles de progression separees par type de source.

### 5.2 Historique

`buildProgressionHistory()` ajoute:
- choix race/background (skills, tools, languages),
- choix de features de classe (`payload.kind = class-feature-option`),
- choix ASI/feat,
- grants de progression race/background (sur niveau global),
- grants classes/sous-classes (sur niveaux de classe),
- justification des slots de sort (via `spellcastingState.slotJustifications`).

### 5.3 Projection derivee

`buildDerivedGrants()` construit:
- `derived.grants.traits`
- `derived.grants.features`
- `derived.grants.feats`
- `derived.grants.skills`
- `derived.grants.weaponMasteries`
- `derived.grants.tools`
- `derived.grants.languages`
- `derived.grants.spells`
- `derived.grants.actions`
- `derived.grants.reactions`
- `derived.grants.resources`
- `derived.grants.passifs`

et integre aussi les `grants` portes par les options choisies dans `choiceSelections.classFeatures`.

C est cette projection qui permet a `GameBoard` de resoudre des effets sans coder une classe en dur.

## 6) Pipeline magie

### 6.1 Sources magiques

`magicSources` est derive des classes/sous-classes lockees qui exposent `spellcasting`.

Chaque source inclut:
- ability / preparation / storage / casterProgression
- focusTypes
- spellFilterTags
- freePreparedFromGrants
- slotsByLevel
- classLevel

### 6.2 Selections utilisateur

Dans `choiceSelections.spellcasting[sourceKey]`:
- `knownSpells`
- `preparedSpells`
- `grantedSpells`
- `focusItemId` / `focusInstanceId`
- `storage`
- `grimoireItemId`

### 6.3 Etat final

`buildSpellcastingState()` produit:
- `totalCasterLevel`
- `slots` (max + remaining)
- `sources` (prepared/known/granted par source)
- `slotJustifications`

## 7) Sauvegarde et persistance

`buildCharacterSave()` centralise la projection finale:
- normalise langues,
- recalcule `derived`, `spellcastingState`, `progressionHistory`,
- reconstruit snapshot inventaire,
- conserve les champs de fiche.

Stockage local:
- `jdr5e_saved_sheets`
- `jdr5e_active_sheet`

Regle importante:
- le combat lit de preference la fiche active sauvegardee (si disponible), sinon fallback.

## 8) Handoff runtime vers ActionEngine

Dans `GameBoard.tsx`:
1. build stats combat depuis le personnage.
2. derive runtime via `deriveRuntimeFromFeatures(character)`.
3. fusionne `actionIds`/`reactionIds` explicites + derives.
4. initialise ressources runtime.

### 8.1 Resolution des features

`deriveRuntimeFromFeatures` lit:
- `character.derived.grants.features`
- definitions dans `featureCatalog`

Puis applique leurs `grants`:
- `kind=action` -> ajoute actions runtime
- `kind=reaction` -> ajoute reactions runtime
- `kind=resource` -> initialise pools ressources

Pour `kind=resource`, utiliser en priorite `grant.meta`:
- `maxByLevel`: table de scaling par niveau.
- `scale`: source de scaling explicite (ex: `{\"basis\":\"class\",\"classId\":\"cleric\"}`).
- `pool`: namespace optionnel de la ressource.

### 8.2 Cle de ressource

Convention runtime:
- cle interne = `${pool ?? "default"}:${name}`
- helper: `resourceKey(name, pool)`

Donc eviter les tokens hardcodes type "cleric_*".
Preferer:
- un `id` de ressource stable (ex: `channel-divinity`)
- et eventuellement `pool` si besoin de separer des usages.

### 8.3 Operations moteur deja generiques

ActionEngine supporte deja des ops declaratives:
- `SpendResource`, `RestoreResource`, `SetResource`
- `ConsumeSlot`, `RestoreSlot`
- etc.

Donc une classe n a pas besoin de code special si ses actions/features sont bien data-driven.

### 8.4 Modificateurs declaratifs de feature (runtime)

Le runtime supporte des modificateurs portes par `feature.rules.modifiers` pour ajuster les stats/actions sans hardcode de classe.

Format actuellement supporte:
- `applyTo: "combatStat"` avec `stat` (`armorClass`, `attackBonus`, `maxHp`) et `value`.
- `applyTo: "attack"` avec `value` (bonus au jet d attaque de l action resolue).
- `applyTo: "damage"` avec `value` (bonus plat ajoute a la formule de degats de l action resolue).
- `applyTo: "damageReroll"` avec `value` (seuil max de relance des des de degats, ex `2` pour relancer les 1-2).
- `rules.reactionModifiers` (reactions passives data-driven): `incomingAttack` (`imposeDisadvantage`) et `incomingAttackHit` (`reduceDamage` avec `formula`).
- `rules.secondaryAttackPolicy`: gestion declarative de l attaque secondaire (ex: ajout du mod de carac aux degats).

Filtres `when` actuellement supportes:
- `actorType`
- `actionCategory`
- `actionCostType`
- `actionTagsAny` / `actionTagsAll`
- `weaponCategory` ou `weaponCategories`
- `weaponTwoHanded`
- `weaponLight`
- `requiresArmor`
- `requiresShield`
- `requiresOffhandWeapon`
- `requiresNoOffhandWeapon`
- `targetMustBeAlly`
- `targetMustNotBeSelf`
- `targetVisible`
- `maxDistanceToTarget`

Reference schema:
- `docs/notice/feature-modifiers-notice.md`

## 9) Regles d extension (obligatoires)

1. Pas de branche `if (classId === "...")` dans le moteur/creator.
2. Ajouter des capacites via JSON (`progression.grants`, `features`, `actions`, `reactions`).
3. Si un besoin n est pas modelisable, enrichir un schema generique (types + resolvers), pas une exception classe.
4. Toute nouvelle resource doit suivre la convention `name/pool` et operations generiques.
5. Toujours verifier l impact UI (tabs lock, pending choices, Sheet recap, validation).

## 10) Procedure recommandee pour une IA

### Cas A - Ajouter une capacite de classe sans nouveau code

1. Ajouter/mettre a jour `progression.grants` dans class/subclass.
2. Creer/mettre a jour feature JSON dans `src/data/characters/features/...`.
3. Si la feature demande un choix utilisateur, declarer `rules.choices` dans la feature (title/count/options/grants).
4. Ajouter action/reaction JSON si necessaire.
5. Mettre a jour indexes/catalogues (et generation si besoin).
6. Verifier que `buildDerivedGrants` remonte bien la feature.
7. Verifier que `deriveRuntimeFromFeatures` injecte actions/reactions/resources.

### Cas B - Ajuster UI creator

1. Modifier composant tab cible (`ClassesTab`, `MagicTab`, `SheetTab`...).
2. Conserver le contrat `choiceSelections` et systeme de locks.
3. Ne jamais stocker un etat final uniquement dans UI locale.
4. Verifier la sortie de `buildCharacterSave()`.

### Cas C - Nouveau besoin mecanique

1. Definir le besoin en terme d operations generiques (resource/slot/effect/condition).
2. Etendre `featureTypes`/taxonomy si indispensable.
3. Ajouter resolver generique cote runtime.
4. Documenter la regle dans `docs/notice/*`.

## 11) Checklist anti-regression

- [ ] `npm run validate:content` passe.
- [ ] generation catalogues executee si index modifies.
- [ ] classes/sous-classes visibles dans creator.
- [ ] lock/unlock sections fonctionne.
- [ ] pending choices se resolvent avant lock.
- [ ] save/load fiche conserve `derived`, `spellcastingState`, `progressionHistory`.
- [ ] combat charge actions/reactions/features attendues.
- [ ] ressources depense/restaure fonctionnent via ops generiques.

## 12) Anti-patterns a eviter

- Ajouter un token/flag dedie a une classe si un couple `resource id + pool` suffit.
- Multiplier les champs one-shot dans `Personnage` pour une seule classe.
- Coupler UI tab a un ID de classe specifique.
- Mettre de la logique mecanique dans du texte de description uniquement.

## 13) Resume operatoire

Le PlayerCharacterCreator doit rester un orchestrateur data-driven:
- les JSON de contenu declarent les gains,
- le creator projette ces gains (`derived`, `spellcastingState`, `progressionHistory`),
- GameBoard les transforme en runtime (actions/reactions/resources),
- ActionEngine execute via operations generiques.

Si une classe impose une modif code specifique, c est en general le signe qu un schema generique manque.

## 14) Liens utiles

- Navigation globale notices: `docs/notice/notice-navigation.md`
- Checklist auteur de contenu: `docs/notice/content-author-checklist.md`
- Regles communes de progression: `docs/characterCreator/progression-schema.md`
- Creation classes/sous-classes: `docs/notice/class-design-notice.md`, `docs/notice/subclass-design-notice.md`
- Creation races/backgrounds: `docs/notice/race-design-notice.md`, `docs/notice/background-design-notice.md`
- Features runtime: `docs/notice/feature-modifiers-notice.md`
- Actions pipeline: `docs/ActionEngine/action-creation-notice.md`, `docs/ActionEngine/action-pipeline-taxonomy.md`
