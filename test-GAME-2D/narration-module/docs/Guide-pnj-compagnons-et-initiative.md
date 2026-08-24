# Guide des PNJ, compagnons et initiatives

Statut : `GUIDE_ACTIF`

## Les différents niveaux d'un personnage non joueur

Le projet distingue plusieurs états qui ne doivent pas être confondus.

### Présence ambiante

Une présence ambiante donne de la vie à une scène : copiste, garde, cliente ou
passant. Elle possède une désignation visible stable, mais n'est pas encore un
PNJ durable.

Exemple : « une archiviste classe des liasses près du comptoir ». Le métier
n'est pas son nom propre et le wiki ne prétend pas qu'elle est seule dans le
bâtiment.

Dès qu'on lui parle, cette présence peut recevoir un profil conversationnel
éphémère : point de vue subjectif, préoccupations immédiates, opinions, sujets
d'ouverture, limites et manière de parler. Cela lui permet d'avoir un avis ou
de poser une question en retour sans devenir un fait durable du monde.

Exemple : un clerc peut trouver les procédures utiles mais trop rigides. Cette
opinion appartient à sa conversation; elle ne réécrit pas le wiki et ne prouve
pas que l'administration entière partage cet avis.

### Acteur de scène

Lorsqu'une interaction réelle cible cette présence, elle peut devenir un acteur
de scène. Son identité locale et sa petite mémoire de dialogue survivent à une
sortie puis un retour dans cette scène.

Cela ne crée toujours ni relation durable, ni mission, ni compagnon.

### PNJ de campagne

Un acteur devient PNJ de campagne uniquement après une cause durable validée :
relation acceptée, mission, dette, fonction reconnue ou déplacement autorisé.
Une phrase sympathique ou plusieurs dialogues ne suffisent pas.

### Occupant d'un bastion

Un PNJ persistant peut accepter un rôle catalogué dans un bastion. Son
affectation n'efface pas sa volonté propre. Il peut prendre une initiative
locale depuis une préoccupation autorisée et peut aussi rester calme.

### Compagnon

Le noyau du compagnon narratif J7 est livré. Un PNJ de campagne peut rejoindre
le groupe uniquement depuis une mission ou une relation réellement acceptée.
Son appartenance, sa scène, sa séparation et son départ sont durables.

Lorsqu'une demande lui est transmise, sa politique personnelle décide avant la
formulation visible : il peut accepter, adapter, poser une condition ou refuser.
Une acceptation signifie seulement qu'il consent à essayer ; elle n'invente ni
réussite, ni objet déplacé, ni fait découvert.

Les compagnons actifs suivent les déplacements validés et peuvent être projetés
dans la nouvelle scène. Un compagnon séparé reste à sa scène, puis ne rejoint le
groupe qu'après une réunion confirmée. Un compagnon ayant quitté le groupe exige
une nouvelle cause propriétaire pour revenir.

La demande écrite complète passe par l'interpréteur sémantique sans liste de
phrases imposées. Seuls les compagnons actifs dans la scène lui sont signalés.
La décision durable précède la formulation naturelle du `npc_performer`, qui ne
peut ni la changer ni annoncer la réussite de l'action. Le parcours navigateur
et l'initiative sociale ciblée sont certifiés. La projection de fiche vers
`GameBoard` et le tour tactique autonome restent entièrement réservés à J8.

## Ce que sait la mémoire

La mémoire courte conserve au maximum cinq couples « intention du joueur →
réplique affichée » par acteur. Les échanges d'un garde ne contaminent pas ceux
d'une archiviste.

Elle conserve aussi le dernier profil conversationnel accepté du même
`actorId`. Le premier échange initialise sa révision 1. Chaque performance
acceptée la fait évoluer d'une révision; une réponse rejetée ne consomme rien.
Une sortie puis un retour peuvent reprendre ce profil si l'identité canonique
de l'acteur est retrouvée.

La bulle système indique seulement si le profil a été initialisé ou continué,
sa révision et `durable=non`. Elle ne révèle pas ses préoccupations privées.

Une parole reste `PRESENTATION_ONLY`. « Je t’accompagnerai » ne crée pas un
compagnon tant qu'une autorité sociale ou mission ne confirme pas cet
engagement.

Si l'acteur devient plus tard PNJ de campagne, son `actorId` reste le même :
les échanges peuvent donc garder leur continuité. La promotion elle-même ne
copie cependant aucune opinion dans le registre social; une évolution durable
reste soumise à l'autorité mission, relation, monde ou faction.

## Initiative sans joueur

Un PNJ peut agir à une vraie frontière de scène ou de temps :

```text
préoccupation privée exigible
→ acteur et cible présents
→ décision propriétaire
→ événement public committé
→ phrase narrative bornée
```

Le personnage joueur n'est pas automatiquement la cible. Deux PNJ peuvent
interagir entre eux. S'il n'existe aucune cause valide, le résultat est
`CALM` : aucun texte artificiel n'est ajouté.

## Tests disponibles

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:complete-conversations
npm run narration-module:test:npc-return-ui
npm run narration-module:test:social-actor-authority
npm run narration-module:test:social-initiative-ui
npm run narration-module:test:bastion
npm run narration-module:test:companion-j7
npm run narration-module:test:companion-j7-ui
```

Ces tests couvrent les conversations longues, le retour de scène, la promotion
durable, l'état social privé, l'initiative autonome et l'affectation volontaire
à un bastion.

`narration-module:test:complete-conversations` vérifie aussi l'amorçage du
profil, sa continuité, l'isolation entre deux acteurs et le refus d'une
promotion durable proposée par le modèle.

La preuve J7 couvre le recrutement propriétaire, la volonté propre, la demande
écrite libre, sa formulation narrative, l'initiative bornée, plusieurs scènes,
la séparation, la réunion, le départ, la reprise et le raccord au groupe de
voyage. Elle ne revendique aucun compagnon tactique.
J8 conserve cette frontière et prépare sa reprise ultérieure dans
[`Contrat-frontiere-compagnon-tactique-J8.md`](Contrat-frontiere-compagnon-tactique-J8.md) :
autonomie par défaut, contrôle direct uniquement depuis une capacité mécanique
autoritaire réelle.
