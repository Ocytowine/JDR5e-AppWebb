# Matrice de preuves I-06Y — UX no-commit / clarification

Date : 2026-07-08
Statut : `TERMINE_DANS_PERIMETRE`

## Objectif

Rendre les cas sans commit plus lisibles dans l'interface narrative, notamment :

- question de possibilite ;
- clarification ;
- parole enregistree apres commit borne ;
- absence d'action executee ;
- absence d'avance du temps.

Le lot ne change pas l'autorite metier : l'IA, React et les libelles UX ne peuvent toujours pas decider un commit, une avance temporelle, un effet social, une mutation d'inventaire, un handoff tactique ou une creation lore durable.

## Changements livres

- Ajout d'encarts UX explicites dans `NarrativeConversationPanel` pour :
  - `possibility-no-commit` ;
  - `clarification-no-commit` ;
  - `bounded-speech-commit` ;
  - `generic-no-commit`.
- Ajout de badges accessibles :
  - `Possibilite` ;
  - `Action non executee` ;
  - `Parole enregistree`.
- Conservation des badges existants : `Sans commit`, `Aucun temps`, `Clarification`, `IA`, `Fallback`.
- Renforcement du test `narrative-react-ui/1` sur les nouveaux signaux via `data-narrative-ux-notice` et `data-narrative-ux-badge`.

## Preuves

| Preuve | Resultat |
|---|---|
| `npm run narration-module:test:narrative-react-ui` | OK |
| Composant React pur | Aucun nouvel appel reseau, stockage navigateur, route IA ou import fournisseur |
| Autorite metier | Aucun changement de controleur, resolution, temps, inventaire, tactique ou lore |

## Limites

- I-06Y ne modifie pas les sorties IA ni l'interpretation d'intention.
- I-06Y ne supprime pas les blocs MJ ambiants apres clarification ; il clarifie leur statut si le flux produit un bloc stable.
- I-06Y ne livre pas le lecteur complet d'historique ni une refonte visuelle.

## Suite recommandee

Si les regressions passent, la suite la plus juste est une revue produit courte sur traces reelles :

1. refaire 5 a 8 tests manuels avec reset de session ;
2. confirmer que les encarts reduisent bien l'ambiguite ;
3. choisir ensuite entre :
   - brancher OpenAI live sur `player_intent_interpreter` ;
   - ou cadrer un premier `mj_planner` sans autorite de commit.
