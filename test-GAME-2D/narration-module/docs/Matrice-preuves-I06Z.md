# Matrice de preuves I-06Z — OpenAI live `player_intent_interpreter`

Date : 2026-07-08
Statut : `TERMINE_DANS_PERIMETRE`

## Objectif

Brancher OpenAI live côté serveur pour le rôle `player_intent_interpreter`, sans donner d'autorité métier à l'IA.

Le lot fait suite à la revue produit I-06X/I-06Y : l'interprétation structurée locale est stable et peut maintenant être testée via la route OpenAI opt-in.

## Périmètre livré

- Extension de `POST /api/narration/enhance-openai` au rôle `player_intent_interpreter`.
- Contrat accepté : `ai-intent-interpretation/1`.
- Schéma JSON strict dédié au payload `AiIntentInterpretationPayloadV1`.
- Instructions serveur spécifiques au rôle d'intention.
- Validation locale supplémentaire :
  - une `possibility_query` reste `hypothetical` ;
  - une `meta_question` reste `none` ;
  - `speech` et `action` doivent rester `committed` ;
  - une clarification requiert une question ;
  - les flags `secret_reveal` et `social_success_granted` sont rejetés.
- Sélection optionnelle du modèle par `NARRATION_OPENAI_INTENT_MODEL`, avec fallback vers `NARRATION_OPENAI_MODEL`, puis `gpt-4.1-mini`.
- Mode OpenAI de `NarrativeAppSurface` appliqué à l'interprétation d'intention et à l'enrichissement final.
- Fallback conservateur conservé via la pipeline IA existante si la route est désactivée, sans clé ou invalide.

## Autorité

OpenAI peut proposer une intention structurée.

OpenAI ne peut pas :

- committer ;
- faire avancer le temps ;
- modifier l'inventaire ;
- déclencher le tactique ;
- créer du lore durable ;
- accorder un succès social ;
- écrire un texte visible directement au joueur.

## Preuves exécutables

| Preuve | Résultat |
|---|---|
| `npm run narration-module:test:narrative-openai-route` | OK |
| `npm run narration-module:test:narrative-app-surface` | OK |
| `npm run narration-module:test:ai-intent-interpretation` | OK |
| `npm run narration-module:test:narrative-turn-controller` | OK |
| `npm run narration-module:build` | OK |
| `npm run build` | OK |

## Correctif live manuel

Un premier smoke manuel OpenAI a montre que `j'aimerais parler a un garde` pouvait retomber sur une action generique si une sortie IA etait invalide ou si l'intention etait mal classee.

Durcissement ajoute :

- le fallback local classe cette formulation comme `speech` engagee ;
- la route OpenAI rejette une sortie `player_intent_interpreter` qui classerait cette demande sociale comme `action` ;
- le test `narration-module:test:ai-intent-interpretation` couvre le chemin OpenAI inutilisable -> fallback local -> `speech`.

Preuve complementaire executee : `npm run map-module:test:regression` OK.

## Limites

- Aucun smoke live réel n'est exécuté automatiquement.
- L'activation live reste conditionnée à `NARRATION_OPENAI_LIVE=1` et `OPENAI_API_KEY`.
- I-06Z ne livre pas `mj_planner`.
- I-06Z ne certifie pas encore la qualité de sortie OpenAI sur un corpus manuel large.

## Suite recommandée

1. Revue et commit I-06Z.
2. Test manuel live sur 5 à 8 entrées avec `.env` local :

```env
OPENAI_API_KEY=...
NARRATION_OPENAI_LIVE=1
NARRATION_OPENAI_INTENT_MODEL=gpt-4.1-mini
```

3. Si les traces live sont stables, cadrer ensuite soit :
   - une matrice de certification live courte pour `player_intent_interpreter` ;
   - soit le prochain lot produit narratif, sans ouvrir encore `mj_planner` automatiquement.
