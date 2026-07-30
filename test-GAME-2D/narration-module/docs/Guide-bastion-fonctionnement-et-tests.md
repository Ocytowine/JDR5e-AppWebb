# Guide du bastion : fonctionnement et tests

Statut : `GUIDE_ACTIF`
Public : concepteur du projet et testeur fonctionnel
Périmètre : lots `6F-B` à `6F-E`

## À quoi sert le bastion ?

Un bastion est un lieu durable appartenant au personnage ou à son groupe. Ce
n'est pas seulement un décor : le lieu conserve ses aménagements, ses travaux,
ses occupants et les incidents qui le concernent.

Exemple : une auberge acquise peut devenir un bastion. Le jeu ne crée pas
automatiquement une grande salle rénovée, des gardes ou des revenus. Ces
éléments doivent venir d'une acquisition, d'un catalogue, d'une décision de PNJ
ou d'un événement réellement validé.

## Le fonctionnement en cinq étapes

### 1. Établir le lieu

Une acquisition committée autorise la création du bastion. Le registre conserve
le lieu, le propriétaire et la source de cette décision.

Exemple visible :

> L’Auberge du Vieux Pont appartient désormais à Aryn et devient son point
> d’ancrage.

Le texte précise qu'aucun aménagement ou occupant supplémentaire n'existe
encore. Cela évite que la narration transforme une propriété vide en base déjà
équipée.

### 2. Lancer un travail

Le joueur choisit un travail présent dans un catalogue. Ce catalogue fournit sa
durée, ses prérequis, son effet et le texte public d'achèvement.

Exemple :

- « Déblayer l’ancienne salle commune » ne demande aucun prérequis et dure
  trente minutes ;
- « Réparer la toiture » demande cent pièces ;
- si l'autorité économique ne peut pas prouver la dépense, la réparation reste
  bloquée : elle ne devient jamais gratuite.

### 3. Affecter un occupant

Un PNJ doit déjà exister durablement et accepter son rôle par l'intermédiaire de
son autorité sociale ou mondiale. Le bastion ne copie que le fait public de
l'affectation, jamais les objectifs ou pensées privés du PNJ.

Exemple : Mira accepte de devenir intendante. Plus tard, elle peut inspecter les
volets sans attendre une commande d'Aryn. Son initiative est committée comme un
fait public, mais sa motivation privée reste dans son état social.

### 4. Recevoir un incident ou une occasion

Le bastion ne crée pas lui-même les événements du monde. Il reçoit un événement
déjà committé, puis une politique injectée décide s'il correspond à une
définition du catalogue d'incidents.

Trois résultats existent actuellement :

- `OPPORTUNITY` : l'occasion reste ouverte et n'est pas résolue à la place du
  joueur ;
- `INSTALLATION_CONSEQUENCE` : seule l'installation ciblée passe à
  `DAMAGED` ou `DISABLED` ;
- `TACTICAL_DEFENSE` : une défense tactique est ouverte, sans décider de son
  résultat.

Exemple d'occasion :

> Un marchand de passage propose du bois sec à prix réduit. L’offre reste
> ouverte : Aryn peut l’examiner ou la laisser passer.

Exemple de conséquence : une tempête endommage la salle déblayée. Le registre
modifie cette installation précise ; il ne détruit pas arbitrairement le reste
du bâtiment.

### 5. Transmettre une défense au tactique

Une attaque ne peut pas être gagnée ou perdue par une phrase du MJ. Le
propriétaire tactique doit fournir une graine complète : lieu, participants,
équipes, positions, terrain, objectifs et conditions de fin.

Le commit du bastion crée alors atomiquement :

```text
incident HANDOFF_ACTIVE
+ process.handoff ACTIVE
+ tactical.encounter-seed
```

Il ne crée ni résultat de combat, ni dégâts tactiques, ni butin. La narration
peut seulement annoncer que la défense commence et que son issue est encore
indécise. Le résultat reviendra plus tard par le contrat de résultat tactique.

## Ce que vérifient les tests

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:bastion
npm run narration-module:test:bastion-ui
npm run narration-module:test:tactical-rest-handoff
npm run build
```

`narration-module:test:bastion` vérifie notamment :

- acquisition, travaux et occupants ;
- occasion ouverte ;
- conséquence locale sur une installation ;
- refus sans commit lorsqu'aucun propriétaire tactique n'est disponible ;
- création atomique du handoff et de la graine de défense ;
- absence de résultat tactique inventé ;
- rejeu idempotent et absence de fuite des données privées.

`narration-module:test:bastion-ui` ouvre une petite surface navigateur de preuve.
Elle vérifie que l'établissement, le travail, l'affectation, l'activité autonome
et l'occasion sont restaurés une seule fois après rechargement.

`narration-module:test:tactical-rest-handoff` vérifie le contrat générique de
départ et de retour du tactique. `npm run build` confirme enfin que le module
reste compatible avec l'application complète.

## Ce qui est testable aujourd'hui dans le jeu principal

Les contrats, la persistance, le contrôleur et la surface navigateur de preuve
sont actifs. Depuis 7A, l'écran principal lancé par `npm run dev` sait aussi
restaurer une défense existante, afficher son attente et ouvrir la surface
tactique avec sa graine persistée. En revanche, il ne propose pas encore un
parcours joueur complet permettant d'acquérir un bastion, choisir ses travaux
et produire une attaque depuis les contenus réels de campagne.

Il est donc possible de certifier le comportement avec les commandes ci-dessus,
mais pas encore de réaliser toute cette recette comme une partie normale dans
le build principal. Le futur branchement jouable devra fournir :

- les catalogues réels de travaux, rôles et incidents ;
- les commandes ou choix d'interface correspondants ;
- une cause venant réellement de la simulation ou d'une intrigue ;
- l'adaptation réelle de la graine aux acteurs et à la carte du plateau ;
- le retour validé de son résultat.

Cette distinction évite de présenter une fixture de test comme une
fonctionnalité de jeu déjà entièrement accessible.

## Comment diagnostiquer un échec

- `catalog-required` : aucun catalogue explicite n'a été fourni ;
- `policy-required` : aucune politique de campagne ne relie l'événement à un
  incident ;
- `source-event-not-committed` : la cause n'existe pas dans un commit valide ;
- `installation-not-found` : la conséquence vise un aménagement absent ;
- `defense-authority-required` : la narration a détecté une défense, mais le
  propriétaire tactique n'est pas branché ;
- `defense-seed-invalid` : la graine tactique est incomplète ou incohérente.

Ces erreurs doivent apparaître dans les diagnostics système, jamais comme des
clés techniques mêlées à la prose du MJ.

## Pourquoi ce n'est pas du hardcode

Les noms « Mira », « Auberge du Vieux Pont », « marchand » et « tempête » sont
des fixtures de test. Le runtime ne recherche pas ces mots et ne contient pas
de liste locale d'événements. En production, les décisions viennent des
interfaces injectées :

- catalogue de travaux ;
- catalogue de rôles et d'activités ;
- politique d'incidents ;
- catalogue d'incidents ;
- autorité sociale ou mondiale ;
- propriétaire tactique.

Le code commun valide leurs contrats et leurs preuves ; le contenu reste
remplaçable sans modifier le moteur.
