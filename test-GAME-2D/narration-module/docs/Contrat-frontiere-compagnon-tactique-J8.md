# Contrat de frontière du compagnon tactique J8

Statut : `VALIDÉ — J8 FERMÉ SANS IMPLÉMENTATION TACTIQUE`

## Objet

J8 prépare le passage futur d'un compagnon narratif validé vers le domaine
tactique. Il ne modifie ni `GameBoard`, ni sa graine, ni sa boucle de tours.

Le lot ferme une frontière : la narration décrit les participants légitimes et
leurs sources ; le futur module tactique décide comment les représenter, les
placer et les faire agir. Une absence de support tactique produit un refus ou un
handoff suspendu, jamais un compagnon factice, invisible au combat ou converti
en personnage joueur.

## Décision de contrôle

Un compagnon est autonome par défaut.

Son appartenance au groupe ne donne jamais au joueur le contrôle direct de ses
déplacements, actions, réactions, ressources ou choix tactiques. Sa volonté
reste portée par les autorités du PNJ et sa politique d'autonomie.

Le contrôle direct est un cas exceptionnel. Il exige une capacité autoritaire
réellement possédée par le personnage, par exemple un effet magique ou une règle
explicite qui contrôle effectivement la cible. Une simple demande, une forte
relation, un ordre accepté ou une formulation de l'IA ne suffisent pas.

Un futur droit de contrôle devra au minimum conserver :

- la capacité et le ruleset propriétaires ;
- la cible valide et son éventuelle immunité ;
- la réussite, le jet de sauvegarde ou la condition qui établit le contrôle ;
- le début, la durée, la concentration et les causes de fin ;
- les actions permises et interdites ;
- l'identité de l'opération et les références de preuve.

J8 ne crée pas ce droit de contrôle. Tant qu'un contrat mécanique dédié ne le
produit pas, le mode tactique d'un compagnon reste `AUTONOMOUS`.

## Autorités conservées

- `companion.party-registry` prouve l'appartenance, le statut `ACTIVE` et la
  présence narrative ;
- `campaign.npc-registry` possède l'identité durable du PNJ ;
- le domaine social conserve sa volonté, ses préoccupations et sa politique
  d'autonomie ;
- le monde possède le lieu, le déplacement et la présence spatiale avant le
  handoff ;
- personnage, inventaire et ruleset produisent les projections mécaniques,
  ressources et conditions accessibles ;
- le domaine tactique possède carte, placement, initiative, tours, actions et
  état transitoire de la rencontre ;
- chaque domaine de campagne valide ses propres conséquences après l'outcome.

La narration ne calcule ni classe d'armure, ni points de vie, ni position de
case, ni initiative. L'IA ne choisit aucune action tactique autoritaire.

## Projection préparée par la narration

La frontière future pourra produire un candidat de projection, jamais un acteur
de plateau déjà accepté. Ce candidat devra référencer :

- `campaignId`, `actorId`, `campaignNpcId` et révision du registre de groupe ;
- statut actif et lieu ou scène courante ;
- équipe proposée et relation à la cause de la rencontre ;
- mode demandé, `AUTONOMOUS` par défaut ;
- références vers la projection mécanique propriétaire ;
- équipement et ressources accessibles, sans agrégat privé complet ;
- conditions persistantes pertinentes ;
- politique d'autonomie et sources publiques nécessaires au tactique ;
- empreinte stable de toutes les projections relues.

Le futur adaptateur tactique doit pouvoir refuser ce candidat si une projection
est absente, périmée, non représentable ou incompatible avec la rencontre.

## Décisions réservées au futur module tactique

### Génération de carte

Le tactique devra résoudre `tacticalMapRef` ou `mapGenerationRequest` à partir du
lieu, du type de rencontre, des dimensions, du terrain, de la lumière, des
dangers, des zones d'entrée et de sortie et d'une graine déterministe. La
narration fournit les faits connus ; elle ne dessine pas la carte.

### Placement

Le placement doit être produit par un solveur propriétaire tenant compte des
équipes, zones d'entrée, empreintes, obstacles, danger immédiat, surprise,
formation et règles de distance. Le compagnon ne reçoit pas une case choisie
par le writer ou déduite de sa simple présence dans la scène.

### Initiative et tour

Le futur moteur doit passer d'une opposition binaire « joueur puis ennemis » à
des participants indexés par acteur. Il décide l'ordre d'initiative, le début et
la fin des tours, les réactions et les acteurs incapables d'agir.

Pour un compagnon autonome, une politique tactique déterministe ou un port
d'autonomie borné choisit parmi les actions légalement disponibles. Une IA peut
éventuellement proposer une préférence, mais le moteur local valide et décide.

### Ressources, blessures et sortie

Le checkpoint tactique possède l'état transitoire. L'outcome propose ensuite les
PV, ressources, conditions, blessures, incapacité, mort, fuite, capture,
séparation et position finale. Aucun de ces effets ne devient durable avant la
validation du domaine de campagne concerné.

## Refus protecteurs J8

Le handoff reste fermé ou suspendu si :

- le compagnon n'est pas `ACTIVE` dans la scène de départ ;
- sa projection mécanique propriétaire manque ou est périmée ;
- la graine ne sait pas représenter une équipe alliée ;
- la carte ou le placement ne représentent pas tous les participants ;
- le moteur ne sait pas exécuter un tour autonome ;
- un contrôle direct est demandé sans capacité autoritaire active ;
- checkpoint et outcome ne peuvent pas conserver séparément chaque acteur.

Le système ne doit ni retirer silencieusement le compagnon de la rencontre, ni
le convertir en ennemi, ni recopier la fiche du personnage joueur.

## Critères de fermeture de J8

J8 est fermé lorsque :

- la décision « autonome par défaut, contrôle autoritaire exceptionnel » est
  validée ;
- les responsabilités narration/tactique/campagne sont attribuées ;
- les exigences de carte, placement, tours et outcome sont consignées ;
- les refus de l'adaptateur actuel sont maintenus ;
- le guide de reprise tactique ordonne les futurs travaux ;
- aucun code `GameBoard` n'a été ajouté au seul motif de fermer J8.

La première implémentation d'un allié tactique appartient à une future feuille
de route du module tactique, après la fermeture narrative J9.
