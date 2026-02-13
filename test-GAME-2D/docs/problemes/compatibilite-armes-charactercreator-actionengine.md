# Rapport de compatibilite - Armes

## Perimetre

Ce document couvre la compatibilite des JSON d'armes sur 2 axes:

1. `PlayerCharacterCreator` (chargement, affichage, equipement, valeur/vente).
2. `ActionEngine` (selection d'arme, override d'action, degats, contraintes, bonus passifs).

Il synthetise:

1. Les elements obsoletes.
2. Les elements inutiles (ou non exploites) a ce stade.
3. Les problemes rencontres.
4. Les solutions detaillees par point.
5. Un plan de correctif par aspect.

---

## Resume executif

Etat global: **compatible runtime**, avec des **ecarts de contrat** (types/schema/docs) et quelques champs peu utiles.

Points majeurs:

1. Le reliquat `links` a ete supprime des JSON/modeles/notices armes.
2. Les `damageType` armes sont normalises en minuscules en data.
3. Le runtime consomme correctement `properties`, `attack`, `damage`, `effectOnHit`, `extraDamage`, `grants`, `harmonisable`.
4. Le type TS `WeaponTypeDefinition` est en retard par rapport au runtime (champs manquants/obsoletes).

---

## Constat detaille par champ

### Champs critiques (a conserver et verifier strictement)

1. `id`, `name`, `type`, `subtype`, `category`.
2. `properties` (notamment `finesse`, `range`, `thrown`, `twoHanded`, `ammunition`, `loading`, `versatile`).
3. `attack` (`mod`, `bonus`).
4. `damage` (`dice`, `damageType`).
5. `effectOnHit` (base d'override de degats pour l'action d'attaque).

Pourquoi:

1. Le generateur materiel les attend en partie.
2. Le moteur de combat derive le comportement de tir/melee/portee/munitions/2 mains depuis ces champs.

### Champs importants mais optionnels

1. `grants`: applique des bonus passifs via le resolver d'equipement.
2. `harmonisable`: gate l'activation des `grants`.
3. `extraDamage`: ajoute des degats par branche (`onHit`, `onCrit`, etc.).
4. `weaponMastery`: active les tags runtime `wm-active:*`.
5. `value`: requis pour vente/eco UI creator.

### Champs obsoletes ou non utilises actuellement

1. `links`:
   - Obsolete cote data/docs.
   - N'est pas requis pour le fonctionnement actuel de selection/override d'arme.
2. `damage.alt`:
   - Peu utile dans l'etat actuel: le mode polyvalent effectif passe surtout par `properties.versatile`.
3. `reload`, `special`:
   - Support limite/non deterministe selon les cas.
4. `rarity`, `descriptionLongue`, `size`, `allowStack`, `focalisateur`:
   - Faible impact runtime sur les deux axes audites.

---

## Problemes rencontres

## 1) Contrat TS arme desynchronise du runtime

Symptomes:

1. `WeaponTypeDefinition` contient encore `links`.
2. `WeaponTypeDefinition` ne declare pas certains champs utilises runtime (`grants`, `properties.ammoType`, `properties.ammoPerShot`, `label`).

Impact:

1. Dette de schema.
2. Risque de regressions silencieuses ou contournements `any`.

Solution:

1. Aligner `src/game/weaponTypes.ts` sur le contrat reel runtime/data.
2. Supprimer `WeaponLinks` du type.
3. Ajouter les champs manquants utilises.

---

## 2) Coexistence de champs peu exploites

Symptomes:

1. `damage.alt` present en data mais mecanique polyvalente pilotee par `properties.versatile`.
2. `reload` et `special` restent faiblement interpretes.

Impact:

1. Risque de confusion en authoring JSON.
2. Risque de double source de verite.

Solution:

1. Declarer une source unique par mecanique (ex: polyvalent => `properties.versatile`).
2. Marquer explicitement les champs "informatifs/non pilotes" dans la notice.

---

## 3) Validation data insuffisamment stricte pour les armes

Symptomes:

1. Le generateur valide surtout `id/type/name/subtype/category`.
2. Peu de validation structurelle sur `properties/attack/damage/effectOnHit`.

Impact:

1. Un JSON partiellement invalide peut passer la generation et casser plus tard.

Solution:

1. Etendre `scripts/gen-materiel-catalog.js` avec regles minimales armes:
   - `properties` objet.
   - `attack.mod` present.
   - `damage.dice` + `damage.damageType` presents.
   - `effectOnHit` coherent (ou fallback explicite).
   - enum simple sur `category/subtype`.

---

## 4) Ambiguite sur les champs purement UI

Symptomes:

1. Le CharacterCreator affiche surtout `name`, `subtype`, `weight`, `value`.
2. Certains champs d'arme existent mais n'ont aucun retour UI direct.

Impact:

1. Les auteurs peuvent croire qu'un champ "ne marche pas" alors qu'il n'est pas visibilise.

Solution:

1. Documenter clairement "champ runtime" vs "champ UI".
2. Ajouter un panneau debug d'arme optionnel (lecture brute de l'objet arme selectionnee).

---

## Plan de correctif - Aspect CharacterCreator

### Phase CC-1 (court terme)

1. Figer le contrat UI requis:
   - `id`, `name`, `subtype`, `weight`, `value`.
2. Verifier que toutes les armes ont ces champs.
3. Documenter dans une notice creator dediee.

Livrables:

1. Checklist JSON "CC minimum".
2. Notice mise a jour.

### Phase CC-2 (fiabilisation)

1. Afficher un resume plus explicite de l'arme equipee:
   - categorie, degats, type degats, portee.
2. Ajouter feedback si `value` absente (vente impossible).

Livrables:

1. Petit bloc d'inspection arme dans l'UI.

### Phase CC-3 (QA)

1. Scenarios de test:
   - equip/desequip.
   - arme melee vs distance.
   - vente avec/without valeur.

Livrables:

1. Matrice de test manuelle.

---

## Plan de correctif - Aspect ActionEngine

### Phase AE-1 (contrat type/schema)

1. Mettre a jour `WeaponTypeDefinition`:
   - retirer `links`.
   - ajouter `grants`.
   - ajouter `properties.ammoType` et `properties.ammoPerShot`.
   - ajouter `label?`.

Livrables:

1. Types TS alignes.
2. Zero avertissement de schema lie aux armes.

### Phase AE-2 (validation data)

1. Durcir la validation armes du generateur.
2. Bloquer la generation en cas de champs critiques manquants.

Livrables:

1. `gen-materiel-catalog` avec validations armes et messages explicites.

### Phase AE-3 (rationalisation schema)

1. Clarifier `damage.alt` vs `properties.versatile`.
2. Marquer `reload/special` comme non finalises tant que non support complet.

Livrables:

1. Notice armes revue.
2. Eventuelle migration JSON pour supprimer ambiguites.

### Phase AE-4 (QA combat)

1. Tests manuels:
   - finesse FOR/DEX.
   - twoHanded + bouclier.
   - ammunition + ammoType/ammoPerShot.
   - loading par type d'action.
   - extraDamage onHit/onCrit/onMiss/onResolve.
   - grants + harmonisable.

Livrables:

1. Rapport QA combat armes.

---

## Elements inutiles a court terme (recommandation)

A conserver mais considerer comme "non prioritaires":

1. `descriptionLongue`.
2. `size`.
3. `allowStack`.
4. `focalisateur`.
5. `rarity`.

Regle:

1. Pas de suppression forcee immediate.
2. Les garder informatifs tant qu'ils ne nuisent pas.

---

## Decision recommandee

1. Prioriser d'abord l'alignement de contrat (`weaponTypes.ts` + validation generateur).
2. Ensuite seulement rationaliser les champs secondaires (`damage.alt`, `special`, `reload`).
3. Maintenir la logique "data-driven" sans branchement de code specifique par classe/arme.

