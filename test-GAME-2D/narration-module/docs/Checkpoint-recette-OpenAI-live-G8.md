# Checkpoint G8 — recette OpenAI live

Date : 2026-08-25  
Statut : `PARTIEL — CLARIFICATION LIVE SÛRE, FLUIDITÉ À ÉVALUER DANS L'UI`

## Résultat acquis

La recette réelle passe désormais par la route serveur du produit, le modèle
OpenAI configuré et le contrat `ai-intent-semantic/8`, sans fournisseur simulé,
fallback local ni reprise lexicale.

Le cas critique validé demande au personnage de parler au garde en s'appuyant
sur son histoire publique. La sortie OpenAI :

- reçoit le contexte incarné complet, dont la projection publique de la scène
  et la biographie du personnage ;
- est acceptée par les validateurs serveur et applicatif ;
- conserve une description naturelle ouverte de l'action ;
- propose exactement `scene.visible-dialogue` dans le champ technique dédié ;
- devient routable sans commit, temps ou résultat décidé par l'interpréteur.

Commande critique :

```text
npm run narration-module:test:open-semantic-live-g8
```

Dernière mesure réussie : modèle `gpt-5.6-luna`, raisonnement `none`, 3 413
jetons d'entrée, 408 jetons de sortie, 3 821 au total et 4 159 ms de latence.

## Corrections issues de la recette

G8 a séparé deux notions auparavant confondues :

- `suggestedAction` reste une description sémantique libre ;
- `suggestedCapabilityId` est nullable et borné par Structured Outputs aux
  seules capacités `AVAILABLE` ou `HANDOFF_ONLY` publiées dans
  `embodiedContext.runtimeCapabilities`.

Le plan G5 route uniquement ce second champ. Il ne déduit jamais une capacité
depuis la phrase du joueur, `meaning`, des synonymes ou des mots-clés. Le prompt
précise aussi que cette correspondance est une proposition sémantique requise
quand un `playerFacingScope` couvre entièrement la composante, et non une
décision d'exécution : le runtime puis le propriétaire conservent l'autorité.

La recette a également détecté un défaut du harnais : sans
`playerPublicContext`, le constructeur incarné retourne volontairement `null`.
Le harnais utilise maintenant la projection publique réelle de la scène et
vérifie, avant tout appel distant, que la capacité de dialogue figure à la fois
dans la requête et dans le schéma envoyé à OpenAI.

## Budget réellement consommé

Le plafond annoncé de six appels distants a été respecté. Cinq appels ont servi
au diagnostic progressif du harnais, du contrat et du prompt ; ils ne constituent
pas une certification du corpus, notamment parce que les quatre premiers ne
transportaient pas le contexte incarné complet. Le sixième appel certifie le
chemin critique ci-dessus. Les métriques exactes n'ont été conservées que pour
ce dernier appel, elles ne doivent donc pas être extrapolées aux six appels.

Un second budget explicite de trois appels a ensuite été entièrement consommé :

1. la commande npm historique n'a pas transmis `--remaining` au script et a
   rejoué le cas critique, qui est resté vert : 3 413 jetons en entrée, 403 en
   sortie, 3 816 au total et 5 632 ms ;
2. l'ellipse seule a demandé une clarification parce que la fixture récente
   demandait déjà exactement la même information sur l'extérieur ;
3. après correction de cette incohérence, le tour composé a été `UNDERSTOOD`,
   mais la relance au garde a été proposée comme `scene.context-response` et la
   condition ultérieure a suspendu cette première composante indépendante.

Aucun quatrième appel n'a été lancé. Le défaut final est sémantique, pas une
panne réseau, un rejet de schéma ou une mutation indue.

## Reste à certifier

G8 n'est pas fermé. Les instructions précisent maintenant, sans détection de
mots, que la continuité d'un `activeInterlocutor` conserve une ellipse dans
l'échange et qu'une condition ne peut pas contaminer une composante antérieure
indépendante. Le corpus local compte désormais 24 cas et couvre explicitement
la combinaison ellipse + condition + séquence.

La première observation manuelle a révélé qu'une approche du clerc visible
était rejetée. Le contexte publiait alors `actor:…`, tandis que le registre de
scène attendait `npc:…` et que la liste V8 des références publiques omettait les
acteurs présents. La correction aligne ces références, autorise explicitement
`presentActors` et conserve l'approche via une capacité d'exécution dédiée. La
preuve locale exacte est verte ; il reste à confirmer son rendu avec la vraie
narration OpenAI dans l'UI, sans nouvel appel automatisé.

Le second essai manuel a confirmé l'approche, puis exposé deux défauts de
continuité : la cible structurée du cadre V8 n'était pas reportée dans les
intentions récentes, et l'ouverture des options techniques réinjectait les
diagnostics de résolution dans le fil narratif. La cible proposée par OpenAI est
maintenant conservée comme focus public structuré pour le tour suivant, y compris
après une approche sans dialogue, et le fil narratif filtre toujours les blocs
techniques. Une gate locale enchaîne désormais l'approche du clerc et une demande
utilisant « lui ».

Le troisième retour manuel a montré que la disparition totale des diagnostics
empêchait de transmettre un échec précis et que le performer PNJ dépendait encore
d'une assignation facultative du planner, malgré une cible sociale déjà validée.
Les options techniques exposent désormais le diagnostic complet du dernier tour
dans une zone séparée et copiable, sans le réinjecter dans le récit. Pour une
capacité exacte `scene.visible-dialogue`, la cible PNJ structurée est directement
assignée au performer. Le prompt de ce dernier doit traiter sémantiquement le
`contentGoal`, même lorsque l'adaptateur ouvert ne peut le réduire sans perte à
un acte de dialogue fermé. Les clarifications historiques filtrées reçoivent en
outre un texte joueur immersif afin de ne plus laisser une entrée brute orpheline.

La contre-recette dédiée a été exécutée avec la commande :

```text
npm run narration-module:test:open-semantic-live-g8:remaining
```

Elle produit un appel OpenAI et ne doit pas être relancée sans nouvel accord.
Le corpus élargi reste postérieur à l'observation UI ciblée.

Le quatrième retour manuel portait sur « je m'approche du clerc, et je le
salue ». Le diagnostic montre une interprétation OpenAI correcte et sûre : deux
composantes `ROUTABLE`, le même PNJ résolu, une relation `THEN` et les capacités
`scene.visible-actor-approach` puis `scene.visible-nonverbal-signal`. Le handoff
venait exclusivement du pont V1, qui refusait auparavant tout plan comportant
plus d'une composante. Ce pont accepte désormais cette micro-séquence précise
comme une interaction locale ordonnée et atomique, sans lecture du texte brut.
Il continue de refuser les séquences conditionnelles, simultanées,
multi-cibles ou multi-domaines. Une régression reproduit la phrase et vérifie
le commit, l'ordre des capacités et l'absence de vocabulaire technique dans la
narration de repli.

Le même diagnostic a révélé un `OPENAI_OUTPUT_INCOMPLETE` du `scene_writer`
arrivé au plafond de 1 500 jetons. Le budget produit et sa validation serveur
passent à 2 500 jetons. Cette marge concerne uniquement le rendu narratif sous
schéma strict et ne lui donne aucune autorité de résolution supplémentaire.

Le cinquième retour manuel, « je m'approche du clerc afin de le saluer », a de
nouveau produit un cadre `UNDERSTOOD` à haute confiance, avec les deux bonnes
composantes, la bonne cible et le bon ordre. OpenAI a cette fois choisi
`scene.visible-dialogue` pour la salutation, mais a laissé `scene_resolution`
dans le champ indicatif `suggestedDomain`; le registre publie cette capacité
avec le propriétaire `social`. Le plan rejetait auparavant cette divergence
redondante malgré l'identifiant exact. Désormais, l'identifiant de capacité
reste la sélection sémantique d'OpenAI et le registre local fournit son domaine
autoritaire. Le domaine suggéré est conservé séparément dans le plan pour audit.
La micro-séquence accepte donc approche puis dialogue vers le même acteur, tout
en maintenant les refus sur capacité inconnue, condition, simultanéité, autre
cible ou composition métier indépendante.

## Contre-recette finale autorisée

Le budget supplémentaire d'un appel a été consommé le 2026-08-25. La route et
les validateurs ont accepté la sortie V8, mais OpenAI a choisi
`NEEDS_CLARIFICATION` pour l'entrée réunissant ellipse, condition et séquence.
La gate exigeait `UNDERSTOOD` et reste donc rouge. Aucun appel propriétaire ni
mutation n'appartient à ce harnais d'interprétation.

Ce résultat ne doit pas être contourné par une seconde interprétation locale ou
par une règle lexicale. Il confirme au contraire le contrat produit : si OpenAI
ne se déclare pas assez sûr, le runtime conserve cette incertitude et demande
une précision. La question désormais pertinente est ergonomique : une vraie
conversation UI rend-elle les ellipses naturelles suffisamment fluides, tout en
gardant la clarification sûre pour les formulations réellement ambiguës ?

La prochaine preuve est donc manuelle et ciblée, décrite dans
[`Recette-manuelle-UI-post-G8.md`](Recette-manuelle-UI-post-G8.md). Aucun nouvel
appel automatisé n'est planifié avant son retour d'observation.
