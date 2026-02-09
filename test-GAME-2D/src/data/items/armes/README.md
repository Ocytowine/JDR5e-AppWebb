# Suivi equipement - Armes

Objectif: definir un format unique pour les armes, leurs dependances, et leur impact gameplay.

## Emplacement des fichiers
- Base: test-GAME-2D/src/data/items/
- Armes par categorie: test-GAME-2D/src/data/items/armes/simple, test-GAME-2D/src/data/items/armes/martiale, test-GAME-2D/src/data/items/armes/speciale, test-GAME-2D/src/data/items/armes/monastique
- Exemple de template: test-GAME-2D/src/data/items/armes/weapon-template.json

## Champs recommandes (resume)
- id: identifiant unique (slug)
- name: nom affiche
- type: "arme"
- subtype: type de maitrise requis (simple | martiale | speciale | monastique)
- category: melee | distance | polyvalent
- descriptionCourte / descriptionLongue
- weight (kg) / size / value / rarity
- tags: liste de tags gameplay (ex: arme, melee, slashing)
- properties: proprietes DnD (finesse, light, heavy, twoHanded, reach, versatile, thrown, ammunition, loading, reload, range, special)
- attack: mod + bonus de maitrise si arme maitrisee
- damage: dice + damageType (+ alt pour polyvalente)
- effectOnHit: format court d'impact (compat template items)
- links: ponts vers action / effect visuel
- harmonisable: true/false (uniformise l'acces a la notion d'objet harmonisable)

## Types de degats (reference)
Physique:
- slashing
- piercing
- bludgeoning

Elementaire:
- fire
- cold
- acid
- lightning
- poison
- thunder

Magique / energetique:
- force
- radiant
- necrotic
- psychic

Note: les fichiers d'armes utilisent uniquement les ids EN (strict enum).

## Unites
- distances (reach, range, thrown): metres
- poids (weight): kg

## Maitrises (rappel)
- Si arme non maitrisee: jet sans bonus de maitrise et desavantage selon regles (voir docs projet/Gestion et Creation de donnees/Maitrise et competence.md)
- Les armes et armures portent "subtype" avec le type de maitrise requis

## Notes d'integration
- Conserver les references des degats en une seule source (docs projet/Gestion et Creation de donnees/Degats types.md)
- Les proprietes doivent piloter les actions (ex: thrown => action de jet; ammunition => besoin de munitions)
- Les champs restent extensibles pour ajouter des effets (critique, on-hit, status, etc.)
