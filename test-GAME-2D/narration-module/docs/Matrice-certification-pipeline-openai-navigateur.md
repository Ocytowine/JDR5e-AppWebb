# Matrice de certification du pipeline OpenAI navigateur

Statut : `CERTIFIE_LIVE_2026-08-04`

## Objet

Cette gate vérifie la compréhension et le rendu OpenAI depuis le vrai pilote
React des Archives. Elle ne transfère aucune autorité métier à l'IA : les
commits, le temps, les transitions et les effets restent produits ou refusés
par les domaines déterministes.

Commande :

```text
npm run narration-module:test:narrative-pipeline-roles:openai-live
```

La commande exige `NARRATION_OPENAI_LIVE=1` et une clé serveur disponible dans
l'environnement local. La clé n'est jamais envoyée au navigateur ni imprimée
par la recette.

## Matrice certifiée

| Tour | Formulation de la gate | Rôles utiles, dans l'ordre | Résultat protégé |
|---|---|---|---|
| clarification | pronom sans référent | `player_intent_interpreter` | clarification, aucun commit ni temps |
| action | approche d'un archiviste visible | `player_intent_interpreter → mj_planner → scene_writer?` | positionnement local borné, aucun effet caché |
| dialogue | demande explicite à l'archiviste | `player_intent_interpreter → mj_planner → npc_performer` | une seule réplique PNJ, aucune permission implicite |
| observation | personnes visibles autour du personnage | `player_intent_interpreter → mj_planner → scene_writer?` | mention d'une présence visible ou fallback déterministe |
| transition | Archives → Quartier des Archives | `player_intent_interpreter → mj_planner → scene_writer?` | départ, franchissement et arrivée après commit |

Le `?` signifie que le writer est conditionnel : il peut être omis si le rendu
déterministe couvre déjà entièrement le tour. Lorsqu'il est appelé, il doit
être unique et venir en troisième position.

Pour chaque tour, la gate impose :

- au plus trois appels facturables ;
- aucun rôle dupliqué ;
- l'ordre canonique des rôles ;
- une réponse HTTP 200 pour chaque appel réellement émis ;
- aucun incident UI ;
- les conséquences observables propres au tour.

## Écarts détectés et corrigés

La certification live a révélé trois écarts :

1. les anciennes recettes Archives n'ouvraient plus explicitement le pilote
   depuis le nouvel écran d'accueil ;
2. une question sur les personnes visibles pouvait accepter un texte du writer
   ne décrivant que le bâtiment ; le garde-fou exige désormais l'ancrage et la
   mention d'au moins une présence visible, sinon il conserve le rendu local ;
3. la route serveur du `scene_writer` était étiquetée comme locale et échappait
   au budget, ce qui autorisait un quatrième appel au critic sur une transition.
   Elle est maintenant comptée comme facturable via
   `providerId=server-openai-route`; le quatrième appel est refusé localement.

La passe finale a observé treize appels répartis sur cinq tours, jamais plus de
trois sur un tour, tous avec un statut HTTP 200.
