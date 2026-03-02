# Scenario Reference 01 Archives Et Scriptorium v1

## But

Ce document decrit un scenario de reference a reproduire par le module narration.

Il ne sert pas a hardcoder des repliques.

Il sert a verifier que le MJ :

- suit une scene sur plusieurs tours,
- comprend des intentions variees dans leur contexte,
- fait avancer la situation sans recompiler un etat machine,
- garde une continuite de lieu, de ton et de faits etablis,
- repond naturellement sans deriver vers des phrases techniques.

Ce scenario part du contexte initial verrouille :

- Lieu : Parvis des Archives, Lysenthe
- Temps : milieu d'apres-midi
- Personnage actif : Gardefou (Elfe, Clerc)

## Intention du scenario

Changer du schema habituel "aller au marche / parler a un marchand".

Ici, on veut tester :

- observation calme,
- orientation locale,
- deplacement,
- interaction avec un PNJ institutionnel,
- demande d'information,
- acces partiellement limite,
- reponse sobre sans quete forcee,
- continuite sur une dizaine de tours.

Le scenario cible :

le joueur remarque une annexe de copie des Archives, cherche a y entrer pour consulter un registre public, obtient un echange simple avec un scribe, puis comprend qu'une partie des documents reste reservee sans que cela casse la scene.

## Regles de lecture

Les reponses ci-dessous sont des cibles de comportement.

Elles montrent :

- le niveau de naturel attendu,
- le degre de sobriete,
- la maniere de faire avancer la scene.

Elles ne sont pas des lignes a recopier telles quelles.

## Scenario joue de reference

### Tour 1

Joueur :

`que puis-je voir autour de moi ?`

MJ attendu :

`Sur le parvis des Archives, le calme tient encore, malgre le passage regulier de lecteurs et de clercs. Deux scribes descendent les marches en parlant a voix basse, tandis qu'un porteur remonte avec une caisse etroite serre contre lui. Plus loin, sur le cote du batiment principal, une galerie couverte laisse deviner une annexe plus modeste ou l'on entre et sort avec des rouleaux et des registres.`

Ce que le moteur doit faire :

- decrire le lieu sans evenement artificiel,
- introduire un detail exploitable,
- ne pas parler de "scene stable" ou de "runtime".

### Tour 2

Joueur :

`je regarde mieux la galerie couverte sur le cote`

MJ attendu :

`En portant ton attention sur le cote des Archives, tu distingues mieux la galerie de pierre claire qui longe une aile secondaire du complexe. Les allers-retours y sont plus rapides que sur le grand parvis : on y voit surtout des clercs presses, des apprentis copistes et quelques visiteurs qui attendent leur tour pres d'une table de controle. Cela ressemble moins a une salle solennelle qu'a un lieu de travail courant.`

Ce que le moteur doit faire :

- comprendre qu'il s'agit d'une observation focalisee,
- resserrer la description sur le point vise,
- faire sentir une continuation.

### Tour 3

Joueur :

`c'est quoi cet endroit ?`

MJ attendu :

`A la facon dont les gens y circulent, tu comprends qu'il s'agit d'une annexe de consultation et de copie. Ce n'est pas le coeur le plus protege des Archives, mais un espace ou l'on trie, copie ou fait verifier certains documents accessibles au public ou aux visiteurs autorises. Depuis le parvis, on peut facilement s'en approcher pour demander ce qu'on y accepte.`

Ce que le moteur doit faire :

- traiter la question comme une demande d'information locale,
- repondre a partir du contexte etabli,
- ne pas renvoyer vers une re-description generale.

### Tour 4

Joueur :

`je m'approche de l'annexe`

MJ attendu :

`Tu quittes le centre du parvis pour longer les dalles jusqu'a la galerie. A mesure que tu t'en rapproches, le bruit de la place s'efface un peu derriere le froissement des parchemins, les pas rapides et les voix retenues des gens qui patientent. Pres de l'entree, une table etroite sert de point d'accueil avant le passage vers l'interieur.`

Ce que le moteur doit faire :

- executer le deplacement sans bloquer inutilement,
- faire sentir le changement de sous-lieu,
- ancrer un nouveau point focal.

### Tour 5

Joueur :

`je m'arrete devant la table d'accueil et j'attends qu'on me remarque`

MJ attendu :

`Tu t'arretes devant la table sans forcer le passage. Au bout de quelques instants, un jeune scribe releve enfin la tete d'un registre qu'il annote, puis reporte son attention sur toi. Son tablier d'encre et ses doigts taches disent assez qu'il passe plus de temps a copier qu'a bavarder, mais il ne parait ni presse de te chasser ni mefiant.`

Ce que le moteur doit faire :

- comprendre une attitude passive mais engagee,
- introduire naturellement l'interlocuteur,
- ne pas exiger artificiellement un "nom de PNJ" avant de repondre.

### Tour 6

Joueur :

`je le salue et je demande ce qu'on peut consulter ici`

MJ attendu :

`Le scribe incline legerement la tete en retour avant de refermer son registre sur un doigt pour garder sa page. "Ici, on traite surtout les copies, les demandes de verification et les consultations simples", t'explique-t-il d'une voix basse. "Les registres de circulation, certains actes publics et les extraits deja prepares peuvent etre consultes ou recopies. Pour les salles internes, il faut un motif plus net ou une autorisation."`

Ce que le moteur doit faire :

- faire repondre le PNJ directement,
- donner une information claire,
- poser une limite credibile sans bloquer toute la scene.

### Tour 7

Joueur :

`je lui demande si je peux voir un registre public recent`

MJ attendu :

`Le scribe te detaille un instant, comme pour juger s'il faut t'envoyer ailleurs ou non, puis il hoche la tete. "Un registre public recent, oui, si tu sais ce que tu cherches a peu pres. Pas les dossiers reserves, pas les scelles, mais les copies de circulation et les notices deja sorties, cela se fait." Il pousse ensuite vers toi une tablette de bois couverte de marques de classement. "Donne-moi au moins le type de document."`

Ce que le moteur doit faire :

- comprendre une demande exploitable,
- produire une progression immediate,
- introduire une contrainte sobre et logique.

### Tour 8

Joueur :

`je lui dis que je veux surtout comprendre les mouvements recents autour du quartier`

MJ attendu :

`A cette precision, le scribe parait mieux saisir ce que tu demandes. Il tourne la tablette vers lui, suit deux colonnes du doigt, puis repond sans se lever : "Pour les mouvements ordinaires, on a surtout des releves d'entrees et de sorties deja recopies. Pas les noms proteges, pas les notes internes, mais les passages officiels et les depots declares, oui." Il te designe ensuite un banc contre le mur. "Attends la, je peux t'en faire sortir un extrait."`

Ce que le moteur doit faire :

- relier la precision a la question precedente,
- faire avancer concretement la scene,
- maintenir la limite entre public et reserve.

### Tour 9

Joueur :

`je vais m'asseoir sur le banc et j'observe ce qui se passe pendant qu'il cherche`

MJ attendu :

`Tu prends place sur le banc de pierre, a l'ecart du passage direct. Depuis la, tu vois mieux la vie discrete de l'annexe : un copiste roule un feuillet fraichement seche, une femme agee attend qu'on lui relise un extrait, et un clerc plus ancien corrige en silence des marges deja noircies. Rien de spectaculaire, mais tout ici respire le travail patient et la circulation reglee de l'information.`

Ce que le moteur doit faire :

- conserver le meme sous-lieu,
- faire vivre la scene sans lancer un evenement gratuit,
- utiliser l'attente comme moment d'observation, pas comme vide.

### Tour 10

Joueur :

`quand il revient, je lui demande si tout le monde peut demander ce genre d'extrait`

MJ attendu :

`Quand le jeune scribe revient avec un feuillet mince, il entend ta question avant meme de te tendre la copie. "Tout le monde peut demander, non", repond-il avec plus de mesure que de severite. "Mais pour ce qui est deja classe en public, ou pour un extrait simple sans enjeu sensible, on regarde la demande et on avise. Le reste depend du motif, du statut de la personne et de ce que les Archives acceptent de laisser circuler." Il te remet alors l'extrait avec ce melange de reserve et de routine propre aux gens qui gardent des limites sans en faire un drame.`

Ce que le moteur doit faire :

- repondre a la question situee,
- garder la cohherence du PNJ,
- conclure l'echange sans quete forcee ni refus brutal hors contexte.

## Ce que ce scenario teste vraiment

Si le module sait reproduire ce type de scene, il doit etre capable de :

- suivre un fil social simple sans perdre le contexte,
- faire exister un lieu institutionnel sans le rendre artificiellement hostile,
- distinguer :
  - observation,
  - question locale,
  - deplacement,
  - prise de contact,
  - demande d'information,
  - attente,
  - reprise de conversation,
- faire avancer la scene sans redire la meme base a chaque tour.

## Signes d'echec a surveiller

Le scenario est considere comme rate si le MJ :

- redescrit tout le parvis a chaque tour,
- repond par une phrase de moteur deguisee,
- traite une question locale comme une action hypothetique,
- force un blocage de garde ou d'acces sans raison,
- cree une quete ou un mystere juste pour "remplir",
- oublie le scribe une fois l'echange engage,
- ne relie pas les tours 7, 8, 9 et 10 entre eux.

## Utilisation comme test de reference

Ce scenario peut servir de base de validation pour les prochaines passes :

1. Jouer ce scenario manuellement.
2. Comparer les reponses reelles aux attentes de comportement.
3. Evaluer :
   - continuite,
   - naturel,
   - sobriete,
   - absence de fuite technique,
   - bonne progression locale.
4. Corriger ensuite le moteur, pas les repliques.

## Statut

- Scenario de reference : actif
- A conserver comme base de test tant qu'un second scenario de reference n'est pas ajoute
