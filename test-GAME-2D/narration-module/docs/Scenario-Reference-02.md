# Scenario Reference 02 Branches Alternatives v1

## But

Ce document sert de second scenario de reference.

Il part du meme socle que :

- [Scenario-Reference-01-Archives-Et-Scriptorium-v1.md](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/narration-module/docs/Scenario-Reference-01-Archives-Et-Scriptorium-v1.md)

Mais au lieu de suivre une seule ligne continue, il introduit des bifurcations.

L'objectif est de verifier que le moteur ne sait pas seulement "tenir une scene calme", mais aussi :

- changer proprement de mecanique MJ,
- rester coherent quand la scene bascule,
- exploiter des preoccupations differentes sans perdre le fil,
- passer d'une simple observation a une resolution plus systemique si le contexte l'exige.

## Intention generale

Le principe est simple :

- on part du contexte initial,
- on demarre comme dans le scenario 1,
- puis a certains points, une branche alternative remplace la suite attendue,
- cette branche force une lecture differente de la scene,
- donc une preoccupation differente du moteur narration.

Autrement dit :

le scenario 2 ne remplace pas le scenario 1.

Il s'en sert comme tronc commun, puis ouvre des variantes qui testent chacune une "nouvelle prerogative" du moteur.

## Tronc commun de depart

Contexte initial verrouille :

- Lieu : Parvis des Archives, Lysenthe
- Temps : milieu d'apres-midi
- Personnage actif : Gardefou (Elfe, Clerc)

Point de depart commun :

1. Le joueur observe les environs.
2. Le MJ decrit le parvis et introduit un point de focalisation plausible.
3. A partir de la, la scene peut bifurquer selon la branche choisie.

## Structure attendue du scenario 2

Le scenario 2 est construit comme ceci :

1. Tronc commun de mise en place
2. Point de divergence
3. Variante A, B, C, D...
4. Pour chaque variante :
   - ce qui change,
   - ce que le MJ doit comprendre,
   - quelle mecanique devient prioritaire,
   - quel comportement on veut verifier

## Branches alternatives a partir du scenario 1

### Branche A - Observation calme vers point d'interet

#### Idee

On part d'une observation calme, mais au lieu d'ouvrir sur une simple exploration d'ambiance, un element unique attire naturellement l'attention.

Ce n'est pas une quete forcee.

Ce n'est pas un "plot twist".

C'est un fait saillant, rare, mais credible.

#### Ce que cette branche remplace

Dans le scenario 1, l'observation ouvre sur l'annexe de copie et une scene institutionnelle sobre.

Ici, l'observation ouvre plutot sur :

- un cortege de gardes,
- des caisses marquees,
- un detail visible qui rompt legerement l'ordinaire.

#### Mecanique MJ prioritaire

`event interest`

Le moteur doit :

- introduire un element de scene saillant,
- le faire exister sans surdramatiser,
- comprendre qu'il devient le nouveau point focal,
- permettre au joueur de choisir :
  - suivre,
  - observer,
  - ignorer.

#### Ce que le MJ doit comprendre

Le joueur n'a pas demande "une quete".

Il a juste observe, et un element plus marquant se detache du decor.

Le MJ doit donc :

- faire vivre la scene,
- donner un relief,
- sans forcer une intrigue immediate.

#### Comportement attendu

Le MJ doit etre capable de produire quelque chose comme :

- un mouvement de gardes transportant des caisses scellees,
- un changement de rythme sur un cote du parvis,
- un ecusson inhabituel ou un protocole plus strict que le reste du lieu.

Puis il doit laisser le joueur decider si cela compte pour lui.

### Branche B - Orientation locale vers orientation liee au lore

#### Idee

Le joueur ne veut pas seulement savoir "ou aller".

Il cherche un lieu, une institution, une zone ou une piste qui n'est pleinement comprensible qu'a travers le lore.

#### Ce que cette branche remplace

Dans le scenario 1, la question locale porte sur l'annexe et sa fonction immediate.

Ici, la question devient plutot :

- ou se trouve un quartier precis,
- ou se trouve un lieu relie a une faction,
- ou se trouve une zone connue du monde mais pas visible directement.

#### Mecanique MJ prioritaire

`orientation locale liee au lore`

Le moteur doit :

- repondre localement,
- mais enrichir l'orientation avec du sens du monde,
- sans transformer la reponse en fiche encyclopedique.

#### Ce que le MJ doit comprendre

La demande n'est pas seulement spatiale.

Le joueur veut aussi savoir :

- ce qu'est ce lieu,
- pourquoi il compte,
- comment on le rejoint dans la logique de la ville.

#### Comportement attendu

Le MJ doit etre capable de :

- situer l'endroit,
- donner un repere urbain credible,
- ajouter une courte couleur lore,
- garder la reponse exploitable tout de suite.

### Branche C - Deplacement simple vers vrai voyage

#### Idee

Le deplacement n'est plus un simple passage d'un point proche a un autre point visible.

Le joueur decide de quitter le voisinage immediat pour rejoindre un autre secteur plus eloigne.

Cette branche ne concerne donc pas seulement une meilleure narration de trajet.

Elle implique aussi une mecanique plus lourde :

- distance reelle,
- duree de trajet,
- progression du temps,
- lien avec une carte ou une geographie exploitable,
- impact du voyage sur l'etat du monde et de la scene.

#### Ce que cette branche remplace

Dans le scenario 1, le joueur se deplace seulement du parvis vers l'annexe attenante.

Ici, il bascule vers :

- un quartier plus lointain,
- un autre pole de Lysenthe,
- une destination qui implique un vrai changement d'ambiance.

#### Mecanique MJ prioritaire

`voyage`

Le moteur doit :

- comprendre qu'on change d'echelle,
- faire sentir la transition,
- ne pas traiter cela comme un simple pas lateral,
- mettre a jour proprement le contexte de lieu,
- s'appuyer sur un futur outil de voyage plutot que sur une estimation purement narrative.

#### Ce que le MJ doit comprendre

Le joueur ne veut plus "regarder a cote".

Il veut changer de zone active.

Le moteur doit donc :

- gerer une transition plus nette,
- avec une arrivee qui change vraiment la scene,
- et resoudre des consequences concretes :
  - combien de temps cela prend,
  - a quelle distance cela se trouve,
  - ce qui change entre le depart et l'arrivee.

#### Comportement attendu

Le MJ doit etre capable de :

- proposer ou executer un trajet coherent,
- faire sentir le passage d'un quartier a un autre,
- ne pas redire le parvis une fois le voyage accompli,
- annoncer ou integrer une duree plausible,
- faire avancer l'horloge monde de facon credible,
- utiliser plus tard un outil dedie de voyage comme le commerce utilise un outil dedie d'offre.

### Branche D - Interaction avec un PNJ institutionnel vers multi-PNJs

#### Idee

Au lieu d'un seul scribe qui porte toute la scene, plusieurs figures interviennent.

Le joueur doit pouvoir naviguer entre elles sans que la conversation se brouille.

#### Ce que cette branche remplace

Dans le scenario 1, un jeune scribe devient l'interlocuteur principal.

Ici, la scene peut impliquer :

- un scribe d'accueil,
- un clerc plus ancien,
- un garde ou un porteur,
- chacun avec une fonction differente.

#### Mecanique MJ prioritaire

`multiPNJs`

Le moteur doit :

- savoir qui repond,
- maintenir les roles,
- permettre un glissement de cible si le joueur change d'interlocuteur,
- sans effacer ce qui vient d'etre etabli.

#### Ce que le MJ doit comprendre

La scene n'est plus "une conversation unique".

C'est un petit reseau de presences en meme temps.

#### Comportement attendu

Le MJ doit etre capable de :

- faire repondre la bonne personne,
- garder un ton distinct selon le role,
- ne pas fusionner tout le monde dans un PNJ flou.

### Branche E - Demande d'information vers test de competence

#### Idee

Le joueur demande ou tente quelque chose qui ne peut pas etre resolu seulement par une reponse narrative simple.

Ses competences doivent avoir une importance.

#### Ce que cette branche remplace

Dans le scenario 1, la demande d'information reste purement sociale et institutionnelle.

Ici, le joueur peut :

- observer un detail utile,
- tenter de lire discrètement un marquage,
- relever un comportement suspect,
- exploiter une aptitude pertinente.

#### Mecanique MJ prioritaire

`test de competence`

Le moteur doit :

- reconnaitre qu'une simple reponse descriptive ne suffit plus,
- faire sentir qu'une aptitude du personnage peut peser,
- sans casser la scene ni parler comme un systeme de regles brut.

#### Ce que le MJ doit comprendre

La question n'est plus seulement :

- "que me dit-on ?"

Mais aussi :

- "qu'est-ce que mon personnage percoit, devine ou obtient grace a ce qu'il sait faire ?"

#### Comportement attendu

Le MJ doit etre capable de :

- amener une resolution liee a une competence,
- produire une consequence lisible,
- maintenir l'ancrage narratif plutot que sortir une ligne purement systemique.

### Branche F - Acces partiellement limite vers tentative d'action

#### Idee

Le joueur ne se contente plus de demander.

Il essaie de faire quelque chose qui rencontre une contrainte concrete.

#### Ce que cette branche remplace

Dans le scenario 1, le scribe annonce une limite sobre, mais la scene reste cooperative.

Ici, le joueur peut tenter :

- d'entrer plus loin,
- de forcer un passage verbalement,
- de contourner une consigne,
- de prendre l'initiative avant autorisation.

#### Mecanique MJ prioritaire

`tentative d'action`

Le moteur doit :

- traiter cela comme une action reelle,
- repondre par une consequence ou un blocage coherent,
- pas comme une phrase vague ou une inertie de scene.

#### Ce que le MJ doit comprendre

La scene doit maintenant arbitrer :

- ce qui est autorise,
- ce qui est refuse,
- ce qui ouvre une nouvelle tension locale.

#### Comportement attendu

Le MJ doit etre capable de :

- opposer une limite credible,
- faire reagir les bonnes personnes,
- laisser une suite logique :
  - insister,
  - se justifier,
  - renoncer,
  - changer d'approche.

### Branche G - Scene sobre vers amorce de trame

#### Idee

La scene reste sobre, mais elle laisse une consequence a plus long terme.

On n'est plus seulement dans un echange local.

Quelque chose est seme pour plus tard.

#### Ce que cette branche remplace

Dans le scenario 1, l'echange peut se conclure proprement sans laisser de suite forte.

Ici, la scene peut produire :

- une piste recurrente,
- un nom a retenir,
- une restriction inhabituelle,
- une trace qui alimente une trame sans l'imposer.

#### Mecanique MJ prioritaire

`trames`

Le moteur doit :

- faire exister une consequence qui depasse le tour courant,
- sans transformer la scene en quete automatique,
- sans casser la sobriete du moment.

#### Ce que le MJ doit comprendre

La scene doit se suffire a elle-meme.

Mais elle peut aussi laisser :

- une tension,
- une curiosite,
- une piste,
- un element memorisable pour plus tard.

#### Comportement attendu

Le MJ doit etre capable de :

- conclure une scene locale,
- tout en laissant une trace exploitable ensuite,
- sans surcharger la narration immediate.

## Utilisation de ce document

Ce document sert a "premacher" les branches de test.

Il prepare le terrain, mais il n'est pas encore assez defini pour etre un scenario joue complet.

La suite logique est :

1. choisir une branche,
2. la developper sur plusieurs tours,
3. definir plus precisement :
   - les actions joueur,
   - les reponses attendues du MJ,
   - les mecanismes du moteur a valider.

## Grandes mecaniques MJ a soutenir par des outils dedies

Certaines branches de ce document ne relevent pas seulement d'une meilleure prose ou d'une meilleure lecture d'intention.

Elles renvoient a des mecaniques plus lourdes qui devront etre soutenues par des outils dedies, sur le meme principe que le commerce commence a l'etre.

### Voyage

Le voyage devra a terme s'appuyer sur un outil capable de gerer :

- la carte,
- les distances,
- le temps de trajet,
- les transitions de zones,
- les consequences de temps sur la scene.

### Repos

Le repos devra pouvoir gerer :

- le passage du temps,
- la recuperation,
- les interruptions eventuelles,
- les changements d'etat lies a une pause courte ou longue.

### Bastions

La gestion de propriete ou de lieu possede devra pouvoir gerer :

- l'etat du lieu,
- les activites associees,
- les consequences a moyen terme,
- les evenements lies a ce point d'ancrage.

### Compagnons

Les compagnons devront pouvoir etre traites comme des presences suivies :

- PNJ allies,
- montures,
- creatures,
- disponibilite,
- comportement,
- impact sur la scene.

### Passage de niveau

Le passage de niveau devra pouvoir soutenir :

- la progression du personnage,
- les gains notables,
- la maniere dont cela se traduit dans la fiction,
- les nouvelles possibilites ouvertes.

### Perception du personnage et regard du monde

Le moteur devra aussi mieux prendre en compte :

- la facon dont le personnage percoit le monde,
- la facon dont le monde percoit le personnage,
- le statut visible,
- la reputation,
- les signes d'appartenance,
- l'effet social ou narratif de cette position.

### Regle generale

Pour toutes ces familles :

- l'outil ne remplace pas le MJ,
- il fournit un socle fiable,
- il produit des faits de scene et des contraintes,
- puis le MJ s'appuie dessus pour narrer proprement.

## Statut

- Base d'idees structuree : active
- A relire, corriger et preciser avant transformation en vrai scenario de reference multi-tours
