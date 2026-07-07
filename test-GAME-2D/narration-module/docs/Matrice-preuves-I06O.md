# Matrice de preuves I-06O — état de scène minimal persistant

Date : 2026-07-07  
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06O ajoute un état de scène minimal et persistant pour `reference-inn-rain-001`. La scène peut désormais évoluer à partir de commits déterministes sans dépendre du texte libre produit par l'IA.

## Périmètre livré

- contrat interne `reference-scene-state/1`;
- agrégat `scene.state` stable `agg-scene-reference-inn-rain-001`;
- état initial déterministe : pluie, garde blessé, serveuse nerveuse, porte du fond;
- mutation atomique de l'état de scène lors d'une parole committée au garde;
- conservation des observations sans commit : elles ne créent pas d'agrégat et ne font pas avancer le temps;
- rendu suivant capable d'utiliser l'état persisté;
- sortie du contrôleur enrichie avec `sceneState`;
- paquet IA `scene_writer` enrichi avec un bloc `scene-state` lorsque l'état est disponible.

## Contrats concernés

| Contrat | Effet I-06O |
|---|---|
| `reference-playable-scene/1` | La scène de référence possède maintenant un état runtime minimal. |
| `reference-scene-state/1` | Nouveau contrat interne de l'agrégat `scene.state`. |
| `narrative-resolution/1` | Le commit parole écrit aussi l'état de scène, sans effet social mécanique supplémentaire. |
| `narrative-ai-resolution/1` | Le paquet `scene_writer` peut recevoir l'état de scène courant. |

## Preuves exécutables

| Preuve | Attendu |
|---|---|
| `npm run narration-module:test:narrative-turn-controller` | Vérifie absence d'état sur observation, création après parole, puis rendu dépendant de l'état. |
| `npm run narration-module:test:ai-narrative-enhancement` | Vérifie que le pack IA contient le bloc `scene-state`. |
| `npm run narration-module:build` | Valide les types de l'état scène et de son exposition contrôleur/IA. |

## Cas couverts

| Cas | Résultat attendu |
|---|---|
| `je regarde autour de moi` | Aucun agrégat `scene.state` n'est créé. |
| `je demande au garde...` | Commit parole + écriture atomique de `scene.state`. |
| Observation du garde après parole | Le rendu indique que le garde reconnaît l'interpellation et recentre la porte du fond. |
| Enrichissement IA après parole | Le `RoleContextPackV1` contient la scène et l'état persistant. |

## Limites assumées

- l'état de scène reste minimal et spécifique à la scène de référence;
- aucune mémoire courte PNJ détaillée n'est encore gérée;
- les observations sans commit ne sont pas historisées comme mutations;
- aucune création dynamique, intrigue ou secret n'est introduit;
- aucun branchement tactique réel n'est introduit.

## Suite logique

Ouvrir I-06P : mémoire courte de scène et continuité PNJ, pour que le garde et les autres acteurs ne répètent pas mécaniquement les mêmes réponses et puissent tenir compte des derniers échanges.
