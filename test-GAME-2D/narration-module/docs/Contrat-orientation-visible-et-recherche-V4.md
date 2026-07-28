# Contrat d'orientation visible et de recherche V4

Date : 2026-07-28

Statut : `IMPLEMENTE_GATE_LIVE_VALIDEE`

## Problème

Le parcours joueur des Archives produit un test de Perception pour « je cherche un archiviste, pour continuer mes recherches » alors qu'un archiviste est déjà présent, visible et résolu par le registre de scène. Le contrat V3 transporte la profondeur `SEARCH`, mais ne distingue pas la méthode perceptive de l'objectif ultérieur du joueur.

Le correctif ne doit pas relire les mots « chercher », « trouver » ou « voir » dans le runtime. Il doit recevoir une proposition structurée, puis vérifier cette proposition contre la visibilité publique de la scène.

## Évolution versionnée

`ai-intent-semantic/4` conserve la composition V3 et ajoute :

- `composition.orientation`, facultatif, avec `kind=LOCATE_VISIBLE_TARGET` lorsque le joueur cherche à repérer ou sélectionner un référent publiquement visible ;
- `perception.informationKind`, obligatoire pour une perception V4 :
  - `PRESENCE` : établir qu'une présence publique est là ;
  - `VISIBLE_TRAIT` : examiner un signe déjà perceptible ;
  - `UNCERTAIN_CLUE` : rechercher une information qui n'est pas déjà un fait visible.

V1 à V3 restent acceptés sans migration destructive.

## Décision locale

Après résolution du référent par `scene-referent-registry/1` :

- une orientation `LOCATE_VISIBLE_TARGET` vers un référent visible devient une observation immédiate de présence ;
- `PRESENCE` sur un référent visible ne peut pas produire de test ;
- `VISIBLE_TRAIT` reste une observation immédiate ou focalisée ;
- seul `UNCERTAIN_CLUE` associé à une recherche active peut proposer un test ;
- une cible absente ou ambiguë conserve les règles de clarification existantes.

Cette stabilisation est structurelle : elle dépend de `orientation`, `informationKind` et du registre, jamais du texte joueur.

## Parcours de rendu court

Une orientation visible déjà résolue ne passe pas par `scene_writer` :

- `LOCATE_VISIBLE_TARGET` est présent dans les composantes canoniques ;
- l'information demandée est `PRESENCE` ;
- la profondeur stabilisée est `GLANCE` ;
- l'arbitrage est `AUTOMATIC_SUCCESS` ;
- la perception contient un `AUTOMATIC_RESULT` sans proposition de test.

Dans ce cas, le renderer conserve la phrase déterministe issue de la désignation narrative de la cible. Il ne demande aucune invention de prose : le résultat consiste uniquement à montrer au joueur où se trouve une présence déjà visible.

Cette exception ne concerne pas :

- l'observation générale d'une scène ou de sa population, qui peut bénéficier d'une composition narrative ;
- l'examen d'un trait visible ;
- la recherche d'un indice incertain ;
- une cible absente, ambiguë ou non perceptible.

Le `coherence_critic` n'est pas appelé puisqu'aucune prose candidate n'est produite. Il ne s'agit ni d'un fallback ni d'un rejet.

## Reproduction normative

Scène : Archives de Lysenthe, avec une désignation d'archiviste visible dans `ambientPopulation`.

Entrée :

```text
je cherche un archiviste, pour continuer mes recherches
```

Attendu :

- cible : archiviste visible ;
- information : `PRESENCE` ;
- aucune proposition de jet ;
- aucune fiche mécanique requise ;
- résultat d'observation automatique indiquant l'archiviste déjà perceptible.

Contre-exemple :

```text
je cherche à voir si l'archiviste dissimule quelque chose sous sa tenue
```

Attendu :

- information : `UNCERTAIN_CLUE` ;
- un test reste possible si la profondeur est `SEARCH` ;
- aucun indice n'est révélé avant résolution propriétaire.

## Preuves

- schéma OpenAI strict et validations locales V4 ;
- test déterministe présence visible contre indice incertain ;
- non-régression V2 et V3 ;
- recette navigateur OpenAI exacte aux Archives ;
- build global.

Résultat live du 2026-07-28 :

- la phrase normative utilise le contrat actif `player_intent_interpreter:ai-intent-semantic/5`, compatible avec l'orientation V4 ;
- la cible archiviste est résolue depuis le registre public ;
- la trace indique `profondeur=GLANCE, information=PRESENCE` ;
- l'arbitrage est `AUTOMATIC_SUCCESS` ;
- aucun bloc « Jet requis » ni demande de fiche n'est produit.
- aucun appel `scene_writer` ou `coherence_critic` n'est produit ;
- le parcours fournisseur contient uniquement `player_intent_interpreter:ai-intent-semantic/5` ;
- la mesure observée avant affichage est descendue à environ 3,14 s sur la passe instrumentée, contre plus de 30 s lorsque les deux enrichissements inutiles étaient encore appelés.

Commandes validées :

- `npm run narration-module:test:semantic-intent-v4` ;
- `npm run narration-module:test:narrative-openai-route` ;
- `npm run narration-module:test:semantic-intent-v2` ;
- `npm run narration-module:test:semantic-intent-v3` ;
- `npm run narration-module:test:perception` ;
- `npm run narration-module:test:action-adjudication` ;
- `npm run narration-module:test:narrative-resolution` ;
- `npm run narration-module:test:archives-perception:openai-live` ;
- `npm run build`.

La gate valide la décision fonctionnelle. La richesse stylistique des observations générales reste traitée par le contrat de couverture du `scene_writer`; l'orientation visible suit le parcours court décrit ci-dessus.
