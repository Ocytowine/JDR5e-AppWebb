# Checkpoint J10-H2 — focus local persistant

Date : 2026-08-26

Statut : `FERMÉ`

## Résultat

Le contrat public `local-interaction-focus/1` représente désormais une
interaction locale confirmée avec un acteur visible. Il distingue une simple
attention locale d'un dialogue, conserve la scène, la cible, le résumé public
et les opérations d'ouverture et de dernière confirmation.

Le focus est ajouté au résultat persistant du tour. Après rechargement, le
contrôleur le restaure depuis les opérations terminées et le projette dans le
contexte incarné envoyé à OpenAI sous `activeInteraction` et
`activeInterlocutor`. Les anciennes opérations sans ce champ restent lisibles :
le contrôleur reconstruit prudemment le focus depuis leurs informations
structurées lorsque la cible et la confirmation suffisent.

## Autorité

Le focus est une mémoire publique de continuité. Il ne décide jamais :

- du sens d'une nouvelle saisie ;
- de la faisabilité ou du succès ;
- d'un commit, du temps ou d'un transfert d'objet ;
- d'une relation, d'une mission ou d'une vérité d'intrigue ;
- d'un secret ou d'une connaissance privée.

OpenAI reste l'unique interpréteur. Les propriétaires reçoivent ensuite la
cible proposée et conservent toutes leurs validations.

## Cycle de vie certifié

- une approche confirmée ouvre `LOCAL_ATTENTION` ;
- une parole confirmée ouvre ou promeut en `DIALOGUE` ;
- une clarification ou un échec sans commit conserve le focus précédent ;
- un autre acteur ferme l'ancien focus avec `TARGET_CHANGED` ;
- une disparition ferme avec `TARGET_LEFT` ;
- une autre scène ferme avec `SCENE_CHANGED` ;
- un départ confirmé ferme avec `PLAYER_LEFT` ;
- un processus de repos incompatible ferme avec `PROCESS_INTERRUPTION` ;
- un handoff tactique ferme avec `TACTICAL_HANDOFF` ;
- une nouvelle version de la même scène conserve le focus si l'acteur reste
  visible.

## Preuves

```powershell
npm run narration-module:test:j10h2-focus
npm run build
```

La gate inclut la validation du contrat, les transitions de cycle de vie, la
reprise réelle d'une conversation V8, la baseline H0 et le garde-fou de dette
lexicale. Aucun appel OpenAI réel n'est effectué.

## Frontière

H2 ne corrige pas encore la projection historique `unclear_intent`,
l'expression personnage remplacée par le résumé IA ni la cible d'effet
générique. Ces pertes de fidélité appartiennent à J10-H3.
