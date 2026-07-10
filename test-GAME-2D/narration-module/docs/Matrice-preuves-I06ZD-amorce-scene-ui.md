# Matrice de preuves I-06ZD - Amorce de scene jouable dans l'UI

Date : 2026-07-10

Statut : `IMPLEMENTE_DANS_PERIMETRE`

## Objectif

Remplacer les messages visibles de prototype dans le fil narratif initial par une ouverture de scene issue de `PlayableSceneStateV1`.

Le lot traite uniquement l'experience visible d'entree dans la scene. Il ne change pas le controleur, la resolution, le temps, le tactique, l'inventaire, les secrets, la memoire longue ou `mj_planner`.

## Perimetre livre

- Le premier paquet visible du fil narration utilise `REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1`.
- Le fil commence dans la salle commune de l'Auberge du Seuil.
- L'ouverture mentionne les faits visibles fournis par la scene :
  - pluie aux volets ;
  - garde blesse ;
  - serveuse nerveuse ;
  - porte du fond ;
  - tension courante.
- Les anciens blocs visibles `La surface narration est prete...` et `Mode prototype...` ne sont plus rendus dans le fil.
- Le statut technique de surface reste hors fil fictionnel.

## Autorite

Cette amorce est un rendu initial.

Elle ne peut pas :

- committer une action ;
- faire avancer le temps ;
- ajouter un PNJ ou un evenement ;
- reveler un secret ;
- creer une intrigue ;
- ouvrir un handoff tactique ou repos.

## Preuves executables

| Preuve | Resultat |
|---|---|
| `npm run narration-module:test:narrative-app-surface` | OK |
| `npm run narration-module:test:narrative-react-ui` | OK |
| `npm run narration-module:build` | OK |
| `npm run build` | OK |

## Smoke UI manuel du 2026-07-10

Resultat : `OK`.

Observation utilisateur :

- l'UI est validee visuellement ;
- les anciens messages de prototype ne sont plus visibles dans le fil initial ;
- l'amorce affiche l'Auberge du Seuil, la pluie, le garde blesse, la serveuse nerveuse, la porte du fond et la tension courante ;
- le probleme de reformulation PJ tronquee n'a pas ete reproduit.

Comportement observe hors perimetre I-06ZD :

- `Je me dirige vers la porte du fond` produit encore une resolution proposee sans commit metier ;
- `je l'ouvre` demande une clarification ;
- ce comportement releve du prochain travail de resolution d'action sur point d'interet, pas de l'amorce UI.

## Limites

- L'ouverture reste basee sur la scene de reference `reference-inn-rain-001`.
- Le statut applicatif reste encore celui d'une surface prototype, mais il n'est plus injecte comme premiere narration du fil.
- Le lot ne traite pas encore la resolution d'action sur point d'interet comme la porte du fond.

## Suite recommandee

1. Cadrer le prochain micro-lot de resolution d'action sur point d'interet visible, en commencant par la porte du fond.
2. Garder la clarification pour les pronoms ambigus quand le referent n'est pas assez fiable.
3. Ne pas ouvrir `mj_planner` tant que cette resolution bornee n'est pas cadree.
