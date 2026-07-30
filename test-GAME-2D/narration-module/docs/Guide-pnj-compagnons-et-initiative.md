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

Le statut complet de compagnon n'est pas encore livré. Les anciens documents
de conception imaginent un allié autonome, capable d'accepter, adapter ou
refuser une directive et d'agir au tactique. Le runtime actuel fournit des
briques nécessaires — PNJ durable, état social orienté, initiative et
projection tactique — mais pas encore :

- le contrat durable `compagnon` ;
- l'appartenance active au groupe ;
- les règles de départ et de retour ;
- les directives joueur ;
- la projection de sa fiche vers `GameBoard` ;
- son tour tactique autonome.

## Ce que sait la mémoire

La mémoire courte conserve au maximum cinq couples « intention du joueur →
réplique affichée » par acteur. Les échanges d'un garde ne contaminent pas ceux
d'une archiviste.

Une parole reste `PRESENTATION_ONLY`. « Je t’accompagnerai » ne crée pas un
compagnon tant qu'une autorité sociale ou mission ne confirme pas cet
engagement.

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
```

Ces tests couvrent les conversations longues, le retour de scène, la promotion
durable, l'état social privé, l'initiative autonome et l'affectation volontaire
à un bastion.

Ils ne constituent pas encore un test de compagnon jouable. Un futur guide
compagnon spécialisé remplacera cette section lorsque son contrat et son
parcours tactique seront réellement implémentés.
