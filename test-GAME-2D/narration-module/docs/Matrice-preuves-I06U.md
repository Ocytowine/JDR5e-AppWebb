# Matrice de preuves I-06U — créations éphémères contrôlées de scène

Date : 2026-07-08
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06U autorise de petits éléments de scène proposés par l'IA uniquement comme texture locale et transitoire. Le lot ferme explicitement toute promotion automatique vers le lore, la mémoire durable, les PNJ durables, les objets utiles, les secrets, les indices d'intrigue et les conséquences systémiques.

## Périmètre livré

- contrat `scene-ephemeral-creation/1`;
- politique par scène dérivée de `PlayableSceneStateV1`;
- types de création autorisés :
  - `ambient_sound`;
  - `sensory_detail`;
  - `background_extra`;
  - `minor_obstacle`;
- expiration obligatoire `TURN_END`;
- persistance obligatoire `EPHEMERAL_ONLY`;
- refus de `createsDurableFact` et `promotesToLore`;
- grounding limité aux références autorisées de la scène;
- rendu déterministe d'un détail accepté avec rappel de son caractère éphémère.

## Rejets couverts

| Cas | Décision attendue |
|---|---|
| objet utile, clé, arme, potion, artefact | `EPHEMERAL_DURABLE_RISK` |
| indice caché, secret, vérité cachée, prompt/API/prototype | `EPHEMERAL_SECRET_RISK` |
| PNJ durable ou personnage important | `EPHEMERAL_DURABLE_RISK` |
| référence de grounding absente de la politique | `EPHEMERAL_GROUNDING_INVALID` |
| promotion lore demandée | `EPHEMERAL_DURABLE_RISK` |

## Preuves exécutables

| Preuve | Résultat attendu |
|---|---|
| `npm run narration-module:test:scene-ephemeral-creation` | Valide acceptations et rejets du contrat I-06U. |
| `npm run narration-module:test:playable-scene` | Confirme que le contrat de scène jouable reste stable et sans création durable ouverte. |
| `npm run narration-module:test:lore-playable-scene` | Confirme que les scènes issues du wiki ne révèlent pas de secret. |
| `npm run narration-module:test:vertical-quality` | Confirme que la scène de référence reste stable dans le scénario vertical. |
| `npm run narration-module:build` | Valide types et exports. |

## Limites assumées

- I-06U ne branche pas encore ces propositions au fournisseur OpenAI réel.
- I-06U ne persiste pas les détails acceptés.
- I-06U ne transforme jamais un détail en lore durable.
- I-06U ne crée pas d'intrigue, d'indice ni de révélation contrôlée de secret.
- La promotion explicite vers un autre domaine reste fermée et devra passer par un lot dédié.

## Décision

I-06U est clos dans son périmètre si les preuves ci-dessus passent. La suite logique est I-06V : préparer les contraintes d'intrigue sans encore créer d'intrigue.
