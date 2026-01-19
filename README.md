# JDR5e-AppWebb
Projet de jeu web - jeu de rôle solo sur navigateur, mécaniques complexes

1 - Finir création de lore d'une région complète
2 - Créer une app intégrant un wiki, une ia narrative, qui répond au question lié au lore
3 - Créer la base de la partie stratégie/combat
 a : créer les levels (mécanique : escalier, gestion de vision, saut...)
 b : créer mouvement speciaux.
 c : gestion des sprite / obstacle (creation, intégration, coloration, evolution)
 d : gestion des obstacles et des interactions.(créer une base d'interaction, tester)
 e : gestion des tuiles sol (propriété et graphisme, test modules spécial.)
 f : patterns rivière, pont, batiment a étage
 g : 
4 - Créer une app de discussion, suivant les règles et détectant les TRIGGERs
5 - Fusionner les apps

mise à jour en cours :
 - Sol des patterns

## Parser de prompt (map)

Le parser de prompt transforme un texte libre en specifications de generation de carte.
Fichiers clefs :
- `test-GAME-2D/src/game/map/promptParser.ts` : parse le texte et produit un `MapSpec`.
- `test-GAME-2D/src/game/map/pipeline.ts` : appelle le parser puis declenche la generation.

Fonctionnement (resume) :
- Detection du theme (donjon/foret/ville) via mots clefs.
- Choix du layout (`layoutId`) selon le theme et des indices (rue, clairiere, salle, etc).
- Indices de taille (small/medium/large) a partir du vocabulaire.
- Detection de portes/entrees (nord/sud/est/ouest, centre/gauche/droite).
- Options specifiques par theme (ex: rue pour la ville).

Obstacles demandes dans le prompt :
- Syntaxe simple : `charette` pour en demander une.
- Orientation explicite : `charette[NW]` (N, NE, E, SE, S, SW/SO, W/O, NW/NO).
- Exemple : `rue et charette[NE]`.

Notes :
- La charette est placee sur la route du module `city_street`.
- Si l'espace est insuffisant, le log de generation indique le placement partiel.
