# Contrat de résolution perceptive bornée

Statut : `ACTIF_MINIMAL`

Version : `perception-resolution/1`

Date : 2026-07-20

## Objectif

Transformer une intention `observe_environment` déjà comprise en résultat perceptif contrôlé, sans mutation durable et sans laisser la prose décider ce qui est découvert.

L'interpréteur IA propose une demande sémantique `perception` :

- `GLANCE` : perception immédiate;
- `FOCUSED` : attention renforcée sur une cible ou un aspect;
- `SEARCH` : recherche active d'une information qui peut exiger une vérification.

La profondeur est déduite du sens complet de la demande. Le runtime ne la reconstruit pas depuis une liste de mots.

La politique est conservatrice : une observation ordinaire reste `GLANCE`. `FOCUSED` exige une intention réellement renforcée, prolongée, précise ou comparative; `SEARCH` exige un objectif d'information qui dépasse les signes immédiatement visibles. L'IA ne doit pas augmenter la profondeur pour produire une narration plus intéressante.

## Indices de scène

Une scène peut déclarer des `perceptionClues` :

- cible canonique;
- visibilité `IMMEDIATE`, `FOCUSED` ou `CHECKED`;
- nature `VISIBLE_SIGN`, `INTERPRETATION` ou `HIDDEN_FACT`;
- texte joueur autorisé;
- références sources.

Le texte n'accorde aucune autorité à l'IA. Il constitue la projection joueur d'un indice déjà autorisé par la scène.

## Résolution

`PerceptionResolutionV1` produit l'un des statuts suivants :

- `AUTOMATIC_RESULT` : les indices exactement accessibles à la profondeur demandée sont révélés;
- `CHECK_REQUIRED` : une proposition de vérification non committable est préparée;
- `NOT_PERCEPTIBLE` : aucun nouvel élément n'est directement accessible;
- `NEEDS_CLARIFICATION` : la demande perceptive structurée manque ou n'est pas exploitable.

La résolution sépare explicitement `revealedClueRefs` et `withheldClueRefs`. Un indice `HIDDEN_FACT` n'est jamais transformé en signe visible par le renderer.

## Autorité et rendu

La résolution perceptive :

- ne committe rien;
- ne fait pas avancer le temps significativement;
- ne révèle aucune pensée privée ou motivation par défaut;
- ne résout pas encore un jet;
- remet uniquement les textes révélés au `RenderPlan` et au critique de cohérence.

Le `scene_writer` peut reformuler les indices révélés, mais ne peut pas utiliser les références retenues. En cas de rejet, le texte autorisé de l'indice sert de fallback narratif.

## Preuves minimales

La scène de référence prouve :

- `GLANCE` révèle les signes immédiats de la serveuse;
- `FOCUSED` révèle un détail nouveau sans motivation cachée;
- `SEARCH` prépare une vérification et retient la cause exacte de sa nervosité;
- une intention non perceptive ne déclenche aucun resolver perceptif.
