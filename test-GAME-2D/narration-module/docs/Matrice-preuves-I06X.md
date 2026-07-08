# Matrice de preuves I-06X — interprétation IA structurée

Date : 2026-07-08
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06X introduit une interprétation structurée de l'intention joueur via le rôle `player_intent_interpreter`, sans donner d'autorité métier à l'IA.

Le lot traite le défaut confirmé où une variation de formulation, par exemple `je lui demande`, pouvait déclencher une clarification inutile.

## Périmètre livré

- contrat d'exécution `ai-intent-interpretation/1`;
- rôle IA `player_intent_interpreter` ajouté au pipeline IA;
- payload strict `AiIntentInterpretationPayloadV1`;
- validation locale de l'enveloppe et des intentions structurées;
- fournisseur local déterministe `LocalPlayerIntentInterpreterProviderV1` servant de faux fournisseur certifié;
- intégration optionnelle dans `NarrativeTurnControllerV1`;
- fallback conservateur vers `intent-clarification/1` si la sortie IA est invalide ou indisponible;
- test de robustesse linguistique par familles de formulations;
- cas `Je m’approche du garde et je lui demande...` classé en `speech`, sans clarification.

## Autorité

L'IA peut proposer :

- type d'intention;
- cible;
- engagement;
- sujet;
- question de clarification candidate;
- signaux de risque.

Elle ne peut pas :

- committer;
- faire avancer le temps;
- résoudre une action;
- modifier inventaire, tactique, repos ou lore durable;
- révéler un secret;
- accorder un succès social.

La résolution et les commits restent dans `NarrativeTurnControllerV1`, `narrative-resolution/1` et les domaines propriétaires.

## Preuves exécutables

| Preuve | Résultat attendu |
|---|---|
| `npm run narration-module:test:ai-intent-interpretation` | Vérifie familles de formulations, rejet de sortie IA invalide, fallback et intégration contrôleur. |
| `npm run narration-module:test:narrative-turn-controller` | Vérifie que le contrôleur existant reste stable. |
| `npm run narration-module:test:narrative-resolution` | Vérifie handoffs, commit speech et absence de mutation indue. |
| `npm run narration-module:test:ai-narrative-enhancement` | Vérifie que l'enrichissement IA reste post-résolution et sans autorité métier. |
| `npm run narration-module:test:vertical-quality` | Vérifie que le scénario vertical I-06Q/I-06R reste stable. |
| `npm run narration-module:test:narrative-app-surface` | Vérifie la surface narration et l'absence d'appel OpenAI navigateur. |
| `npm run narration-module:test:narrative-react-ui` | Vérifie les badges et l'affichage accessible. |
| `npm run narration-module:build` | Vérifie types et imports TypeScript. |
| `npm run map-module:test:regression` | Vérifie l'absence de régression sur le module carte. |

## Cas corrigé

Entrée :

```text
Je m’approche du garde et je lui demande s’il a vu quelque chose d’étrange.
```

Résultat attendu :

```text
intentType: speech
commitment: committed
requiresClarification: false
resultKind: COMMIT_APPLIED
```

## Familles couvertes

- parole adressée à un PNJ;
- question de possibilité sociale;
- action risquée hypothétique;
- action explicite;
- question méta;
- formulation elliptique réellement ambiguë.

## Limites assumées

- Le fournisseur local est déterministe; il sert de faux fournisseur certifié et de garde-fou de test.
- I-06X ne branche pas encore OpenAI live pour `player_intent_interpreter`.
- I-06X ne livre pas `mj_planner`, PNJ autonomes, résolution sociale mécanique ou MJ complet.
- La généralisation complète de toutes les tournures naturelles devra être enrichie par traces de jeu, mais pas par accumulation non contrôlée de regex dans le contrôleur.

## Décision

I-06X est clos dans son périmètre si les preuves ci-dessus passent. La prochaine étape recommandée est une revue produit courte des traces manuelles sur la surface narration, puis décision entre :

- durcir `player_intent_interpreter` avec route serveur OpenAI dédiée;
- ou ouvrir une première préparation de `mj_planner`, seulement si l'interprétation reste stable.
