# Guide de reprise future du module tactique

## Finalité

Ce guide conserve les jalons nécessaires pour reprendre plus tard le module
tactique sans rouvrir les décisions narratives J1 à J9. Il ne planifie pas le
travail actif : la feuille de route narration reste
`Consolidation-fondations-narration.md`.

Le chantier tactique commence après J9, sur décision explicite du propriétaire.

## État à la frontière J8

Le parcours spécialisé actuel sait :

- recevoir une graine persistée ;
- valider une projection de personnage et des ennemis ;
- charger carte, terrain, lumière, dangers, équipes et positions ;
- enregistrer un checkpoint à une frontière de tour ;
- produire un outcome terminal puis intégrer ses conséquences une seule fois.

Ses limites structurantes sont assumées :

- `GameBoardEncounterInputV1` contient un seul `player` et des `enemies` ;
- l'adaptateur exige exactement une projection `PLAYER` ;
- la boucle `GameBoard` est organisée autour d'un état et d'une phase joueur
  uniques ;
- les alliés, la surprise complète et les compagnons tactiques sont refusés ;
- une requête de génération de carte existe dans le contrat de graine, mais le
  générateur et le solveur de placement ne constituent pas encore des domaines
  autonomes stabilisés.

## Décisions déjà figées

- Un compagnon tactique est autonome par défaut.
- Le joueur ne le contrôle que si une capacité mécanique autoritaire et active
  produit explicitement ce droit.
- La narration ne génère ni carte, ni coordonnées, ni initiative, ni action.
- La projection narrative du compagnon reste distincte de sa projection
  mécanique tactique.
- Le module tactique produit un outcome ; les domaines de campagne valident et
  appliquent leurs propres conséquences.

Référence : `Contrat-frontiere-compagnon-tactique-J8.md`.

## Ordre recommandé du futur chantier tactique

### T0 — Caractérisation du moteur actuel

- figer les tests du plateau, de l'adaptateur, du checkpoint et de l'outcome ;
- inventorier les dépendances directes à `player`, `enemies` et aux phases
  binaires ;
- mesurer les chemins de carte, initiative, action, réaction, victoire, fuite
  et restauration avant extraction.

### T1 — Modèle neutre de participants

- remplacer progressivement `player + enemies` par une collection d'acteurs ;
- séparer équipe, hostilité et mode de contrôle ;
- prévoir au minimum `PLAYER_CHARACTER`, `ALLY`, `ENEMY` et `NEUTRAL` ;
- porter toute ressource et tout état par `actorId` ;
- conserver une façade de compatibilité pour les rencontres existantes.

Le mode de contrôle doit rester distinct du camp : `HUMAN`, `AUTONOMOUS` et,
plus tard seulement, `AUTHORITY_GRANTED_HUMAN`.

### T2 — Génération de carte contractuelle

Créer un port de génération versionné recevant :

- référence de lieu et sources de lore autorisées ;
- type, objectifs et échelle de rencontre ;
- dimensions et topologie attendues ;
- terrains, obstacles, dangers, lumière et météo ;
- zones d'entrée, de sortie et objectifs ;
- graine aléatoire déterministe et version du générateur.

La sortie doit être validée, fingerprintée et entièrement restaurable. Une
carte impossible ou incomplète bloque la rencontre au lieu d'être réparée par
la narration.

### T3 — Solveur de placement

Le placement doit :

- placer tous les acteurs une seule fois et sans chevauchement ;
- respecter équipes, zones autorisées, empreintes et obstacles ;
- intégrer formation, surprise, renforts et distances minimales ;
- rester déterministe pour une même graine ;
- expliquer un refus lorsqu'aucune disposition valide n'existe.

Les intentions narratives comme « je reste près de mon compagnon » deviennent
des contraintes sourcées, jamais des coordonnées directement committées.

### T4 — Ordonnanceur de tours et autonomie

- généraliser l'initiative à tous les acteurs ;
- isoler un moteur de tour indépendant de React ;
- définir actions, réactions, incapacités et fins de tour par acteur ;
- brancher un décideur autonome borné pour alliés et ennemis ;
- faire valider localement toutes les actions proposées ;
- traiter le contrôle magique comme une autorisation temporaire, révocable et
  sourcée, pas comme un type permanent d'acteur.

### T5 — Checkpoint et outcome multi-acteurs

- persister positions, PV, conditions, ressources, initiative et journal pour
  chaque acteur ;
- restaurer uniquement aux frontières stables ;
- distinguer fuite, incapacité, capture, mort et séparation ;
- proposer les conséquences par domaine propriétaire ;
- préserver le rejeu idempotent de l'intégration existante.

### T6 — Projection du compagnon

Seulement après T1 à T5 :

- relire un membre `ACTIVE` de `companion.party-registry` ;
- résoudre sa projection mécanique depuis ses propriétaires ;
- le placer dans son équipe alliée ;
- exécuter ses tours en autonomie ;
- intégrer blessures, ressources, fuite, incapacité ou séparation ;
- refuser tout contrôle joueur dépourvu d'une autorisation mécanique active.

### T7 — Certification navigateur

La gate future doit couvrir au minimum :

- personnage, compagnon autonome et plusieurs ennemis ;
- génération puis restauration de la même carte ;
- placement complet et déterministe ;
- initiative et tour du compagnon ;
- refus d'un ordre illégal ou contraire à son autonomie ;
- checkpoint, rechargement, outcome et retour narratif unique ;
- contrôle exceptionnel seulement avec une capacité autoritaire dédiée.

## Discipline d'architecture

Ne pas commencer par ajouter `allies[]` autour des branches existantes de
`GameBoard.tsx`. Extraire d'abord les modèles et moteurs purs qui rendent les
acteurs symétriques, puis adapter React à ces ports.

Ne pas faire de `NarrativeTurnController` le coordinateur interne des tours
tactiques. Il déclenche le handoff et reprend l'outcome ; le domaine tactique
reste propriétaire entre ces deux frontières.

