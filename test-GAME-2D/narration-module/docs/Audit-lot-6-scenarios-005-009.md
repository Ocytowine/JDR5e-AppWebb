# Audit du lot 6 — scénarios 005 à 009

Statut : `ACTIF`  
Date : 2026-07-28

## Décision

Les anciens cas 005 à 009 restent des objectifs fonctionnels valides, mais ils
ne constituent pas cinq lots techniques indépendants. Le cas 005 est une
coordination transversale ; les cas 006 à 009 possèdent ou nécessitent leurs
propres autorités.

L'ordre historique par numéro n'est donc pas l'ordre d'implémentation.

## État vérifié

| Cas | Fondations exécutables | Autorités encore absentes | Décision |
|---|---|---|---|
| 005 — aventure orchestratrice | contrôleur de tour, opérations et événements typés, temps, monde, handoffs, mission/relation, projections lore | routeur générique d'événements métier, agrégat d'intrigue, projection privée par scène, abonnements entre domaines | découper ; ne jamais créer un super-orchestrateur propriétaire de tout |
| 006 — progression | import personnage, projections tactique/narrative, lecture mécanique pour tests | progression mutable, conditions de niveau/classe, validation ruleset et application atomique des gains | après le premier repos et son hook orchestrateur |
| 007 — social | dialogue attribué, mémoire courte par acteur, acceptation mission/relation initiale | axes `trust/affinity/fear/debt`, réputation, historique long, connaissances/croyances par acteur | avant une intrigue complète dépendant des perspectives |
| 008 — bastion | lieux dynamiques, topologie, PNJ promus, temps et événements monde | propriété, pièces, économie, production, défense et ordonnancement du bastion | dernier des cinq ; dépend de presque tous les autres |
| 009 — repos | seed et processus typés, segments, interruption déterministe, horloge, checkpoints, commits et handoff idempotent | raccord intention/contrôleur/UI, activités joueur, règle de récupération, inventaire et continuation narrative | premier vertical jouable |

## Preuves relancées

Le 2026-07-28 :

- `narration-module:test:tactical-rest-handoff` : 13/13 ;
- `narration-module:test:time` : noyau, persistance, monde et voyage verts ;
- `narration-module:test:character` : import et projections verts ;
- `narration-module:test:mission-relation-authority` : décisions et autorité vertes ;
- `narration-module:test:plot-preparation` : gate verte, mais elle interdit
  encore explicitement la création runtime d'intrigue.

Une gate documentaire d'intrigue n'est donc pas un moteur d'intrigue.

## Ordre retenu

### 6A — repos narratif minimal jouable

Raccorder une intention sémantique explicite au processus de repos existant,
poser les questions nécessaires, avancer un segment, intégrer interruption ou
achèvement, puis rendre une continuation strictement issue des événements
committés.

### 6B — premier hook de l'orchestrateur 005

Introduire une enveloppe d'événement et un routeur sans autorité métier. Le
résultat du repos sera son premier cas réel : le routeur signale, les domaines
destinataires décident.

### 6C — état social durable

Créer les axes relationnels, la réputation et la connaissance par acteur. La
parole reste une proposition ; seuls les résultats sociaux validés modifient
l'état.

### 6D — noyau d'intrigue et événements cachés

Ce sous-lot est explicite : il n'est pas repoussé dans une liste indéterminée.
Il introduira :

- vérité privée committée avant mise en scène ;
- engagements et chronologie causale ;
- preuves, indices, fausses pistes et voies indépendantes ;
- projection révélable par scène ;
- évolution hors écran déclenchée par des événements validés ;
- séparation entre vérité, croyance et connaissance des acteurs.

Il dépend de 6B pour les événements et de 6C pour les perspectives sociales.
Le joueur ne reçoit jamais le graphe privé complet.

### 6E — progression narrative

Brancher les disponibilités de progression sur les événements, le repos et une
autorité personnage/ruleset. La narration accompagne un gain validé ; elle ne
le décide pas.

### 6F — bastion

Ouvrir propriété, gestion et vie du lieu après disponibilité des autorités
sociale, événementielle, temporelle, mission et personnage nécessaires.

## Pourquoi commencer par le repos

Le repos possède déjà la plus grande part de son noyau propriétaire. Le travail
manquant est un raccord jouable et des autorités de bénéfices, pas une
architecture à inventer.

Il fournit également un premier événement transversal concret :

```text
intention explicite
  -> RestDomain
  -> segment temporel committé
  -> repos terminé ou interrompu
  -> événement
  -> continuation narrative
```

Ce chemin servira ensuite à construire l'orchestrateur sur un cas réel.

## Règle pour les éléments cachés

Un événement caché est écrit par son domaine propriétaire avant qu'un signe
visible ne soit raconté. La narration ne reçoit que :

- les signes perceptibles ;
- les révélations autorisées ;
- les contraintes utiles à son rôle.

Le moteur d'intrigue conservera la vérité privée et l'orchestrateur ne fera que
transporter ses événements ou demandes.
