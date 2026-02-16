# Plan d integration - Provenance des sorts (end-to-end)

Ce plan definit une integration complete de la provenance des sorts, de la data au runtime combat, afin de supporter des regles de cout/usage differentes selon la source (classe, sous-classe, feature, item, etc.).

Objectif principal:
- ne plus traiter un sort uniquement par `spellId`,
- conserver et utiliser sa provenance pour l affichage UI et les regles mecaniques (charges item, usages par repos, etc.).

---

## 1) Probleme cible

Etat actuel:
1. Les sorts sont identifies surtout par `spellId`.
2. La provenance existe partiellement (`origin`) mais n est pas un contrat runtime strict.
3. L UI peut perdre des cas (ex: sorts connus EK) si elle lit une seule source.
4. Les regles avancees (sort d item a charge unique par repos long) ne sont pas modelisees de facon canonique.

Impact:
1. Affichage incomplet ou ambigu en fiche combat.
2. Difficulte a appliquer des regles de cout/usage par source.
3. Risque de regressions lors de nouvelles classes/features/items magiques.

---

## 2) Cible fonctionnelle

Chaque sort disponible en combat doit etre represente par une entree avec:
1. identite du sort (`spellId`),
2. provenance (`sourceType`, `sourceId`, `sourceKey`, `sourceInstanceId?`),
3. mode de consommation (`slot`, `resource`, `item_charge`, `free`),
4. limites (`maxUses`, `remainingUses`, `recharge`),
5. metadonnees UI (label source, priorite, tags).

Regle:
1. Un meme `spellId` peut exister via plusieurs sources.
2. Chaque source garde son propre compteur/consommation.

---

## 3) Schema canonique propose

### 3.1 Nouveau type runtime

```ts
type SpellGrantSourceType =
  | "class"
  | "subclass"
  | "race"
  | "background"
  | "feature"
  | "item"
  | "manual";

type SpellUsageType = "slot" | "resource" | "item_charge" | "free";

interface SpellGrantEntry {
  entryId: string; // stable, ex: `${sourceKey}:${spellId}:${mode}`
  spellId: string;
  sourceType: SpellGrantSourceType;
  sourceId: string; // ex: cleric, eldritch-knight, item id, etc.
  sourceKey: string; // ex: class:cleric, subclass:eldritch-knight, item:obj-wand
  sourceInstanceId?: string; // pour item equipe
  usage: {
    type: SpellUsageType;
    resourceName?: string;
    resourcePool?: string;
    maxUses?: number;
    remainingUses?: number;
    recharge?: "turn" | "short_rest" | "long_rest" | "combat";
  };
  grantsPrepared?: boolean;
  grantsKnown?: boolean;
  grantedByProgression?: boolean;
  tags?: string[];
}
```

### 3.2 Extension `spellcastingState`

Ajouter un bloc canonique:

```ts
spellcastingState.spellGrants: Record<string, SpellGrantEntry[]>;
```

Convention:
1. cle = `sourceKey`.
2. valeur = liste des entrees de sort avec provenance complete.

Compat:
1. conserver temporairement `preparedSpellIds`, `knownSpellIds`, `grantedSpellIds`.
2. ces champs deviennent une vue derivee de `spellGrants`.

---

## 4) Integration par couches (impact par niveau)

## 4.1 Data content (JSON)

Changements:
1. Features/items pouvant accorder des sorts doivent definir la source et l usage.
2. Ajouter un schema de `spell grants` pour les items magiques (charges/recharge).

Impact:
1. Nouveau pattern de data pour objets a sort.
2. Pas de hardcode classe.

Exemple item (concept):
```json
{
  "id": "obj-wand-frost",
  "type": "object",
  "grants": [
    {
      "kind": "spell",
      "ids": ["rayon-de-feu"],
      "meta": {
        "usage": {
          "type": "item_charge",
          "maxUses": 1,
          "recharge": "long_rest"
        }
      }
    }
  ]
}
```

## 4.2 Creator (CombatSetupScreen)

Changements:
1. Centraliser la construction de `spellGrants` (classes/sous-classes/races/backgrounds/features/items).
2. `buildSpellcastingState()` produit:
3. `sources` legacy + `spellGrants` canonique.
4. `choiceSelections.spellcasting` continue de stocker les choix UI, mais projection finale va dans `spellGrants`.

Impact:
1. Sorts EK connus/prepares traces explicitement par source.
2. Sources item compatibles sans hack.

## 4.3 Save format

Changements:
1. `buildCharacterSave()` persiste `spellcastingState.spellGrants`.
2. Ajouter migration backward pour fiches sans `spellGrants`:
3. reconstruire depuis `prepared/known/granted` + `choiceSelections`.

Impact:
1. Sauvegardes anciennes encore chargeables.
2. Sauvegardes nouvelles plus expressives.

## 4.4 GameBoard (runtime orchestration)

Changements:
1. `collectSpellActionIds()` lit d abord `spellGrants`, fallback legacy.
2. Construction des actions visibles preserve les doublons par source logique (pas par id brut).
3. Consommation de sort deleguee selon `usage.type`.

Impact:
1. Sort visible meme si plusieurs origines.
2. Cout applique correctement selon source.

## 4.5 ActionEngine (execution)

Changements:
1. Ajouter un resolver de cout de sort base sur `SpellGrantEntry.usage`.
2. Support natif:
3. `slot`
4. `resource`
5. `item_charge`
6. `free`
7. Operations generiques reutilisees (`SpendResource`, `ConsumeSlot`), avec branche de selection de source.

Impact:
1. Pas de branche par classe.
2. Support naturel des objets a charges et recharges.

## 4.6 UI Creator (MagicTab + SheetTab)

Changements:
1. MagicTab affiche provenance de chaque sort (badge source).
2. Affichage des limites de source (`1/1`, recharge long rest, etc.).
3. SheetTab recapitule les sorts par source.

Impact:
1. L utilisateur comprend pourquoi un sort est disponible.
2. Plus de confusion EK vs Clerc.

## 4.7 UI GameBoard (CharacterSheetWindow)

Changements:
1. Afficher les sorts par section source:
2. Classes / Sous-classes / Features / Items / Autres.
3. Afficher l etat d usage pour les sources non-slot.

Impact:
1. Traçabilite complete en combat.
2. Debug gameplay simplifie.

---

## 5) Strategie de migration

Etape 1:
1. Introduire `spellGrants` sans supprimer le legacy.
2. UI lit `spellGrants` puis fallback legacy.

Etape 2:
1. Runtime consomme `spellGrants` en priorite.
2. Compat maintenue pour anciennes fiches.

Etape 3:
1. Outil de migration optionnel (re-save d anciennes fiches).
2. Marquer legacy comme deprecie dans docs.

---

## 6) Plan d implementation (phases)

### Phase A - Types et schema
1. Ajouter types TS (`SpellGrantEntry`, enums usage/source).
2. Etendre `spellcastingState`.
3. Mettre a jour docs schema (`expotSetupScreen.md`, notice creator).

### Phase B - Projection creator
1. Etendre `buildSpellcastingState()` pour produire `spellGrants`.
2. Mapper classes/sous-classes + choices manuels.
3. Ajouter mappage features/items (si data presente).

### Phase C - UI creator
1. MagicTab: badges provenance + limites usage.
2. SheetTab: recap par source.

### Phase D - Runtime GameBoard + engine
1. `collectSpellActionIds()` base `spellGrants`.
2. Consommation cout selon `usage`.
3. Gestion `item_charge` + recharge.

### Phase E - UI combat
1. CharacterSheetWindow: regroupement par source.
2. Affichage `known/prepared/granted` + contraintes source.

### Phase F - QA + migration
1. Cas Clerc (granted/prepared via progression).
2. Cas EK (known via sous-classe).
3. Cas item a charge unique + recharge long rest.
4. Cas multiclasses (sources multiples meme `spellId`).

---

## 7) Criteres d acceptation

1. Tous les sorts affiches en UI combat ont une provenance lisible.
2. EK affiche ses sorts connus dans la fiche combat.
3. Clerc conserve ses sorts accordes/prepares correctement.
4. Un sort d item a charge unique est consommable 1 fois puis indisponible jusqu a recharge.
5. Aucun `if classId` ajoute pour supporter ces cas.
6. Anciennes sauvegardes restent jouables (fallback).

---

## 8) Risques et mitigations

Risque 1:
1. Duplication entre legacy et nouveau modele.
Mitigation:
1. lecture prioritaire `spellGrants`, fallback strict.

Risque 2:
1. Incoherence entre UI creator et runtime.
Mitigation:
1. source unique `buildSpellcastingState()`.

Risque 3:
1. Complexite des cas de cout.
Mitigation:
1. normaliser `usage.type` + operations generiques.

---

## 9) Fichiers a impacter (liste initiale)

1. `src/types.ts`
2. `src/PlayerCharacterCreator/CombatSetupScreen.tsx`
3. `src/PlayerCharacterCreator/tabs/MagicTab.tsx`
4. `src/PlayerCharacterCreator/tabs/SheetTab.tsx`
5. `src/GameBoard.tsx`
6. `src/ui/CharacterSheetWindow.tsx`
7. `src/game/*` (resolver cout sort)
8. `docs/characterCreator/expotSetupScreen.md`
9. `docs/notice/player-character-creator-design-notice.md`
10. `docs/notice/spell-design-notice.md`
11. `docs/notice/content-author-checklist.md`

---

## 10) Suivi implementation (tracker)

```json
{
  "feature": "spell-source-provenance",
  "version": 1,
  "phases": [
    { "id": "types-schema", "status": "done" },
    { "id": "creator-projection", "status": "done" },
    { "id": "creator-ui", "status": "done" },
    { "id": "runtime-cost-resolution", "status": "done" },
    { "id": "combat-ui", "status": "todo" },
    { "id": "migration-compat", "status": "todo" },
    { "id": "qa-e2e", "status": "todo" }
  ]
}
```
