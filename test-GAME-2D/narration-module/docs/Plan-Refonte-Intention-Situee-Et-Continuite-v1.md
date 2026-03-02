# Plan Refonte Intention Situee Et Continuite v1

## Objectif clair

Construire un MJ narratif qui reagit de facon naturelle aux demandes du joueur en prenant en compte :

- le contexte deja etabli,
- les actions et paroles des tours precedents,
- les elements de scene deja introduits,
- le lore disponible et coherent avec le monde,
- les outils et resultats d'outils quand ils existent,
- sans se replier sur des phrases de runtime ou des gabarits mecaniques.

Le but n'est pas seulement de "classifier" le message du joueur.

Le but est que le MJ comprenne :

- ce que le joueur essaie de faire maintenant,
- a quoi cette action se rattache dans la scene en cours,
- ce qui a deja ete montre ou dit,
- quelle est la suite logique la plus naturelle dans ce contexte.

Le module narration sera considere comme correct quand le MJ pourra enchainer plusieurs tours de facon fluide, sans redire la meme chose, sans perdre le contexte, et sans sortir des phrases techniques ou des raisonnements internes en mode RP.

## Constats francs sur le probleme actuel

Le moteur actuel sait deja faire plusieurs choses utiles :

- classer une intention grossiere,
- maintenir un lieu courant,
- maintenir un interlocuteur,
- declencher certains outils,
- produire une reponse RP minimale.

Mais il reste structurellement trop faible sur un point central :

il sait mieux reconnaitre un type de scene que comprendre un acte situe dans une scene en continuite.

En pratique, cela produit trois defauts recurrents :

1. Le MJ re-decrit la scene au lieu de la faire avancer.
2. Le MJ repete un etat general au lieu de repondre a l'intention precise du joueur.
3. Les resultats d'outils ou de scenes precedentes ne deviennent pas assez des faits persistants de la narration.

Le probleme de fond n'est donc pas "le commerce".

Le commerce ne fait que reveler le vrai probleme :

le moteur narratif traite encore trop les tours comme des messages isoles, meme quand un contexte existe.

## Vision cible

Le MJ doit raisonner comme un meneur de jeu qui suit une scene.

A chaque tour, il doit pouvoir se dire implicitement :

1. Ou en est la scene maintenant ?
2. Qu'est-ce qui vient de se passer juste avant ?
3. Qu'est-ce que le joueur tente reellement ici et maintenant ?
4. Est-ce une continuation logique d'un element deja etabli ?
5. Quelle est la reponse la plus naturelle et la plus sobre dans ce contexte ?

La bonne reponse n'est pas forcement :

- une nouvelle quete,
- une revelation,
- un evenement,
- un appel outil,
- un changement de runtime.

Tres souvent, la bonne reponse est simplement :

- une reaction credible,
- une progression locale,
- une consequence immediate,
- une confirmation sobre,
- ou un refus coherent ancre dans le monde.

## Principe central : l'intention situee

L'intention situee est la vraie unite de travail du module narration.

Elle ne se limite pas a un type global (`story_action`, `social_action`, etc.).

Elle doit decrire, pour le tour courant :

- l'acte tente,
- la cible probable,
- l'objet de l'acte,
- le lien avec la scene precedente,
- le niveau d'engagement reel,
- et la prochaine etape logique.

### Ce qu'on veut extraire

Pour chaque tour, le moteur doit tendre vers une lecture de ce type :

- Acte : observer, se deplacer, entrer, saluer, demander, choisir, refuser, negocier, attendre, quitter, etc.
- Cible : lieu, personne, groupe, objet, information, direction, point d'interet.
- Objet : ce qui est concretement vise (ex: "une tenue", "la tunique", "la grande rue", "le garde", "le prix").
- Lien scene : nouveau sujet, poursuite directe, confirmation, correction, precisions, selection, relance.
- Engagement : informatif, hypothetique, declaratif, volitif, mais interprete dans le contexte et non comme une fin en soi.
- Etape logique : ce que le MJ doit resoudre maintenant si rien ne bloque.

### Ce qu'on ne veut plus

On ne veut plus qu'un tour soit traite seulement comme :

- "c'est informatif donc je n'avance pas",
- "c'est social donc je reste vague",
- "c'est story_action donc je redescris la scene".

Exemple :

- `je cherche une tenue pour l'ecole de magie`

Ce message peut etre "informatif" au sens grammatical, mais en scene ce n'est pas un message passif.
Dans une boutique, c'est une demande exploitable et immediate.

Le moteur doit donc le lire comme :

- acte situe = demande d'offre contextualisee,
- cible = marchand deja present,
- objet = tenue adaptee a un usage academique,
- suite logique = presenter quelques options credibles.

## Principe central : la scene doit avoir des ancres persistantes

Le module a besoin d'un etat de scene plus exploitable que des champs generiques.

Chaque scene devrait pouvoir s'appuyer sur des ancres persistantes, au moins a court terme :

- lieu courant,
- sous-lieu / point focal,
- interlocuteur actif,
- sujet actif,
- dernier fait etabli,
- dernier element montre,
- dernier choix du joueur,
- derniere offre / proposition / obstacle,
- dernier enjeu implicite.

Ces ancres ne sont pas la pour "faire du debug".

Elles sont la pour permettre au moteur de repondre naturellement au tour suivant sans re-partir de zero.

### Exemples d'ancres utiles

- `activeLocation`: Rue marchande
- `activePoi`: boutique de vetements
- `activeInterlocutor`: marchande
- `activeTopic`: achat d'une tenue
- `lastPresentedItems`: tunique d'etude, robe d'apprenti, sacoche de cours
- `lastPlayerFocus`: tunique d'etude
- `lastSceneFact`: la marchande a montre trois articles adaptes a l'ecole

Avec cet etat, `je choisis la tunique` devient facile a resoudre naturellement.

Sans cet etat, le moteur re-tombe sur une description generale de boutique.

## Principe central : les outils doivent produire des faits de scene, pas seulement du texte

Un outil ne doit pas etre vu seulement comme "un moyen de remplir une reponse".

Un outil doit produire :

- un resultat utile,
- une trace de raisonnement technique,
- et surtout un fait narratif integrable dans la scene.

Exemple :

- un outil de boutique ne doit pas seulement renvoyer trois objets,
- il doit alimenter une ancre de scene du type `lastPresentedItems`.

Sinon, le tour suivant ne sait pas exploiter ce qui vient d'etre etabli.

### Regle generale

Tout resultat d'outil qui modifie ce que le joueur percoit ou peut utiliser doit pouvoir :

1. etre memorise a court terme,
2. etre relie a la scene active,
3. etre reutilise au tour suivant,
4. etre oublie ou resume proprement plus tard.

## Principe central : le runtime ne doit plus parler a la place du MJ

Le runtime doit rester utile pour :

- valider,
- verrouiller,
- persister,
- proteger la coherence,
- enrichir l'etat.

Mais il ne doit pas fournir des phrases RP generiques comme substitut de narration.

Types de phrases a proscrire en mode RP :

- phrases de stabilisation abstraite,
- phrases de raisonnement interne,
- phrases de "non-evenement" technicien,
- phrases de securite hors contexte,
- phrases de pseudo-coherence sans fait concret.

Exemples a eviter :

- `Un detail du lieu reste present dans ton attention.`
- `Le lieu se confirme autour de toi, sans changement notable.`
- `Aucune rupture de continuite n'est appliquee.`
- `Tu peux t'y fondre sans attirer l'attention.` quand rien ne justifie ce sous-entendu.

Le runtime doit fournir des contraintes, pas des repliques.

## Critere de reussite

On considerera que le runtime est "correct" quand, hors bug dur, le MJ repond naturellement a la demande du joueur sur plusieurs tours consecutifs sans casser :

- la coherence du lieu,
- la coherence du ton,
- la coherence des personnages,
- la coherence des informations deja donnees,
- la logique immediate de la scene,
- la coherence globale du lore.

Le test de reference n'est pas "est-ce que le systeme a produit une reponse ?"

Le test de reference est :

si un humain lit l'echange, a-t-il l'impression que le MJ suit reellement la scene, ou qu'il recompile un etat machine ?

## Comportement attendu du MJ selon les contextes

Les exemples ci-dessous sont des cibles de comportement. Ils ne sont pas des gabarits a hardcoder.

Ils montrent ce que le moteur doit etre capable de faire de facon generale.

### Contexte 1 : exploration calme sans evenement majeur

#### Tours

1. Joueur : `j'explore le parvis en regardant autour de moi`
2. Joueur : `je m'approche du bord pour voir la rue`
3. Joueur : `je m'arrete un instant et j'ecoute`

#### Attendu

Le MJ doit :

- decrire des details ordinaires mais concrets,
- faire vivre le lieu,
- ne pas inventer une enigme ou une quete a chaque fois,
- faire sentir une continuite entre les tours.

#### Exemple de reponses naturelles

1. `Sur le parvis des Archives, le va-et-vient reste tranquille. Deux scribes descendent les marches en discutant a voix basse pendant qu'un porteur traverse la place avec une caisse de registres. Rien n'attire encore franchement l'oeil, mais le lieu vit sans se figer.`

2. `En te rapprochant du bord du parvis, tu distingues mieux la grande rue plus bas. Des passants y circulent en files discontinues, entre etals, enseignes et chariots. Depuis ici, tu peux facilement choisir de t'y rendre si quelque chose t'y attire.`

3. `En tendant l'oreille, tu captes surtout des bruits de ville ordinaires : roues sur la pierre, appels brefs d'un marchand plus loin, et le claquement sec d'une porte dans le batiment derriere toi. Rien d'alarmant, mais assez pour sentir le quartier en mouvement.`

### Contexte 2 : deplacement simple vers un lieu visible

#### Tours

1. Joueur : `je me dirige vers la rue marchande`
2. Joueur : `oui j'y vais`

#### Attendu

Le MJ doit :

- proposer le deplacement naturellement,
- puis resoudre le trajet simplement,
- sans ajouter des annotations de menace ou de discretion si rien ne les justifie.

#### Exemple de reponses naturelles

1. `Depuis le parvis, la rue marchande est facile a reperer avec ses enseignes et le va-et-vient des passants. Tu peux t'y rendre en descendant les marches puis en suivant le courant de la rue.`

2. `Quelques instants plus tard, tu rejoins la rue marchande. L'endroit est plus anime que le parvis : vendeurs, clients et charrettes se partagent l'espace dans une rumeur continue.`

### Contexte 3 : debut de conversation avec un PNJ ordinaire

#### Tours

1. Joueur : `je m'approche de la vendeuse et je la salue`
2. Joueur : `je lui demande ce qu'elle vend`
3. Joueur : `je lui demande le prix de la tunique`

#### Attendu

Le MJ doit :

- etablir le contact,
- maintenir le meme PNJ,
- faire avancer l'echange,
- ne pas reintroduire une nouvelle scene complete a chaque tour.

#### Exemple de reponses naturelles

1. `La vendeuse releve la tete quand tu arrives devant son etal et te rend ton salut avec un sourire bref. Elle garde une main sur le tissu qu'elle etait en train de plier, en attendant de voir ce que tu vas demander.`

2. `Elle te montre d'un geste les pieces accrochees derriere elle : des tuniques simples, quelques capes bien coupees et deux tenues plus soignées destinees a une clientele qui a les moyens. Son etal semble modeste, mais correctement tenu.`

3. `Elle prend la tunique que tu regardes, en lissant le tissu entre ses doigts. "Pour celle-ci, compte quatre pieces d'or et cinq d'argent", te dit-elle sans detour.`

### Contexte 4 : choix d'un element deja etabli

#### Tours

1. Joueur : `je cherche une tenue pour l'ecole de magie`
2. MJ : presente plusieurs articles
3. Joueur : `je choisis la tunique d'etude`
4. Joueur : `je veux l'essayer`

#### Attendu

Le MJ doit :

- reconnaitre que le joueur selectionne un element deja montre,
- ne pas re-lister toute l'offre,
- faire progresser l'action de facon locale.

#### Exemple de reponses naturelles

3. `La marchande hoche la tete et sort la tunique d'etude du portant. Le tissu est sobre, bien coupe et plus solide qu'il n'en a l'air. "Celle-ci est a quatre pieces d'or et cinq d'argent", rappelle-t-elle en te la tendant.`

4. `Elle t'indique un paravent de toile tendu au fond de l'echoppe pour l'essayer a l'abri des regards. La tunique est legere sur les epaules et laisse une bonne amplitude de mouvement.`

### Contexte 5 : refus ou blocage coherent

#### Tours

1. Joueur : `je pousse la porte du bureau reserve`
2. Joueur : `j'insiste et je tente de passer`

#### Attendu

Le MJ doit :

- bloquer l'action si le contexte l'exige,
- le faire en RP,
- rester coherent d'un tour a l'autre.

#### Exemple de reponses naturelles

1. `A peine as-tu pose la main sur la porte qu'un garde en poste fait un pas de cote pour t'en barrer l'acces. Sans hausser le ton, il t'indique que cette piece n'est pas ouverte au public.`

2. `Quand tu insistes, le garde ne bouge pas d'un pouce. Son ton se ferme nettement cette fois, et deux regards voisins commencent a se tourner vers vous. Tu peux encore reculer sans incident, ou forcer la situation.`

### Contexte 6 : question de lore en pleine scene

#### Tours

1. Joueur : `je demande pourquoi cette ecole est si connue`
2. Joueur : `et qui la dirige aujourd'hui ?`

#### Attendu

Le MJ doit :

- repondre a la question,
- mais rester ancre dans la scene,
- ne pas basculer dans une encyclopedie detachee si le joueur est en pleine interaction.

#### Exemple de reponses naturelles

1. `La vendeuse laisse echapper un petit souffle amuse. Meme ici, le nom de l'ecole circule facilement : elle a forme plusieurs mages au service de la Primaute, et sa bibliotheque attire autant les studieux que les ambitieux.`

2. `Elle fronce legerement les sourcils avant de chercher dans ses souvenirs. De ce qu'elle en sait, l'ecole est actuellement dirigee par une magistere reputee plus severa que brillante, mais suffisamment influente pour tenir les familles notables a distance respectueuse.`

## Implications techniques generales

La suite du travail ne doit pas consister a ajouter des cas speciaux disperses.

Il faut plutot consolider trois couches generales.

### 1. Couche lecture de scene

Cette couche doit repondre a :

- quel est le cadre actif ?
- quels elements de scene sont deja etablis ?
- quelle est la derniere chose importante qui a ete montre ou dite ?

Elle doit produire un etat de scene exploitable, pas une prose.

### 2. Couche interpretation d'acte situe

Cette couche doit repondre a :

- que tente le joueur maintenant ?
- est-ce une continuation, une confirmation, une selection, une opposition, une precision, une relance ?
- quel element deja etabli cela vise-t-il ?

Elle doit relier le tour courant a la continuite.

### 3. Couche resolution locale

Cette couche doit repondre a :

- que se passe-t-il maintenant, concretement, si rien ne bloque ?
- faut-il decrire, confirmer, refuser, faire repondre un PNJ, montrer un element, ou demander une precision ?

Elle doit produire :

- un fait narratif,
- une progression minimale,
- et eventuellement une ancre de scene mise a jour.

## Ce qu'il faut eviter dans la suite

- ajouter toujours plus de regex metier pour chaque cas,
- multiplier les branches qui ecrivent des phrases generiques,
- traiter les resultats d'outils comme du simple remplissage textuel,
- confondre "engagement grammatical" et "inertie scenique",
- compenser une faiblesse de continuite en forçant des gabarits RP repetitifs.

## Definition pratique du succes

Le projet sera sur la bonne voie quand un test multi-tours simple produira :

- une scene lisible,
- un monde qui a l'air vivant sans surjouer,
- des PNJ qui repondent selon leur place dans le monde,
- des actions qui avancent dans un ordre logique,
- une memoire locale suffisante pour eviter les redites,
- et aucune fuite de langage interne du moteur en mode RP.

Autrement dit :

le MJ ne doit plus seulement "tenir le contexte".

Il doit suivre la scene.
