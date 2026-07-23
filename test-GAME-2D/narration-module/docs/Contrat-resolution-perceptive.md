# Contrat de résolution perceptive bornée

Statut : `ACTIF_MINIMAL`

Version : `perception-resolution/1`

Date : 2026-07-23

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

Depuis le 2026-07-23, `CHECK_REQUIRED` porte un `skill-check-proposal/1` complet mais non résolu. Une recherche perceptive propose Sagesse/Perception, ses enjeux et ses sources. Le DD reste `REQUIRES_ADJUDICATION` avec valeur nulle tant qu'une règle versionnée ou un arbitrage accepté ne l'a pas fixé. La proposition ne lance aucun dé et ne possède aucune autorité de commit.

Un adaptateur pur peut joindre la projection mécanique minimale du personnage : modificateur de Sagesse, maîtrise ou expertise de Perception, modificateur total, perception passive et background. Une recherche active reste inéligible au passif dans ce premier contrat; le score n'est donc pas utilisé implicitement.

Le tour narratif charge maintenant ce contexte depuis les références autoritaires de l'événement `campaign.bootstrapped`, puis relit les agrégats `character.tactical-projection` et `character.narrative-projection`. Aucun identifiant de personnage ou de projection n'est codé en dur. Une scène prototype sans bootstrap conserve une proposition non enrichie; des références de bootstrap incomplètes ou des projections incohérentes sont refusées.

La bande de difficulté doit encore être choisie par un arbitrage contextuel. Une fois choisie, `core.check.difficulty-class@1` du ruleset V2 convertit déterministement la bande en DD et la proposition cite cette règle. L'absence de bande conserve un DD nul.

La notification système du tour expose une trace décisionnelle compacte lorsqu'un arbitrage mécanique intervient :

- disposition, portée et justification;
- faits et règles utilisés;
- caractéristique, compétence et objectif du test;
- modificateur total et détail mécanique si la projection est disponible;
- état de la difficulté et du passif;
- enjeux de succès et d'échec;
- confirmation explicite qu'aucun jet ni effet n'est encore committé.

Une action automatique ou impossible conserve seulement les deux premières lignes afin de ne pas surcharger le fil.

La recherche perceptive utilise désormais `difficulty-assessment/1`. Le domaine fixe une base `MEDIUM`, puis applique uniquement des facteurs structurés :

- des signes déjà perceptibles facilitent la recherche d'une bande;
- la présence d'une information protégée augmente la difficulté d'une bande;
- la bande finale est bornée entre `VERY_EASY` et `NEARLY_IMPOSSIBLE`.

Un facteur `PLAYER_VISIBLE` expose sa justification et sa source. Un facteur `SYSTEM_ONLY` ne projette ni identifiant, ni raison, ni source vers la proposition ou la bulle; seul son nombre est indiqué pour rendre le calcul constatable sans révéler le secret. La proposition passe alors à `BAND_SELECTED`; son DD reste nul jusqu'à exécution de la règle du ruleset V2.

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
- la vérification `SEARCH` indique Sagesse/Perception, des enjeux explicites et une difficulté encore non arbitrée;
- une intention non perceptive ne déclenche aucun resolver perceptif.
