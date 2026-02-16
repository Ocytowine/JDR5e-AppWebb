# Plan de correction - Regles deux armes (DnD 2024)

## Objectif
Aligner le runtime, le creator et le pipeline ActionEngine sur les regles DnD 2024 pour le combat a deux armes.

## Lot 1 - Socle centralise des regles (priorite haute)
1. Creer un module unique `weaponPairingRules` reutilisable par creator + ingame.
2. Encoder les regles de base:
- deux armes en main autorisees,
- pas de main dominante,
- seconde attaque en bonus action,
- contrainte Light en base,
- incompatibilites (2H + bouclier, 2H + autre arme, arme + bouclier + arme).
3. Exposer une API standard:
- `validateDualWieldAttempt(...)`
- `getDualWieldConstraintIssues(...)`

## Lot 2 - Normalisation des actions offhand (priorite haute)
1. Normaliser les tags d actions:
- `secondary-attack`
- `offhand-attack`
- `dual-wield`
2. Forcer dans le moteur la validation dual wield pour toute action taggee offhand.
3. Verrouiller le choix d arme principale/offhand de maniere deterministe.

## Lot 3 - Features 2024 (priorite haute)
1. Etendre les policies data-driven de `feature.rules.modifiers`:
- `dualWieldIgnoreLightRequirement` (Dual Wielder)
- `dualWieldBonusAttackWithoutBonusAction` (Nick, 1/turn)
- `dualWieldDrawFlex` (Dual Wielder)
2. Ajouter les compteurs d usage/tour necessaires pour Nick.
3. Integrer ces policies au creator + availability + validation + execution.

## Lot 4 - Verification et regression (priorite haute)
1. Tests unitaires des regles pures dual wield.
2. Tests integration creator:
- equipement valide/invalide,
- feedback de blocage correct.
3. Tests integration ingame:
- cout action/bonus/interactions,
- reaction non regressees,
- respect des exceptions de features.
4. Cas critiques:
- deux armes non-Light sans Dual Wielder: refuse,
- Nick sans Bonus Action: autorise 1/tour,
- arme + bouclier + arme: refuse,
- tenir deux armes sans attaquer: autorise.

## Ordre recommande
1. Socle regles
2. Normalisation actions offhand
3. Features 2024
4. Tests + documentation
