# Idees a plat sur la creation d'evenements

## But du document

Ce document sert de base de reflexion.
Il ne cherche pas a figer une implementation.
Il rassemble les idees clarifiees sur la creation d'evenements pour pouvoir y revenir plus tard au moment de la conception detaillee.

Le but est de garder une vision claire de:

- ce qu'est un evenement dans le systeme
- comment il nait
- comment il se structure
- comment il alimente la narration
- comment il evolue dans le monde

## Idee centrale

Le moteur d'evenements n'est pas un simple remplisseur de scenes.
Ce n'est pas un outil qui invente arbitrairement de l'animation parce qu'une scene manque de contenu.

L'idee cible est plutot:

- un moteur qui cree des evenements
- un moteur qui produit aussi des reactions a partir d'evenements existants
- un moteur qui fait evoluer ces elements dans le temps
- un moteur qui laisse ces elements vivre jusqu'a interaction, transformation, resolution ou disparition

Le monde n'attend donc pas le joueur pour exister.
Mais il n'invente pas non plus n'importe quoi sans cause.

## Nature d'un evenement

Un evenement est un fait actif du monde.
Il entre en jeu des sa creation.
Il n'est pas latent au sens "inexistant" ou "purement potentiel".

En revanche, il ne devoile pas tout immediatement.

Cela implique:

- l'evenement existe comme verite systeme des sa naissance
- il peut deja avoir des consequences
- il peut deja toucher des lieux, des PNJ, des tensions ou des quetes
- le joueur n'en percoit qu'une partie, ou seulement certains signes

L'evenement n'est donc pas equivalent a sa revelation.

## Difference entre evenement et revelation

Il faut distinguer:

- l'existence reelle de l'evenement dans le monde
- ce qui est visible ou accessible au joueur
- ce que le MJ peut savoir ou utiliser

Un evenement peut etre reel, actif et deja determinant sans etre integralement revele.

Exemple de logique:

- un vol a eu lieu
- des acteurs ont deja reagit
- des fragments existent deja dans le monde
- le joueur, lui, n'a encore acces qu'a une garde nerveuse ou a une rumeur partielle

L'evenement est reel avant sa mise en scene complete.

## Idee du scenario a fragments

Un evenement ne doit pas etre pense comme une ligne unique a suivre.
Il doit plutot etre vu comme un scenario structure autour d'une verite fixe et de plusieurs points d'acces.

Le coeur de l'idee:

- le generateur cree un scenario
- ce scenario a un final deja determine
- ce final est connu du MJ / systeme
- autour de ce final existent plusieurs fragments
- ces fragments permettent d'approcher la verite sans imposer un chemin unique

Le joueur peut:

- suivre plusieurs fragments
- n'en voir qu'un seul
- en ignorer certains
- sauter d'un fragment vers une deduction juste
- atteindre le final sans passer par tous les points intermediaires

Le systeme ne doit donc pas supposer une progression forcee de type:

`A -> B -> C -> Final`

Le bon modele est plus proche d'un ensemble de portes d'entree autour d'une verite centrale.

## Le final

Le final est la verite canonique de l'evenement.
Il est fixe des la creation de l'evenement.

Il n'est pas forcement "la fin" au sens chronologique.
Ici, "final" veut surtout dire:

- ce qui s'est vraiment passe
- ce qui est reellement en jeu
- ce que le MJ doit tenir comme verite de reference

Le final peut inclure:

- le fait central
- le lieu reel
- la date ou le moment cle
- les PNJ importants
- les causes
- les liens entre acteurs
- les enjeux
- la consequence si personne n'intervient

Le point important est que l'IA ne doit pas inventer cette verite a chaque tour.
Elle doit narrer autour d'une verite deja fixee.

## Les fragments

Les fragments sont les morceaux jouables et revelables d'un evenement.

Ils servent a:

- exposer une partie du final
- offrir des points d'acces narratifs
- permettre l'enquete, la deduction, la reaction ou l'orientation

Un fragment n'est pas forcement un simple indice.
Il peut etre:

- une trace
- un temoignage
- une scene en cours
- une reaction de PNJ
- une rumeur
- une contradiction
- un detail environnemental
- une consequence visible
- une opportunite de deduction

Le point cle:

- un fragment n'invente pas une autre verite
- il expose un angle, une partie ou une consequence du final

Il peut etre:

- juste
- incomplet
- partiellement trompeur du point de vue du joueur
- biaise par un PNJ

Mais il doit rester coherent avec la verite reelle de l'evenement.

## Non-linearite des fragments

Les fragments ne doivent pas obliger un ordre unique.

Le joueur peut:

- trouver un fragment mineur puis remonter vers quelque chose de central
- tomber directement sur un acteur cle
- comprendre plus vite que prevu
- manquer des elements intermediaires
- atteindre la bonne conclusion par hasard ou deduction

Cette non-linearite est importante pour deux raisons:

- elle laisse de la liberte au joueur
- elle donne a l'IA de la souplesse sans lui permettre de casser la coherence

L'important n'est pas que tous les fragments soient joues.
L'important est que tous les fragments joues restent compatibles avec le final.

## Role de l'IA dans ce modele

L'IA ne doit pas "inventer le mystere" en direct.
Son role est plutot:

- mettre en scene les fragments accessibles
- choisir le bon angle narratif
- produire une narration coherente avec le contexte
- faire sentir la tension, les reactions, les details
- conserver la continuite entre ce qui est deja etabli et ce qui se revele ensuite

Autrement dit:

- la structure de l'evenement donne la verite
- les fragments donnent la matiere jouable
- l'IA donne la forme narrative

Cela doit eviter:

- les contradictions de revelation
- les scenes qui changent de verite selon les tours
- les indices inventes a la volée sans lien causal

## Naissance d'un evenement

Un evenement peut naitre a tout moment.
Il ne depend pas du fait qu'une scene soit "vide".

C'est un point important:

- le monde peut generer un evenement meme si la narration actuelle est deja riche
- le moteur ne sert pas seulement a combler un manque
- il sert a faire avancer ou reactiver le monde

Un evenement peut naitre:

- suite a une action du joueur
- suite a une action d'un PNJ
- suite a une reaction en chaine
- suite a une contrainte temporelle
- suite a un etat global du monde
- suite a une consequence de quete

La logique generale reste:

- un evenement peut survenir n'importe quand
- mais pas sans declencheur identifiable

## Reactions

En plus des evenements eux-memes, le moteur doit pouvoir produire des reactions.

Une reaction peut etre vue comme:

- une consequence immediate ou differee
- un comportement declenche
- une adaptation locale du monde

Exemples:

- un garde devient mefiant
- une rumeur commence a circuler
- un PNJ fuit
- un acces se ferme
- une preuve est deplacee
- un lieu devient surveille

Les reactions sont importantes car elles donnent de la vie au monde.
Elles relient les causes et les consequences de facon visible ou invisible.

## Evolution dans le temps

Un evenement ne doit pas rester fige si le joueur ne s'en occupe pas.

Il doit pouvoir:

- progresser
- se degrader
- se compliquer
- se diffuser
- se resoudre sans le joueur
- disparaitre

Le meme principe vaut pour les reactions.

Le monde doit donc pouvoir continuer a changer:

- meme hors champ
- meme si le joueur n'a encore rien compris
- meme si un fragment n'a pas encore ete rencontre

Cela renforce l'idee d'un monde vivant et non d'un monde suspendu.

## Traitement narratif

Un evenement continue d'exister tant qu'il n'est pas traite, transforme ou rendu inutile.

Le traitement narratif correspond au moment ou:

- le joueur interagit avec un fragment
- une scene expose une partie du probleme
- une deduction relie des elements
- une action vient modifier la trajectoire de l'evenement

L'evenement n'est donc pas uniquement un objet systeme.
Il devient aussi une matiere de narration.

Le point important:

- ce n'est pas la narration qui cree la verite
- c'est la narration qui met en jeu une partie de ce qui existe deja

## Sortie du systeme

Un evenement n'a pas vocation a rester actif indefiniment.
Il doit pouvoir sortir de la couche active.

Il peut sortir parce que:

- il a ete resolu
- il a ete contourne
- il a ete absorbe dans une autre situation
- il est devenu obsolete
- ses enjeux ont cesse d'etre utiles

Mais meme lorsqu'il sort de la couche active, cela ne veut pas dire qu'il cesse d'exister dans l'historique.
Une partie de lui peut rester memorisee comme consequence ou antecedent.

## Statut des fragments

Tous les fragments doivent etre conserves en memoire.
En revanche, ils n'ont pas tous le meme comportement dans le temps.

Le modele retenu a ce stade est un modele hybride:

- certains fragments sont ponctuels
- certains fragments sont persistants
- certains fragments sont evolutifs

Exemples:

- un cri dans la foret peut etre ponctuel
- un temoin peut rester rejouable
- un lieu de crime peut rester inspectable mais changer d'etat

Le point important est de distinguer:

- le fait qu'un fragment ait existe
- le fait qu'il soit encore actif
- le fait qu'il soit encore rejouable
- le fait qu'il soit devenu un simple souvenir

Cette nuance sera importante plus tard pour la memoire et la gestion du contexte.

## Idee de pondération future

Il n'y a pas encore de regle d'implementation fixee ici.
Mais il est deja clair qu'il faudra plus tard ponderer les fragments selon plusieurs criteres.

Exemples de criteres possibles:

- duree de vie
- importance narrative
- lien avec le final
- frequence de reutilisation
- degre de revelation deja obtenu
- distance temporelle
- distance spatiale
- etat global de l'evenement

L'idee n'est pas encore de definir des scores precis.
Simplement de retenir qu'un fragment ne doit pas avoir le meme poids en toutes circonstances.

## Ce que ce modele cherche a obtenir

Le modele cherche a concilier plusieurs objectifs:

- un monde qui evolue reellement
- une narration qui reste coherente
- une IA qui improvise sans casser la verite
- des evenements non lineaires
- des revelations partielles et progressives
- une vraie liberte pour le joueur dans la maniere d'aborder une situation

## Questions a reprendre plus tard

Ce document n'arrete pas encore certains points.
Ils devront etre travailles plus tard, probablement ensemble avec la memoire et la structure de donnees.

Points a reprendre:

- forme exacte d'un evenement en donnees
- forme exacte d'un fragment en donnees
- relation entre evenement principal et reactions secondaires
- gestion du temps et des transitions
- regles de persistance
- articulation entre couche active, historique et archive
- lien entre evenements, quetes, lieux et PNJ
- place de la DB globale et de la DB locale
- integration dans le contrat d'entree / sortie

## Resume court

Un evenement est un fait actif du monde, reel des sa creation, mais partiellement revele.
Il repose sur une verite fixe connue du MJ et sur des fragments non lineaires que le joueur peut rencontrer, ignorer ou contourner.
L'IA ne cree pas la verite: elle raconte autour de fragments compatibles avec cette verite.
Le monde continue d'evoluer, avec reactions et consequences, jusqu'a resolution, transformation ou disparition de l'evenement.
