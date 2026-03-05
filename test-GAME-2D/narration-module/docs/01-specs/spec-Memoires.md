# Specification des memoires

## But

Ce document formalise les principes de memoire pour le module narration.
Il ne detaille pas encore l'implementation technique.

Son objectif est de poser une structure claire pour:

- la base canonique de reference
- la memoire propre a chaque partie
- la verite effective du monde en jeu
- la difference entre ce que le joueur sait et ce qui est vrai

## Principe general

Le systeme ne doit pas reposer sur une seule memoire.
Il doit reposer sur plusieurs couches ayant des roles differents.

La distinction centrale est la suivante:

- le wiki est la base canonique initiale
- la memoire de partie est la couche evolutive propre a une partie
- le contexte local est la projection immediate de la verite utile a la scene

La verite de jeu n'est donc pas lue depuis une seule source.
Elle est calculee a partir d'une hierarchie.

## Wiki canonique

Le wiki est la base canonique de reference du monde.

Il doit etre compris comme:

- une base globale
- commune a tous les joueurs
- commune a toutes les parties
- stable
- non modifiee par le deroulement d'une partie

Le wiki represente une photo du monde a `T=0`.

Il donne:

- l'etat initial du monde
- les lieux
- les cultures
- les institutions
- les factions
- les bases de lore
- les relations de reference

Le wiki ne doit pas evoluer pendant une partie.
Il reste un socle commun.

## Memoire de partie

La memoire de partie est une couche propre a une partie jouee.

Elle doit etre:

- specifique a une campagne, session ou sauvegarde
- evolutive
- persistante
- capable de contredire le wiki
- dominante sur le wiki en cas de conflit

Elle sert a stocker:

- ce qui s'est produit dans la partie
- ce qui a change dans le monde
- ce que le joueur a appris
- ce qui reste actif ou pertinent

La memoire de partie ne remplace pas le wiki.
Elle le surcouche.

## Contexte local

Le contexte local est la couche immediate utile pour la scene en cours.

Il doit etre construit a partir de:

- la memoire de partie en priorite
- le wiki si aucun override de partie ne contredit la base
- la situation immediate de lieu, d'acteurs et d'evenements actifs

Le contexte local n'est pas la memoire complete.
C'est une projection contextuelle.

Son role est de fournir a l'IA uniquement ce qui est utile ici et maintenant.

## Hierarchie de verite

La regle de priorite doit etre la suivante:

`contexte local actif > memoire de partie > wiki global partage`

Cela implique:

- ce qui est vrai dans la scene immediate prime
- sinon la partie en cours fixe la verite actuelle
- sinon on retombe sur le canon initial du wiki

Exemple:

- le wiki dit que Lysenthe est un ducat
- une partie fait du PJ le nouveau souverain
- la memoire de partie enregistre ce changement
- la verite effective dans cette partie n'est plus le ducat d'origine

Le wiki reste utile comme historique et base de reference, mais il n'est plus la verite actuelle de cette partie.

## Verite effective

La verite effective est la verite exploitable par le MJ et par l'IA a un instant donne.

Elle resulte de la fusion hierarchisee entre:

- le wiki canonique
- la memoire de partie
- le contexte local actif

Cette verite effective doit permettre de:

- rester coherent avec le monde de base
- integrer les consequences de la partie
- raconter correctement la scene presente

## Unites de memoire

La memoire de partie ne doit pas etre monolithique.
Elle doit etre decoupee en plusieurs unites dediees a des pans differents du gameplay.

Le noyau retenu a ce stade est:

- `events`
- `relations`
- `knowledge`
- `world_overrides`

## Memoire des evenements

La memoire des evenements stocke la dynamique du monde au fil de la partie.

Elle doit contenir:

- les evenements actifs
- les evenements passes
- les evenements resolus
- les evenements ignores
- les evenements transformes
- les fragments associes
- leur etat d'avancement
- leurs consequences

Cette memoire sert a conserver:

- la coherence des scenarios en cours
- la persistance des enjeux
- le suivi des revelations
- les transitions entre scenes

Elle est au coeur de la continuite narrative.

## Memoire des relations

La memoire des relations sert a conserver la coherence sociale, politique et institutionnelle de la partie.

Elle peut couvrir:

- PJ <-> PNJ
- PJ <-> factions
- PJ <-> villes
- PJ <-> institutions
- faction <-> faction
- PNJ <-> PNJ si cela devient pertinent

Elle doit pouvoir porter:

- confiance
- hostilite
- dette
- influence
- reputation
- loyautes
- tensions

Cette memoire permet au monde de reagir de facon stable aux actions du joueur.

## Memoire de connaissance

La memoire de connaissance ne doit pas etre reduite a un simple journal.
Elle doit distinguer clairement:

- ce que le joueur peut consulter
- ce que le systeme tient comme verite exploitable

Le bloc `knowledge` doit donc comporter au minimum:

- `player_view`
- `truth_view`

## `knowledge.player_view`

`player_view` represente la memoire consultable par le joueur.

Elle peut contenir:

- ce qu'il a vu
- ce qu'il a entendu
- ce qu'il a appris
- les lieux visites
- les personnes rencontrees
- les elements marquants
- des resumes
- des pistes

Cette couche peut melanger:

- de l'information complete
- de l'information partielle
- des perceptions justes
- des incomprehensions

Mais elle ne doit pas etre confondue avec la verite systeme.

### Alimentation de `player_view`

Cette couche peut etre alimentee de deux facons:

- automatiquement par le contrat de sortie de l'IA
- manuellement par le joueur

Cela permet:

- d'assurer une memoire minimale sans effort
- de laisser au joueur un carnet vivant
- d'eviter des aller-retours IA inutiles pour de simples notes

### Partie automatique

La partie automatique doit rester prudente.

Elle peut contenir:

- des faits observes
- des rappels de contexte
- des resumes courts
- des pistes formulees avec prudence

Elle peut orienter la lecture du joueur, mais elle ne doit pas affirmer une verite non confirmee.

Exemples acceptables:

- "Deux gardes filtraient l'entree."
- "Les archives sont actuellement fermees."
- "Une piste possible concerne le quai est."

Exemples a eviter:

- "Le garde ment."
- "Le debardeur est coupable."
- "La faction X est responsable."

### Partie manuelle

Le joueur peut completer sa memoire avec:

- des notes
- des rappels
- des hypothese
- des interpretations

Ces elements sont utiles comme aide-memoire personnel.
En revanche, ils ne doivent jamais devenir une source de verite pour le MJ.

Regle fondamentale:

Les notes, hypotheses ou interpretations du joueur ne modifient jamais la verite systeme.

Le MJ ne doit pas confondre:

- ce que le joueur croit
- ce qui est vrai

Si le joueur se trompe, la correction doit venir du jeu:

- contradiction d'un PNJ
- nouvel indice
- reformulation
- rappel explicite
- test de perspicacite ou mecanique equivalente

Mais la couche de verite ne doit pas etre alteree par l'erreur du joueur.

## `knowledge.truth_view`

`truth_view` represente la connaissance systeme / MJ exploitable.

Elle doit contenir:

- les faits confirms par le systeme
- les liens reels entre les elements
- les recoupements veritables
- ce qui a ete observe sans encore etre pleinement compris par le joueur

Cette couche n'est pas forcement visible au joueur.
Elle sert a l'IA pour:

- conserver la coherence
- piloter les revelations
- eviter les contradictions
- savoir ce qui est reel meme si cela n'est pas encore compris cote joueur

Regle fondamentale:

`truth_view` est la couche d'autorite logique.

## Memoire des overrides du monde

`world_overrides` sert a stocker ce qui modifie ou contredit le canon initial du wiki dans une partie donnee.

Cette couche est essentielle car le wiki reste fige.

Elle doit permettre de conserver:

- l'etat canonique d'origine
- l'etat actuel dans la partie
- la trace du changement

Exemples:

- changement de gouvernance
- mort d'un PNJ important
- destruction ou fermeture durable d'un lieu
- changement de faction dominante
- transformation d'un batiment
- revelation majeure qui modifie durablement le monde

Un override ne doit pas effacer la base wiki.
Il doit la surplomber.

Le systeme doit pouvoir comprendre a la fois:

- ce qui etait vrai a l'origine
- ce qui est vrai maintenant
- comment et quand cela a change

## Memoire complete et memoire projetee

Le systeme doit distinguer:

- la memoire complete
- la memoire projetee

### Memoire complete

La memoire complete contient tout ce qui est conserve dans la partie.

Elle sert a:

- l'historique
- la persistance
- la relecture
- la reconstruction de verite

### Memoire projetee

La memoire projetee est le sous-ensemble remonte dans le contrat d'entree pour une scene donnee.

Elle est selectionnee selon:

- le lieu
- les acteurs presents
- l'intention du joueur
- les evenements actifs
- les relations pertinentes
- les connaissances utiles

Le systeme ne doit pas renvoyer toute la memoire complete a chaque tour.
Il doit filtrer.

## Persistance et activation

Le fait qu'un element soit stocke ne signifie pas qu'il doit etre actif dans le contexte.

Il faut distinguer:

- ce qui est stocke
- ce qui est encore actif
- ce qui est encore rejouable
- ce qui est archive mais disponible

Cette logique vaut particulierement pour:

- les fragments d'evenements
- les pistes
- les relations
- certains details contextuels

La memoire doit pouvoir grandir sans transformer chaque tour en surcharge contextuelle.

## Cycle de vie des elements de memoire

La memoire ne doit pas fonctionner sur une opposition trop simple entre:

- present
- supprime

Ce modele serait trop brutal et casserait la continuite.

Le bon principe est un cycle de vie progressif.
Un element ne doit pas disparaitre d'un seul coup par defaut.
Il doit plutot changer de niveau de priorite et de disponibilite.

Cette logique est necessaire pour:

- eviter la surcharge contextuelle
- conserver l'historique utile
- ne pas perdre des informations importantes
- garder une memoire consultable sur le long terme

## Etats de cycle de vie recommandes

Le modele recommande a ce stade repose sur quatre etats principaux:

- `actif`
- `pertinent`
- `dormant`
- `archive`

## Etat `actif`

Un element `actif` est un element qui doit remonter facilement dans le contexte.

Il est:

- directement utile a la scene presente
- fortement lie a un evenement en cours
- tres recent ou tres determinant
- potentiellement interactif ou rejouable

Exemples:

- un evenement en cours dans la zone
- un fragment fraichement revele
- une tension immediate entre le PJ et un PNJ present
- une piste encore chaude

Cet etat doit etre reserve aux elements qui ont un impact fort sur la narration immediate.

## Etat `pertinent`

Un element `pertinent` reste important, mais ne doit pas remonter systematiquement.

Il est:

- encore utile
- toujours potentiellement mobilisable
- moins central que les elements actifs

Il peut remonter si:

- le lieu s'y rapporte
- un acteur concerne reapparait
- l'intention du joueur le justifie
- un recoupement narratif devient utile

Exemples:

- un temoin deja rencontre
- une ancienne piste encore non fermee
- une relation tendue mais non immediate
- un changement politique encore structurant

## Etat `dormant`

Un element `dormant` reste conserve et disponible, mais il ne doit presque jamais remonter par defaut.

Il est:

- encore valable dans l'historique de partie
- faible en urgence immediate
- peu utile tant qu'aucun contexte ne le reactivate

Il peut redevenir pertinent si:

- un lieu ou un acteur le rappelle
- un nouvel evenement y fait echo
- le joueur cherche activement dans sa memoire

Exemples:

- une vieille rumeur non suivie
- un fragment ponctuel deja traite
- une relation secondaire non active
- un detail de scene qui n'a plus d'effet direct

## Etat `archive`

Un element `archive` est conserve comme trace longue duree.

Il ne doit pas nourrir le contexte courant, sauf cas particulier de recherche ou de recoupement fort.

Il sert surtout a:

- conserver l'historique complet
- permettre la relecture
- maintenir la coherence longue duree
- retrouver d'anciens antecedents

Exemples:

- un evenement resolu depuis longtemps
- un fragment ponctuel devenu simple souvenir
- une ancienne configuration du monde remplacee par un override plus recent
- un ancien etat social devenu historique

Le passage en archive ne doit pas signifier oubli.
Il signifie sortie de la couche active.

## Regle d'archivage

Le systeme ne doit pas chercher a "supprimer" la memoire en premier recours.

La logique cible est:

1. un element nait en `actif` ou `pertinent`
2. il perd en priorite avec le temps ou selon son usage
3. il passe en `dormant` quand il n'alimente plus la scene immediate
4. il passe en `archive` lorsqu'il devient surtout historique

Cette degradation progressive est preferable a une suppression brutale.

## Criteres de priorisation

Le passage d'un etat a un autre ne doit pas dependre d'un seul facteur.

Les deux grands axes retenus sont:

- l'importance
- la temporalite

Mais ils doivent etre croises avec d'autres criteres.

Les criteres les plus solides pour evaluer la priorite d'un element sont:

- importance narrative
- importance systemique
- fraicheur temporelle
- activite actuelle
- lien avec un evenement actif
- lien avec le PJ
- capacite a produire encore une interaction
- utilite de recoupement

Un element ancien peut rester majeur.
Un element recent peut devenir vite negligeable.

La temporalite seule ne suffit donc jamais.

## Importance narrative et importance systemique

Ces deux notions ne doivent pas etre confondues.

### Importance narrative

Elle mesure a quel point un element peut encore nourrir:

- une scene
- une tension
- une revelation
- une decision du joueur
- une continute de ton ou de situation

### Importance systemique

Elle mesure a quel point un element modifie encore:

- la verite du monde
- les etats persistants
- les relations durables
- la structure de quete
- les conditions d'acces ou de consequence

Exemple important:

- un cri dans la foret peut avoir une forte importance narrative a court terme, puis chuter vite
- un changement de souverain a une importance systemique durable, meme si la scene immediate est ailleurs

Cette distinction doit guider l'archivage.

## Effet sur la projection de memoire

Le cycle de vie doit influencer directement la memoire projetee.

Regle simple:

- `actif`: remonte facilement
- `pertinent`: remonte si le contexte le justifie
- `dormant`: remonte rarement et sur demande implicite ou explicite
- `archive`: ne remonte presque jamais, sauf recherche, recoupement ou consultation volontaire

Ainsi, la memoire complete peut continuer de croitre sans surcharger le contrat d'entree.

## Cas particuliers

Certains elements ne doivent presque jamais descendre trop bas, meme anciens.

Exemples:

- un override majeur du monde
- une relation structurante
- un traumatisme ou une dette centrale
- un changement politique durable
- un evenement fondateur de campagne

Ces elements peuvent devenir moins narrativement actifs, mais rester structurellement prioritaires.

## Principe de prudence

Il vaut mieux archiver trop lentement que trop vite.

Si un element important descend trop tot:

- la narration perd en coherence
- l'IA oublie des enjeux encore vivants
- le monde parait incoherent ou amnesique

Le bon choix initial est donc:

- des etats clairs
- des transitions prudentes
- une logique d'archivage progressive

Plutot qu'une formule de score trop agressive ou trop opaque.

## Statut des fragments en memoire

Tous les fragments doivent etre conserves en memoire.

En revanche, ils n'ont pas tous la meme valeur dans le temps.

Le modele retenu est hybride:

- certains fragments sont ponctuels
- certains fragments sont persistants
- certains fragments sont evolutifs

Exemples:

- un cri dans la foret peut etre ponctuel
- un temoin peut rester rejouable
- un lieu de crime peut rester inspectable mais changer d'etat

Le point important est de distinguer:

- qu'un fragment a existe
- qu'il est encore actif
- qu'il est encore rejouable
- qu'il est devenu un souvenir ou un antecedent

## Consultation par le joueur

Le joueur doit pouvoir consulter une partie de la memoire.

Cette consultation concerne principalement:

- `knowledge.player_view`
- certains resumes
- certains journaux
- certaines pistes

Le joueur ne doit pas consulter directement la couche de verite systeme.

L'interface de consultation doit soutenir:

- le rappel de campagne
- la comprehension des scenes passees
- la reprise apres interruption
- la reduction de charge mentale

## Consultation par l'IA

L'IA doit pouvoir consulter la memoire selon son role.

Elle doit pouvoir utiliser:

- la verite effective
- `knowledge.truth_view`
- les evenements et fragments pertinents
- les relations utiles
- les overrides du monde

Elle ne doit pas prendre les notes libres du joueur pour des faits vrais.

## Regles fondamentales retenues

- Le wiki est global, partage, stable et fige.
- Le wiki represente le monde a `T=0`.
- La memoire de partie est propre a chaque partie.
- La memoire de partie peut contredire le wiki.
- En cas de conflit, la memoire de partie prime sur le wiki.
- Le contexte local prime sur tout le reste pour la scene en cours.
- Le joueur peut consulter sa memoire, pas la verite systeme brute.
- Les notes manuelles du joueur ne modifient jamais la verite.
- Le MJ reste l'arbitre de la verite.
- La memoire complete doit etre plus large que la memoire projetee.

## Points a preciser plus tard

Ce document fixe les principes, mais plusieurs details restent a concevoir.

Points a reprendre plus tard:

- format exact de stockage de chaque unite
- niveau de granularite des relations
- format detaille de `knowledge.player_view`
- format detaille de `knowledge.truth_view`
- regles de selection de la memoire projetee
- niveau de persistance des fragments
- articulation avec les quetes
- articulation avec la DB locale et la DB globale
- interface de consultation joueur
- methodes de recherche et de filtrage

## Resume court

La memoire du systeme repose sur une architecture en couches.
Le wiki fournit un canon initial global et immuable.
Chaque partie dispose de sa propre memoire evolutive, dominante sur le wiki lorsqu'un changement survient.
Le contexte local projette ensuite la verite utile a la scene.

Cette memoire de partie est decoupee en plusieurs unites, notamment:

- evenements
- relations
- connaissance
- overrides du monde

La connaissance elle-meme doit separer:

- ce que le joueur peut consulter
- ce que le systeme tient pour vrai

Cette separation est necessaire pour conserver a la fois:

- la coherence du monde
- la liberte du joueur
- la place du MJ comme arbitre
- la continuite sur le long terme
