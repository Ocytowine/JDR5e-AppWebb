# Plan d'integration - Proprietes d'armes (ActionEngine)

Objectif: integrer le traitement gameplay des proprietes d'armes dans le pipeline existant, sans logique ad-hoc dispersée, et en restant coherent avec la taxonomie.

## Scope

Proprietes ciblees:
1. `finesse`
2. `thrown` (Lancer)
3. `range.normal` / `range.long` (Portee)
4. `heavy` (Lourde)
5. `loading` (Chargement)
6. `versatile` (Polyvalente)
7. `twoHanded` (Deux mains)
8. `reach` (Allonge / portee melee)
9. `light` (deja partiellement utilise via weapon mastery)
10. `ammunition` / `ammoType` / `ammoPerShot` (deja en place, a consolider)

Hors scope initial:
1. Recuperation de munitions post-combat.
2. Refonte UI complete des mains libres.
3. Refonte des reactions hors opportunite.

## Etat actuel (resume)

1. `light`: utilise pour tag `weapon:light` (mastery coup double).
2. `reach` / `range.normal`: utilise pour porter l'action d'attaque.
3. `ammunition` / `ammoType` / `ammoPerShot`: consommation geree.
4. `finesse`, `thrown`, `loading`, `versatile`, `twoHanded`, `heavy`: non traites ou partiellement traites (creator uniquement pour certains).

## Principe d'architecture

1. Centraliser les regles d'armes dans un helper unique.
2. Garder `GameBoard` comme point d'assemblage de l'action equipee.
3. Utiliser `actionEngine` pour la resolution des jets/ops.
4. Eviter de dupliquer la logique entre creator, UI, combat.

## Design propose

### A) Nouveau helper de regles d'arme

Fichier propose:
1. `test-GAME-2D/src/game/engine/rules/weaponRules.ts`

Responsabilites:
1. Resoudre le profil d'attaque derive d'une arme:
   - modificateur utilise (FOR/DEX),
   - bonus d'attaque,
   - formule de degats,
   - portee effective (normal/long),
   - flags de contraintes (`requiresTwoHands`, `loading`, `heavyPenalty`, etc.).
2. Exposer des validateurs:
   - compatibilite main libre / bouclier,
   - portee autorisee,
   - desavantage contextuel.

### B) Integration dans `GameBoard`

Points d'integration:
1. `applyWeaponOverrideForActor`:
   - remplacer la logique inline par `weaponRules`.
2. `resolveAmmoUsageForAction`:
   - garder et connecter avec `loading`.
3. Validation avant execution:
   - bloquer les attaques invalides (`twoHanded`, hors portee longue, etc.).

### C) Integration dans `actionExecute`

Points d'integration:
1. Calcul de l'avantage/desavantage:
   - ajouter penalites `heavy` et `range.long`.
2. Respect `loading`:
   - limiter le nombre de tirs selon cout d'action.

## Mapping regle -> implementation

1. Allonge (`reach`)
   - Portee melee basee sur `reach`.
   - Opportunite: utiliser la meme portee calculee.

2. Chargement (`loading`)
   - 1 projectile max par `actionType` (`action`, `bonus`, `reaction`) et par tour.
   - Comptage via usage deja existant.

3. Deux mains (`twoHanded`)
   - Validation d'equipement avant attaque.
   - Si non conforme: action invalide avec raison explicite.

4. Finesse (`finesse`)
   - Choix automatique du meilleur mod FOR/DEX.
   - Mod unique pour attaque + degats.

5. Lancer (`thrown`)
   - Arme melee utilisable en attaque a distance.
   - Portee issue de `thrown.normal/long`.
   - Modificateur identique au mode melee de l'arme.

6. Legere (`light`)
   - Conserve l'existant (tags weapon mastery).

7. Lourde (`heavy`)
   - Desavantage si:
     - melee lourde + FOR < 13
     - distance lourde + DEX < 13

8. Munitions (`ammunition`)
   - Conserver la consommation existante.
   - Ajouter verification main libre si necessaire.

9. Polyvalente (`versatile`)
   - Si attaque melee a 2 mains validee: utiliser le de de `versatile`.

10. Portee (`range.normal`/`range.long`)
   - <= `normal`: jet normal.
   - > `normal` et <= `long`: desavantage.
   - > `long`: attaque invalide.

## Validation et tests

Tests minimaux (manuels + unitaires cibles):
1. Dague finesse: FOR/DEX, verifier choix du meilleur mod.
2. Javelot lancer: attaque melee puis distance.
3. Arc long: desavantage en portee longue.
4. Arbalete loading: seconde attaque bloquee dans le meme type d'action.
5. Arme lourde: desavantage sous seuil stat.
6. Epee polyvalente: degats 1 main vs 2 mains.
7. Arme deux mains + bouclier: blocage.
8. Opportunite avec allonge: distance et validation.

## Risques

1. Effets de bord sur IA (selection arme et portee).
2. Interaction avec les tags de weapon mastery.
3. Difference entre donnees existantes (`reach` absolu) et regle DnD (allonge +1.5m).

## Decisions a figer avant code

1. Convention `reach`:
   - Option A: valeur absolue de portee melee (etat actuel).
   - Option B: bonus d'allonge (+1.5m).
2. Politique main libre pour munitions.
3. Comportement de `loading` pour reactions.


