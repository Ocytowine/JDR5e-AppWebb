# Matrice de preuves I-06ZA — Qualité de scène jouable

Date : 2026-07-09

Statut : `IMPLEMENTE_DANS_PERIMETRE`

## Objectif

Améliorer la qualité visible de la scène narrative après la certification live de `player_intent_interpreter`, sans ouvrir `mj_planner`.

Le lot ne décide pas la direction narrative. Il améliore uniquement le rendu immédiat de ce qui est déjà autorisé par le contrôleur et la scène de référence.

Principe corrigé après retour manuel : le module ne doit pas accumuler les formulations joueur en dur. L'IA interprète l'intention en catégories contractuelles; le code valide, borne et sécurise. Le fallback local reste conservateur et générique, mais il ne doit pas devenir un second interpréteur exhaustif écrit à la main.

## Périmètre livré

- Réponse météo localisée dans l'Auberge du Seuil.
- Correction du cas UI `aujourd'hui fait il beau ?` : traité comme question de contexte/méta, pas comme possibilité, sans ajouter une liste exhaustive de formulations à l'interpréteur.
- Réponse de possibilité risquée concrète, sans exécuter l'action.
- Narration locale de parole plus ancrée et moins générique.
- Support d'une intention `mixed` sociale comme interaction PNJ bornée.
- Consignes `scene_writer` renforcées :
  - rendu concret ;
  - pas de remplissage générique ;
  - pas de succès, échec, secret ou conséquence durable ;
  - clarification/possibilité explicitement sans action exécutée.

## Hors périmètre

- Pas de `mj_planner`.
- Pas d'intrigue dynamique.
- Pas de secret révélé.
- Pas de résolution sociale mécanique.
- Pas de changement de modèle temporel global.

## Preuves exécutables

| Preuve | Résultat attendu |
|---|---|
| `npm run narration-module:test:scene-playable-quality` | OK |
| `npm run narration-module:test:narrative-turn-controller` | OK |
| `npm run narration-module:test:narrative-openai-route` | OK |
| `npm run narration-module:test:ai-intent-interpretation` | OK |
| `npm run narration-module:build` | OK |

## Dette volontaire

Le contrôleur conserve encore `noGameTime=true` sur le prototype vertical historique, même pour certaines paroles engagées. La certification live d'intention a clarifié que l'interprétation doit exposer `DOMAIN_TO_DECIDE`; le passage effectif du temps reste à traiter dans un lot temporel/résolution séparé.

Ce lot ne modifie donc pas l'horloge. Il améliore seulement le rendu visible.
